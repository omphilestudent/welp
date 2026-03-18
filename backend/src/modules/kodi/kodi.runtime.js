const service = require('./kodi.service');
const perms = require('./kodi.permissions');

const buildRuntimePayload = async ({ pageId, role }) => {
    const page = await service.getPageById(pageId);
    if (!page) {
        return null;
    }

    const permissionRows = await service.listPermissions(pageId);
    const permissionMap = perms.formatPermissions(permissionRows);

    const hasView = perms.userHasViewAccess(permissionMap, role);
    if (!hasView) {
        throw new Error('Access denied');
    }

    return {
        layout: page.layout,
        components: [],
        permissions: permissionMap,
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
