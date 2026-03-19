const service = require('./kodiPortal.service');
const repository = require('./kodiPortal.repository');
const validators = require('./kodiPortal.validators');
const bcrypt = require('bcryptjs');

const baseUrl = () => process.env.FRONTEND_URL || process.env.SITE_URL || 'https://welphub.onrender.com';

const logControllerError = (route, error, extra = {}) => {
    console.error('❌ Kodi Portal controller error:', {
        route,
        message: error?.message,
        stack: error?.stack,
        ...extra
    });
};

const listApps = async (req, res) => {
    try {
        const apps = await service.listApps();
        return res.json({ success: true, data: apps });
    } catch (error) {
        logControllerError('listApps', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to load apps' });
    }
};

const getApp = async (req, res) => {
    try {
        const app = await service.getAppDetail(req.params.id);
        if (!app) return res.status(404).json({ success: false, error: 'App not found' });
        return res.json({ success: true, data: app });
    } catch (error) {
        logControllerError('getApp', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to load app' });
    }
};

const createApp = async (req, res) => {
    try {
        const app = await service.createApp({
            name: req.body.name,
            label: req.body.label,
            description: req.body.description,
            icon: req.body.icon,
            themeConfig: req.body.themeConfig,
            navigationMode: req.body.navigationMode,
            landingBehavior: req.body.landingBehavior,
            settings: req.body.settings
        });
        return res.status(201).json({ success: true, data: app });
    } catch (error) {
        logControllerError('createApp', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to create app' });
    }
};

const updateApp = async (req, res) => {
    try {
        const app = await service.updateApp(req.params.id, {
            name: req.body.name,
            label: req.body.label,
            description: req.body.description,
            icon: req.body.icon
        });
        if (!app) return res.status(404).json({ success: false, error: 'App not found' });
        return res.json({ success: true, data: app });
    } catch (error) {
        logControllerError('updateApp', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to update app' });
    }
};

const getSettings = async (req, res) => {
    try {
        const settings = await service.getSettings(req.params.id);
        if (!settings) return res.status(404).json({ success: false, error: 'App not found' });
        return res.json({ success: true, data: settings });
    } catch (error) {
        logControllerError('getSettings', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to load settings' });
    }
};

const updateSettings = async (req, res) => {
    try {
        const app = await service.updateSettings(req.params.id, {
            name: req.body.name,
            label: req.body.label,
            description: req.body.description,
            icon: req.body.icon,
            themeConfig: req.body.themeConfig,
            navigationMode: req.body.navigationMode,
            landingBehavior: req.body.landingBehavior,
            defaultPageId: req.body.defaultPageId,
            settings: req.body.settings
        });
        if (!app) return res.status(404).json({ success: false, error: 'App not found' });
        return res.json({ success: true, data: app });
    } catch (error) {
        logControllerError('updateSettings', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to update settings' });
    }
};

const activateApp = async (req, res) => {
    try {
        const app = await service.activateApp(req.params.id);
        return res.json({ success: true, data: app });
    } catch (error) {
        logControllerError('activateApp', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to activate app' });
    }
};

const deactivateApp = async (req, res) => {
    try {
        const app = await service.deactivateApp(req.params.id);
        return res.json({ success: true, data: app });
    } catch (error) {
        logControllerError('deactivateApp', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to deactivate app' });
    }
};

const listUsers = async (req, res) => {
    try {
        const users = await service.listUsers(req.params.id);
        return res.json({ success: true, data: users });
    } catch (error) {
        logControllerError('listUsers', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to load users' });
    }
};

const assignUser = async (req, res) => {
    try {
        const app = await repository.getAppById(req.params.id);
        if (!app) {
            return res.status(404).json({ success: false, error: 'App not found' });
        }
        let user = await repository.query(
            `SELECT id, email, display_name, role
             FROM users
             WHERE LOWER(email) = $1`,
            [String(req.body.email || '').trim().toLowerCase()]
        );
        if (user.rows[0]) {
            const staffRow = await repository.query(
                `SELECT 1 FROM welp_staff WHERE user_id = $1 AND is_active = true`,
                [user.rows[0].id]
            );
            const isStaff = staffRow.rows.length > 0;
            if (!isStaff && !['admin', 'super_admin', 'hr_admin', 'welp_employee'].includes(user.rows[0].role)) {
                return res.status(400).json({
                    success: false,
                    error: 'Client accounts cannot be assigned to Kodi admin apps.'
                });
            }
        }
        if (!user.rows[0]) {
            const email = String(req.body.email || '').trim().toLowerCase();
            if (!email) {
                return res.status(400).json({ success: false, error: 'Email is required' });
            }
            const passwordHash = await bcrypt.hash(Math.random().toString(36).slice(2), 10);
            const role = 'welp_employee';
            const displayName = email.split('@')[0] || 'Kodi User';

            const hasIsActive = await repository.query(
                `SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'is_active'
                ) AS exists`
            );
            const hasIsVerified = await repository.query(
                `SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'is_verified'
                ) AS exists`
            );

            const columns = ['email', 'password_hash', 'role', 'display_name'];
            const values = [email, passwordHash, role, displayName];
            let idx = values.length;
            if (hasIsActive.rows[0]?.exists) {
                columns.push('is_active');
                values.push(true);
                idx += 1;
            }
            if (hasIsVerified.rows[0]?.exists) {
                columns.push('is_verified');
                values.push(true);
                idx += 1;
            }

            const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
            user = await repository.query(
                `INSERT INTO users (${columns.join(', ')})
                 VALUES (${placeholders})
                 RETURNING id, email, display_name`,
                values
            );
            await repository.query(
                `INSERT INTO welp_staff (user_id, staff_role_key, department, is_active)
                 VALUES ($1, $2, $3, true)
                 ON CONFLICT (user_id) DO NOTHING`,
                [user.rows[0].id, 'welp_employee', null]
            );
        }
        const assignment = await service.assignUser({
            appId: req.params.id,
            user: user.rows[0],
            permissions: req.body.permissions || {},
            roleKey: req.body.roleKey,
            baseUrl: baseUrl()
        });
        return res.status(201).json({ success: true, data: assignment });
    } catch (error) {
        logControllerError('assignUser', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to assign user' });
    }
};

const updateUser = async (req, res) => {
    try {
        const updated = await service.updateUser({
            appId: req.params.id,
            userId: req.params.userId,
            updates: {
                role_key: req.body.roleKey,
                permissions: req.body.permissions
            },
            baseUrl: baseUrl()
        });
        if (!updated) return res.status(404).json({ success: false, error: 'Membership not found' });
        return res.json({ success: true, data: updated });
    } catch (error) {
        logControllerError('updateUser', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to update user' });
    }
};

const updateUserStatus = async (req, res) => {
    try {
        const updated = await service.updateUserStatus({
            appId: req.params.id,
            userId: req.params.userId,
            status: req.body.status
        });
        if (!updated) return res.status(404).json({ success: false, error: 'Membership not found' });
        return res.json({ success: true, data: updated });
    } catch (error) {
        logControllerError('updateUserStatus', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to update status' });
    }
};

const resendInvite = async (req, res) => {
    try {
        const membership = await repository.getAppUserMembership(req.params.id, req.params.userId);
        if (!membership) return res.status(404).json({ success: false, error: 'Membership not found' });
        const user = await repository.query(
            `SELECT id, email, display_name
             FROM users
             WHERE id = $1`,
            [req.params.userId]
        );
        if (!user.rows[0]) return res.status(404).json({ success: false, error: 'User not found' });
        await service.resendInvite({
            appId: req.params.id,
            user: user.rows[0],
            roleKey: membership.role_key,
            baseUrl: baseUrl()
        });
        return res.json({ success: true });
    } catch (error) {
        logControllerError('resendInvite', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to resend invite' });
    }
};

const acceptInvite = async (req, res) => {
    try {
        const updated = await service.acceptInvite({ token: req.body.token, userId: req.user?.id });
        return res.json({ success: true, data: updated });
    } catch (error) {
        logControllerError('acceptInvite', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to accept invite' });
    }
};

const deleteUser = async (req, res) => {
    try {
        await repository.deleteAppUser(req.params.id, req.params.userId);
        return res.json({ success: true });
    } catch (error) {
        logControllerError('deleteUser', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to remove user' });
    }
};

const listPages = async (req, res) => {
    try {
        const pages = await service.listPages(req.params.id);
        return res.json({ success: true, data: pages });
    } catch (error) {
        logControllerError('listPages', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to load pages' });
    }
};

const listActivatedPages = async (_req, res) => {
    try {
        const pages = await service.listActivatedPages();
        return res.json({ success: true, data: pages });
    } catch (error) {
        logControllerError('listActivatedPages', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to load activated pages' });
    }
};

const linkPage = async (req, res) => {
    try {
        console.log('Kodi Portal linkPage payload:', {
            appId: req.params.id,
            body: req.body
        });
        const mapping = await service.linkPage({
            appId: req.params.id,
            pageId: req.body.pageId,
            navLabel: req.body.navLabel,
            navOrder: req.body.navOrder,
            isDefault: req.body.isDefault,
            isVisible: req.body.isVisible,
            roleVisibility: req.body.roleVisibility
        });
        return res.status(201).json({ success: true, data: mapping });
    } catch (error) {
        logControllerError('linkPage', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to link page' });
    }
};

const updatePage = async (req, res) => {
    try {
        console.log('Kodi Portal updatePage payload:', {
            appId: req.params.id,
            mappingId: req.params.mappingId,
            body: req.body
        });
        const mapping = await service.updatePage({
            appId: req.params.id,
            mappingId: req.params.mappingId,
            updates: {
                nav_label: req.body.navLabel,
                nav_order: req.body.navOrder,
                is_default: req.body.isDefault,
                is_visible: req.body.isVisible,
                role_visibility: req.body.roleVisibility
            }
        });
        if (!mapping) return res.status(404).json({ success: false, error: 'Mapping not found' });
        return res.json({ success: true, data: mapping });
    } catch (error) {
        logControllerError('updatePage', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to update page mapping' });
    }
};

const deletePage = async (req, res) => {
    try {
        await service.removePage({ appId: req.params.id, mappingId: req.params.mappingId });
        return res.json({ success: true });
    } catch (error) {
        logControllerError('deletePage', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to remove page' });
    }
};

const reorderPages = async (req, res) => {
    try {
        const pages = await service.reorderPages(req.params.id, req.body.orderedIds);
        return res.json({ success: true, data: pages });
    } catch (error) {
        logControllerError('reorderPages', error);
        return res.status(400).json({ success: false, error: error.message || 'Failed to reorder pages' });
    }
};

const getNavigation = async (req, res) => {
    try {
        const role = req.query.role || req.user?.role;
        const nav = await service.getNavigation({ appId: req.params.id, role, userId: req.user?.id });
        if (!nav) return res.status(404).json({ success: false, error: 'App not found' });
        return res.json({ success: true, data: nav });
    } catch (error) {
        logControllerError('getNavigation', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to load navigation' });
    }
};

const listUserApps = async (req, res) => {
    try {
        const rows = await service.listUserApps({ userId: req.user?.id, role: req.user?.role });
        return res.json({ success: true, data: rows });
    } catch (error) {
        logControllerError('listUserApps', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to load user apps' });
    }
};

module.exports = {
    ...validators,
    listApps,
    getApp,
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
    deleteUser,
    listPages,
    listActivatedPages,
    linkPage,
    updatePage,
    deletePage,
    reorderPages,
    getNavigation,
    listUserApps
};
