const service = require('./kodi.service');
const perms = require('./kodi.permissions');

const normalizeRole = (value) => String(value || '').toLowerCase().trim();
const ADMIN_ALIASES = new Set(['admin', 'super_admin', 'superadmin', 'system_admin', 'hr_admin']);

const isAdminRole = (role) => ADMIN_ALIASES.has(normalizeRole(role));

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

    if (appId) {
        const linkedPages = await service.listAppPages(appId);
        const isLinked = linkedPages.some((row) => String(row.page_id) === String(pageId));
        if (!isLinked) {
            throw new Error('Access denied');
        }
        if (!isAdminRole(role)) {
            const appUsers = await service.listAppUsers(appId);
            const isMember = appUsers.some((row) => String(row.user_id) === String(userId));
            if (!isMember) {
                throw new Error('Access denied');
            }
        }
    }

    const hasView = perms.userHasViewAccess(permissionMap, role);
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
