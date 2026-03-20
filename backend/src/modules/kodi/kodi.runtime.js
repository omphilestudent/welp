const service = require('./kodi.service');
const perms = require('./kodi.permissions');
const portalService = require('../kodiPortal/kodiPortal.service');
const portalPerms = require('../kodiPortal/kodiPortal.permissions');
const staff = require('../../utils/welpStaff');

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
    const isWelpStaff = userId ? await staff.isWelpStaff(userId) : false;
    if (isWelpStaff && !isAdmin) {
        effectiveRole = 'admin';
    }
    const isBuilderManagedPage = perms.isTimesPage(page);
    // Admins always bypass app membership for Times (builder-managed) pages.
    const adminBypassMembership = (isAdmin || isWelpStaff) && isBuilderManagedPage;

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
    const components = flattenComponents();
    const objectName = service.resolveObjectName(page, components);
    const recordId = service.resolveRecordId(page, components);
    const recordRow = await service.ensureObjectRecord({
        objectName,
        recordId,
        ownerId: userId
    });
    const record = recordRow?.record || {};
    if (userId && recordRow?.id) {
        await service.trackRecentItem({
            userId,
            objectName,
            recordId: recordRow.id,
            label: record?.name || record?.title || page.label
        });
    }
    const activities = recordRow?.id
        ? await service.listRecordActivities({ objectName, recordId: recordRow.id })
        : [];
    const notes = recordRow?.id
        ? await service.listRecordNotes({ objectName, recordId: recordRow.id })
        : [];
    const links = recordRow?.id
        ? await service.listRecordLinks({ objectName, recordId: recordRow.id })
        : [];
    const recentItems = await service.listRecentItems({ userId });
    const utilities = appContextId ? await service.listAppUtilities(appContextId) : [];

    const relatedMap = {};
    await Promise.all(
        components
            .filter((component) => component.component_type === 'RelatedList')
            .map(async (component) => {
                const relatedObject = component?.props?.relatedObject || component?.props?.dataSource;
                const relatedField = component?.props?.relatedField || 'parent_id';
                if (!relatedObject) return;
                const items = await service.listRelatedRecords({
                    objectName,
                    recordId: recordRow?.id,
                    relatedObject,
                    relatedField
                });
                relatedMap[component.instanceId || component.id || relatedObject] = items;
            })
    );

    return {
        page,
        layout: page.layout,
        components,
        permissions: permissionMap,
        registry: componentRegistry,
        objects,
        record,
        recordContext: {
            objectName,
            recordId: recordRow?.id || null
        },
        activity: activities,
        related: relatedMap,
        utilities: {
            items: utilities,
            notes,
            links,
            recent: recentItems
        },
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
            activatedAt: page.activated_at,
            object: objects.find((obj) => obj.name === objectName) || null
        }
    };
};

module.exports = {
    buildRuntimePayload
};
