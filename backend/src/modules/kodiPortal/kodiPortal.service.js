const crypto = require('crypto');
const repository = require('./kodiPortal.repository');
const perms = require('./kodiPortal.permissions');
const { sendKodiAppInviteEmail, sendKodiRoleUpdatedEmail, sendKodiPageAssignedEmail } = require('../../utils/emailService');

const logServiceError = (context, error, extra = {}) => {
    console.error('❌ Kodi Portal service error:', {
        context,
        message: error?.message,
        stack: error?.stack,
        ...extra
    });
};

const logAudit = async ({ entityType, entityId, action, userId, notes }) => {
    try {
        await repository.query(
            `INSERT INTO kodi_audit_logs (entity_type, entity_id, action, performed_by_user_id, notes)
             VALUES ($1,$2,$3,$4,$5)`,
            [entityType, entityId || null, action, userId || null, notes || null]
        );
    } catch (error) {
        console.warn('Kodi audit log failed:', error.message);
    }
};

const buildInviteToken = () => crypto.randomBytes(16).toString('hex');
const getBaseUrl = () => process.env.FRONTEND_URL || process.env.SITE_URL || 'https://welphub.onrender.com';
const buildOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

const buildUsername = async (email) => {
    const base = String(email || '').split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase() || 'kodiuser';
    let candidate = base;
    let counter = 1;
    while (await repository.getIdentityByUsername(candidate)) {
        candidate = `${base}${counter}`;
        counter += 1;
    }
    return candidate;
};

const logEmailDelivery = async ({ triggerKey, recipientEmail, recipientUserId, subject, status, errorMessage, metadata }) => {
    try {
        await repository.query(
            `INSERT INTO email_delivery_logs (trigger_key, recipient_email, recipient_user_id, recipient_type, subject, status, error_message, metadata, sent_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
                triggerKey,
                recipientEmail,
                recipientUserId || null,
                'user',
                subject,
                status,
                errorMessage || null,
                JSON.stringify(metadata || {}),
                status === 'sent' ? new Date() : null
            ]
        );
    } catch (error) {
        console.warn('Failed to log email delivery:', error.message);
    }
};

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));

const ensureDefaultPageConsistency = async (appId) => {
    const app = await repository.getAppById(appId);
    if (!app) throw new Error('App not found');
    const mappings = await repository.listAppPages(appId);
    const defaults = mappings.filter((m) => m.is_default);
    if (defaults.length === 0) {
        if (app.status === 'active') {
            throw new Error('Active app must have a default page.');
        }
        return { hasDefault: false, defaultPageId: null, mappings };
    }
    if (defaults.length > 1) {
        throw new Error('App has multiple default pages. Resolve defaults before continuing.');
    }
    const defaultPageId = defaults[0].page_id;
    if (isUuid(defaultPageId) && String(app.default_page_id || '') !== String(defaultPageId)) {
        await repository.updateApp({ appId, updates: { default_page_id: defaultPageId } });
    }
    return { hasDefault: true, defaultPageId, mappings };
};

const validateActivationEligibility = async (appId) => {
    const app = await repository.getAppById(appId);
    if (!app) throw new Error('App not found');
    const pages = await repository.listAppPages(appId);
    if (!pages.length) throw new Error('App must have at least one linked page before activation.');
    const visiblePages = pages.filter((page) => page.is_visible);
    if (!visiblePages.length) throw new Error('App must have at least one visible page before activation.');
    const defaults = pages.filter((page) => page.is_default);
    if (defaults.length !== 1) {
        throw new Error('App must have exactly one default page before activation.');
    }
    const defaultPageId = defaults[0].page_id;
    if (isUuid(defaultPageId) && (!app.default_page_id || String(app.default_page_id) !== String(defaultPageId))) {
        throw new Error('App default page is not set correctly.');
    }
};

const ensureActiveAppHasVisiblePage = async (appId) => {
    const app = await repository.getAppById(appId);
    if (!app) throw new Error('App not found');
    if (app.status !== 'active') return;
    const pages = await repository.listAppPages(appId);
    if (!pages.some((page) => page.is_visible)) {
        throw new Error('Active app must have at least one visible page.');
    }
};

const listApps = async () => {
    const apps = await repository.listApps();
    return Promise.all(
        apps.map(async (app) => {
            const pages = await repository.listAppPages(app.id);
            const users = await repository.listAppUsers(app.id);
            return {
                ...app,
                pageCount: pages.length,
                userCount: users.length,
                defaultPageId: app.default_page_id || null
            };
        })
    );
};

const getAppDetail = async (appId) => {
    const app = await repository.getAppById(appId);
    if (!app) return null;
    const pages = await repository.listAppPages(appId);
    const users = await repository.listAppUsers(appId);
    const navigation = pages
        .filter((page) => page.is_visible)
        .map((page) => ({
            pageId: page.page_id,
            label: page.nav_label || page.label,
            type: page.page_type,
            isDefault: Boolean(page.is_default),
            order: page.nav_order
        }));
    return {
        ...app,
        linked_pages: pages,
        assigned_users: users,
        navigation,
        counts: {
            pages: pages.length,
            users: users.length
        }
    };
};

const createApp = async (payload) => {
    const app = await repository.createApp(payload);
    const homeLayout = {
        type: '2-column',
        orientation: 'horizontal',
        rows: [
            {
                id: `row-home-${Date.now()}`,
                columns: [
                    {
                        id: `col-home-1`,
                        width: 6,
                        components: [
                            {
                                component_type: 'HighlightsPanel',
                                label: 'Welcome Highlights',
                                props: { title: 'Welcome', items: ['Quick Links', 'Recent Updates'] },
                                layout: { width: 6, height: 2, minWidth: 2, maxWidth: 12 },
                                permissions: { roles: [] }
                            }
                        ]
                    },
                    {
                        id: `col-home-2`,
                        width: 6,
                        components: [
                            {
                                component_type: 'ActivityTimeline',
                                label: 'Recent Activity',
                                props: { items: ['Onboarding started', 'App access granted', 'Profile updated'] },
                                layout: { width: 6, height: 2, minWidth: 2, maxWidth: 12 },
                                permissions: { roles: [] }
                            }
                        ]
                    }
                ]
            }
        ]
    };
    const dashboardLayout = {
        type: '2-column',
        orientation: 'horizontal',
        rows: [
            {
                id: `row-dash-${Date.now()}`,
                columns: [
                    {
                        id: `col-dash-1`,
                        width: 6,
                        components: [
                            {
                                component_type: 'DataTable',
                                label: 'Pipeline Snapshot',
                                props: { items: [{ stage: 'Qualified', value: '$12k' }] },
                                layout: { width: 6, height: 3, minWidth: 2, maxWidth: 12 },
                                permissions: { roles: [] }
                            }
                        ]
                    },
                    {
                        id: `col-dash-2`,
                        width: 6,
                        components: [
                            {
                                component_type: 'RecordDetails',
                                label: 'KPI Summary',
                                binding: { field: 'kpi' },
                                layout: { width: 6, height: 3, minWidth: 2, maxWidth: 12 },
                                permissions: { roles: [] }
                            }
                        ]
                    }
                ]
            }
        ]
    };
    const homePage = await repository.query(
        `INSERT INTO kodi_pages (label, page_type, status, layout, settings)
         VALUES ($1, $2, 'activated', $3::jsonb, '{}'::jsonb)
         RETURNING *`,
        [`${app.label || app.name} Home`, 'home', homeLayout]
    );
    const dashboardPage = await repository.query(
        `INSERT INTO kodi_pages (label, page_type, status, layout, settings)
         VALUES ($1, $2, 'activated', $3::jsonb, '{}'::jsonb)
         RETURNING *`,
        [`${app.label || app.name} Dashboard`, 'app', dashboardLayout]
    );
    const homeRow = homePage.rows[0];
    const dashRow = dashboardPage.rows[0];
    await repository.addAppPageMapping({
        appId: app.id,
        pageId: homeRow.id,
        navLabel: 'Home',
        navOrder: 1,
        isDefault: true,
        isVisible: true
    });
    await repository.addAppPageMapping({
        appId: app.id,
        pageId: dashRow.id,
        navLabel: 'Dashboard',
        navOrder: 2,
        isDefault: false,
        isVisible: true
    });
    await repository.updateApp({ appId: app.id, updates: { default_page_id: homeRow.id } });
    return app;
};

const updateApp = async (appId, payload) => {
    return repository.updateApp({ appId, updates: payload });
};

const getSettings = async (appId) => {
    const app = await repository.getAppById(appId);
    if (!app) return null;
    return {
        id: app.id,
        name: app.name,
        label: app.label,
        description: app.description,
        icon: app.icon,
        themeConfig: app.theme_config || {},
        settings: app.settings || {},
        navigationMode: app.navigation_mode,
        landingBehavior: app.landing_behavior,
        defaultPageId: app.default_page_id
    };
};

const updateSettings = async (appId, payload) => {
    const app = await repository.getAppById(appId);
    if (!app) throw new Error('App not found');
    if (payload.defaultPageId) {
        const pages = await repository.listAppPages(appId);
        const mapping = pages.find((m) => String(m.page_id) === String(payload.defaultPageId));
        if (!mapping) {
            throw new Error('Default page must be linked to the app.');
        }
        if (!mapping.is_visible) {
            throw new Error('Default page must be visible.');
        }
    }
    if (!payload.defaultPageId && app.status === 'active') {
        throw new Error('Active app must have a default page.');
    }
    const updates = {
        name: payload.name,
        label: payload.label,
        description: payload.description,
        icon: payload.icon,
        theme_config: payload.themeConfig,
        navigation_mode: payload.navigationMode,
        landing_behavior: payload.landingBehavior,
        settings: payload.settings,
        default_page_id: isUuid(payload.defaultPageId) ? payload.defaultPageId : undefined
    };
    if (payload.defaultPageId) {
        await repository.updateAppPageMapping({
            mappingId: (await repository.listAppPages(appId))
                .find((m) => String(m.page_id) === String(payload.defaultPageId)).mapping_id,
            updates: { is_default: true }
        });
        if (isUuid(payload.defaultPageId)) {
            await repository.updateApp({ appId, updates: { default_page_id: payload.defaultPageId } });
        }
    }
    return repository.updateApp({ appId, updates });
};

const activateApp = async (appId) => {
    await validateActivationEligibility(appId);
    return repository.updateApp({ appId, updates: { status: 'active' } });
};

const deactivateApp = async (appId) => {
    return repository.updateApp({ appId, updates: { status: 'inactive' } });
};

const listUsers = async (appId) => repository.listAppUsers(appId);

const assignUser = async ({ appId, user, permissions, roleKey, baseUrl }) => {
    const token = buildInviteToken();
    const invitedAt = new Date();
    const otp = buildOtp();
    const bcrypt = require('bcryptjs');
    const hashedOtp = await bcrypt.hash(String(otp), 10);
    let identity = await repository.getIdentityByUserId(user.id);
    if (!identity) {
        const username = await buildUsername(user.email);
        identity = await repository.createIdentity({
            userId: user.id,
            username,
            otpHash: hashedOtp,
            otpExpiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
            firstLoginRequired: true,
            firstLoginToken: null,
            firstLoginExpiresAt: null
        });
    } else {
        await repository.updateIdentity({
            userId: user.id,
            updates: {
                otp_hash: hashedOtp,
                otp_expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
                first_login_required: true,
                first_login_token: null,
                first_login_expires_at: null
            }
        });
    }
    const assignment = await repository.upsertAppUser({
        appId,
        userId: user.id,
        permissions,
        roleKey,
        status: 'pending',
        inviteToken: token,
        invitedAt
    });
    const app = await repository.getAppById(appId);
    const defaultPage = app.default_page_id ? await repository.getPageById(app.default_page_id) : null;
    const invite = await sendKodiAppInviteEmail({
        to: user.email,
        name: user.display_name || user.email,
        appName: app.label || app.name,
        role: roleKey,
        loginUrl: `${baseUrl}/kodi-auth/sign-in`,
        inviteUrl: `${baseUrl}/kodi/invitations/accept?token=${token}`,
        pageUrl: defaultPage ? `${baseUrl}/kodi/app/${appId}/page/${defaultPage.id}` : null,
        pageName: defaultPage?.label || null,
        username: identity?.username,
        otp
    });
    await logEmailDelivery({
        triggerKey: 'kodi_app_invite',
        recipientEmail: user.email,
        recipientUserId: user.id,
        subject: `Invitation to ${app.label || app.name}`,
        status: invite?.success === false ? 'failed' : 'sent',
        errorMessage: invite?.error,
        metadata: { appId, inviteToken: token }
    });
    await logAudit({
        entityType: 'kodi_app_user',
        entityId: assignment?.id,
        action: 'invite_sent',
        userId: user.id,
        notes: JSON.stringify({ appId, roleKey, username: identity?.username })
    });
    return assignment;
};

const updateUser = async ({ appId, userId, updates, baseUrl }) => {
    const updated = await repository.updateAppUser({ appId, userId, updates });
    if (!updated) return null;
    const userRow = await repository.query(
        `SELECT email, display_name
         FROM users
         WHERE id = $1`,
        [userId]
    );
    const user = userRow.rows[0] || {};
    if (updates.role_key) {
        const app = await repository.getAppById(appId);
        const email = await sendKodiRoleUpdatedEmail({
            to: user.email,
            name: user.display_name || user.email,
            appName: app?.label || app?.name,
            role: updates.role_key,
            loginUrl: `${baseUrl}/kodi-auth/sign-in`
        });
        await logEmailDelivery({
            triggerKey: 'kodi_role_updated',
            recipientEmail: user.email,
            recipientUserId: updated.user_id,
            subject: `Role updated in ${app?.label || app?.name}`,
            status: email?.success === false ? 'failed' : 'sent',
            errorMessage: email?.error,
            metadata: { appId }
        });
    }
    return updated;
};

const updateUserStatus = async ({ appId, userId, status }) => {
    const updates = {
        status,
        disabled_at: status === 'disabled' ? new Date() : null,
        accepted_at: status === 'active' ? new Date() : null
    };
    return repository.updateAppUser({ appId, userId, updates });
};

const resendInvite = async ({ appId, user, roleKey, baseUrl }) => {
    const token = buildInviteToken();
    const invitedAt = new Date();
    const otp = buildOtp();
    const bcrypt = require('bcryptjs');
    const hashedOtp = await bcrypt.hash(String(otp), 10);
    const updated = await repository.updateAppUser({
        appId,
        userId: user.id,
        updates: {
            invite_token: token,
            invited_at: invitedAt,
            status: 'pending'
        }
    });
    const identity = await repository.getIdentityByUserId(user.id);
    if (identity) {
        await repository.updateIdentity({
            userId: user.id,
            updates: {
                otp_hash: hashedOtp,
                otp_expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
                first_login_required: true,
                first_login_token: null,
                first_login_expires_at: null
            }
        });
    }
    const app = await repository.getAppById(appId);
    const email = await sendKodiAppInviteEmail({
        to: user.email,
        name: user.display_name || user.email,
        appName: app.label || app.name,
        role: roleKey || updated?.role_key,
        loginUrl: `${baseUrl}/kodi-auth/sign-in`,
        inviteUrl: `${baseUrl}/kodi/invitations/accept?token=${token}`,
        pageUrl: null,
        pageName: null,
        username: identity?.username,
        otp
    });
    await logEmailDelivery({
        triggerKey: 'kodi_invite_resend',
        recipientEmail: user.email,
        recipientUserId: user.id,
        subject: `Invitation to ${app.label || app.name}`,
        status: email?.success === false ? 'failed' : 'sent',
        errorMessage: email?.error,
        metadata: { appId, inviteToken: token }
    });
    await logAudit({
        entityType: 'kodi_app_user',
        entityId: updated?.id,
        action: 'invite_resent',
        userId: user.id,
        notes: JSON.stringify({ appId })
    });
    return updated;
};

const acceptInvite = async ({ token, userId }) => {
    const membership = await repository.query(
        `SELECT *
         FROM kodi_app_users
         WHERE invite_token = $1`,
        [token]
    );
    const row = membership.rows[0];
    if (!row) throw new Error('Invitation token not found');
    if (userId && String(row.user_id) !== String(userId)) {
        throw new Error('Invitation token does not match the user');
    }
    const updated = await repository.updateAppUser({
        appId: row.app_id,
        userId: row.user_id,
        updates: {
            status: 'active',
            invite_token: null,
            accepted_at: new Date(),
            disabled_at: null
        }
    });
    await logAudit({
        entityType: 'kodi_app_user',
        entityId: updated?.id,
        action: 'invite_accepted',
        userId: row.user_id,
        notes: JSON.stringify({ appId: row.app_id })
    });
    return updated;
};

const listPages = async (appId) => repository.listAppPages(appId);
const listActivatedPages = async () => repository.listActivatedPages();

const linkPage = async ({ appId, pageId, navLabel, navOrder, isDefault, isVisible, roleVisibility }) => {
    const page = await repository.getPageById(pageId);
    if (!page) throw new Error('Page not found');
    if (page.status !== 'activated') throw new Error('Only activated pages can be linked to apps');
    const mappings = await repository.listAppPages(appId);
    const defaultExists = mappings.some((m) => m.is_default);
    const finalDefault = Boolean(isDefault) || (!defaultExists && mappings.length === 0);
    const order = navOrder || (mappings.length + 1);
    await repository.query('BEGIN');
    try {
        if (finalDefault && defaultExists) {
            for (const m of mappings) {
                if (m.is_default) {
                    await repository.updateAppPageMapping({
                        mappingId: m.mapping_id,
                        updates: { is_default: false }
                    });
                }
            }
        }
        const mapping = await repository.addAppPageMapping({
            appId,
            pageId,
            navLabel: navLabel || page.label,
            navOrder: order,
            isDefault: finalDefault,
            isVisible: isVisible !== undefined ? Boolean(isVisible) : true,
            roleVisibility
        });
        if (finalDefault) {
            await repository.updateApp({ appId, updates: { default_page_id: pageId } });
        }
        await ensureDefaultPageConsistency(appId);
        await repository.query('COMMIT');

        const app = await repository.getAppById(appId);
        const users = await repository.listAppUsers(appId);
        for (const user of users.filter((u) => u.status === 'active')) {
            const email = await sendKodiPageAssignedEmail({
                to: user.email,
                name: user.display_name || user.email,
                appName: app.label || app.name,
                pageName: page.label,
                pageUrl: `${getBaseUrl()}/kodi/app/${appId}/page/${page.id}`,
                loginUrl: `${getBaseUrl()}/kodi-auth/sign-in`
            });
            await logEmailDelivery({
                triggerKey: 'kodi_page_assigned',
                recipientEmail: user.email,
                recipientUserId: user.user_id,
                subject: `New page assigned in ${app.label || app.name}`,
                status: email?.success === false ? 'failed' : 'sent',
                errorMessage: email?.error,
                metadata: { appId, pageId }
            });
        }
        return mapping;
    } catch (error) {
        await repository.query('ROLLBACK');
        throw error;
    }
};

const resolveMappingId = async ({ appId, mappingId }) => {
    if (!mappingId) return null;
    if (/^\d+$/.test(String(mappingId))) {
        const pages = await repository.listAppPages(appId);
        const match = pages.find((row) => Number(row.nav_order) === Number(mappingId));
        return match?.mapping_id || null;
    }
    return mappingId;
};

const updatePage = async ({ appId, mappingId, updates }) => {
    const resolvedMappingId = await resolveMappingId({ appId, mappingId });
    if (!resolvedMappingId) return null;
    const existing = await repository.getAppPageMappingById(resolvedMappingId);
    if (!existing) return null;
    if (updates.is_default === false && existing.is_default) {
        const app = await repository.getAppById(appId);
        if (app.status === 'active') {
            throw new Error('Cannot remove the default page from an active app without selecting another default.');
        }
    }
    if (updates.is_default === true) {
        if (updates.is_visible === false || (!existing.is_visible && updates.is_visible === undefined)) {
            throw new Error('Default page must be visible.');
        }
        const mappings = await repository.listAppPages(appId);
        await repository.query('BEGIN');
        try {
            for (const m of mappings) {
                if (m.is_default && m.mapping_id !== mappingId) {
                    await repository.updateAppPageMapping({ mappingId: m.mapping_id, updates: { is_default: false } });
                }
            }
            const updated = await repository.updateAppPageMapping({ mappingId: resolvedMappingId, updates });
            if (updates.is_default === true && updated && isUuid(updated.page_id)) {
                await repository.updateApp({ appId, updates: { default_page_id: updated.page_id } });
            }
            await ensureDefaultPageConsistency(appId);
            await ensureActiveAppHasVisiblePage(appId);
            await repository.query('COMMIT');
            return updated;
        } catch (error) {
            await repository.query('ROLLBACK');
            throw error;
        }
    }
    const updated = await repository.updateAppPageMapping({ mappingId: resolvedMappingId, updates });
    await ensureDefaultPageConsistency(appId);
    await ensureActiveAppHasVisiblePage(appId);
    return updated;
};

const removePage = async ({ appId, mappingId }) => {
    const resolvedMappingId = await resolveMappingId({ appId, mappingId });
    if (!resolvedMappingId) return;
    const mapping = await repository.getAppPageMappingById(resolvedMappingId);
    if (!mapping) return;
    const app = await repository.getAppById(appId);
    if (mapping.is_default && app.status === 'active') {
        throw new Error('Cannot remove the default page from an active app without assigning another default.');
    }
    await repository.query('BEGIN');
    try {
        await repository.deleteAppPageMapping(resolvedMappingId);
        await ensureDefaultPageConsistency(appId);
        await ensureActiveAppHasVisiblePage(appId);
        await repository.query('COMMIT');
    } catch (error) {
        await repository.query('ROLLBACK');
        throw error;
    }
};

const reorderPages = async (appId, orderedIds) => {
    await repository.reorderAppPages(appId, orderedIds);
    const pages = await repository.listAppPages(appId);
    const normalized = pages
        .sort((a, b) => a.nav_order - b.nav_order)
        .map((m, index) => ({ mappingId: m.mapping_id, order: index + 1 }));
    for (const entry of normalized) {
        await repository.updateAppPageMapping({
            mappingId: entry.mappingId,
            updates: { nav_order: entry.order }
        });
    }
    return repository.listAppPages(appId);
};

const getNavigation = async ({ appId, role, userId }) => {
    const app = await repository.getAppById(appId);
    if (!app) return null;
    if (app.status !== 'active') {
        throw new Error('App is not active');
    }
    const pages = await repository.listAppPages(appId);
    const isAdmin = perms.isAdminRole(role);
    let effectiveRole = perms.normalizeRole(role);
    if (!isAdmin && userId) {
        const membership = await repository.getAppUserMembership(appId, userId);
        if (!membership) {
            throw new Error('Access denied');
        }
        effectiveRole = perms.resolveEffectiveRole({ appRole: membership.role_key, globalRole: role });
    }
    const normalizedRole = perms.normalizeRole(effectiveRole);
    const visible = pages.filter((page) => {
        if (!page.is_visible) return false;
        if (!page.role_visibility) return true;
        const allowed = page.role_visibility?.[normalizedRole];
        return allowed !== false;
    });
    return {
        app: {
            id: app.id,
            label: app.label || app.name,
            name: app.name,
            status: app.status,
            icon: app.icon,
            themeConfig: app.theme_config || {},
            settings: app.settings || {},
            navigationMode: app.navigation_mode || 'sidebar',
            landingBehavior: app.landing_behavior || 'default_page',
            defaultPageId: app.default_page_id || null
        },
        navigation: visible.map((page) => ({
            pageId: page.page_id,
            label: page.nav_label || page.label,
            type: page.page_type,
            isDefault: Boolean(page.is_default),
            order: page.nav_order
        }))
    };
};

const listUserApps = async ({ userId, role }) => {
    if (perms.isAdminRole(role)) {
        const apps = await repository.listApps();
        return apps
            .filter((app) => app.status === 'active')
            .map((app) => ({
                app_id: app.id,
                name: app.name,
                label: app.label,
                status: app.status,
                icon: app.icon,
                theme_config: app.theme_config
            }));
    }
    return repository.listAppMembershipsForUser(userId);
};

const getEffectiveRuntimeRole = async ({ appId, userId, globalRole }) => {
    if (!appId || !userId) {
        return perms.resolveEffectiveRole({ globalRole });
    }
    const membership = await repository.getAppUserMembership(appId, userId);
    if (!membership) return null;
    return perms.resolveEffectiveRole({ appRole: membership.role_key, globalRole });
};

module.exports = {
    listApps,
    getAppDetail,
    createApp,
    updateApp,
    getSettings,
    updateSettings,
    activateApp,
    deactivateApp,
    listUsers,
    assignUser,
    updateUser,
    updateUserStatus,
    resendInvite,
    acceptInvite,
    listPages,
    listActivatedPages,
    linkPage,
    updatePage,
    removePage,
    reorderPages,
    getNavigation,
    listUserApps,
    getEffectiveRuntimeRole,
    validateActivationEligibility,
    ensureDefaultPageConsistency
};
