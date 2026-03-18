const service = require('./kodi.service');
const perms = require('./kodi.permissions');

const buildRuntimePayload = async ({ pageId, role }) => {
    const page = await service.getPageById(pageId);
    if (!page) {
        return null;
    }

    const permissionRows = await service.listPermissions(pageId);
    const permissionMap = perms.formatPermissions(permissionRows);
    const componentRegistry = await service.listComponentRegistry();
    const objects = await service.listObjects();
    const app = page.linked_app_id ? await service.getAppById(page.linked_app_id) : null;

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
