const service = require('./kodi.service');
const perms = require('./kodi.permissions');
const portalService = require('../kodiPortal/kodiPortal.service');
const portalPerms = require('../kodiPortal/kodiPortal.permissions');

const buildRuntimePayload = async ({ pageId, role, userId, appId }) => {
    const page = await service.getPageById(pageId);
    if (!page) {
        return null;
    }

    const permissionRows = await service.listPermissions(pageId);
    const permissionMap = perms.formatPermissions(permissionRows);
    const componentRegistry = await service.listComponentRegistry();
    const objects = await service.listObjects();
    const appContextId = appId || page.linked_app_id;
    const app = appContextId ? await service.getAppById(appContextId) : null;

    let effectiveRole = role;
    const isAdmin = perms.isAdminRole(role);
    const isBuilderManagedPage = perms.isTimesPage(page);
    // Admins always bypass app membership for Times (builder-managed) pages.
    const adminBypassMembership = isAdmin && isBuilderManagedPage;

    if (appId && !adminBypassMembership) {
        const linkedPages = await portalService.listPages(appId);
        const mapping = linkedPages.find((row) => String(row.page_id) === String(pageId));
        if (!mapping) {
            throw new Error('Access denied');
        }
        if (app && app.status !== 'active' && !isAdmin) {
            throw new Error('Access denied');
        }
        const membership = await portalService.getEffectiveRuntimeRole({ appId, userId, globalRole: role });
        if (!membership) {
            throw new Error('Access denied');
        }
        effectiveRole = membership;
        if (mapping.role_visibility) {
            const allowed = mapping.role_visibility?.[portalPerms.normalizeRole(effectiveRole)];
            if (allowed === false) {
                throw new Error('Access denied');
            }
        }
    }

    const hasExplicitPermissions = permissionRows.length > 0;
    const hasView = hasExplicitPermissions
        ? perms.userHasViewAccess(permissionMap, effectiveRole)
        : (Boolean(userId) && isBuilderManagedPage);
    if (!hasView) {
        throw new Error('Access denied');
    }

    const flattenComponents = () => {
        const items = [];
        (page.layout?.rows || []).forEach((row) => {
            (row.columns || []).forEach((col) => {
                (col.components || []).forEach((component) => items.push(component));
            });
        });
        return items;
    };

    return {
        page,
        layout: page.layout,
        components: flattenComponents(),
        permissions: permissionMap,
        registry: componentRegistry,
        objects,
        effectiveRole,
        fields: objects.reduce((acc, obj) => {
            acc[obj.name] = obj.fields || [];
            return acc;
        }, {}),
        app,
        metadata: {
            label: page.label,
            pageType: page.page_type,
            status: page.status,
            activatedAt: page.activated_at
        }
    };
};

module.exports = {
    buildRuntimePayload
};
