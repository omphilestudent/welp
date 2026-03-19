const { body, param } = require('express-validator');
const { validate } = require('../../middleware/validation');

const isUuid = (value) => {
    if (value === undefined || value === null) return false;
    const str = String(value);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
};

const appIdValidator = validate([param('id').custom(isUuid)]);

const createAppValidators = validate([
    body('name').trim().isLength({ min: 2 }),
    body('label').optional().trim(),
    body('description').optional().trim(),
    body('icon').optional().trim()
]);

const updateAppValidators = validate([
    param('id').custom(isUuid),
    body('name').optional().trim().isLength({ min: 2 }),
    body('label').optional().trim(),
    body('description').optional().trim(),
    body('icon').optional().trim()
]);

const isUuidOrInt = (value) => isUuid(value) || /^\d+$/.test(String(value));

const settingsValidators = validate([
    param('id').custom(isUuid),
    body('themeConfig').optional().isObject(),
    body('navigationMode').optional().isIn(['sidebar', 'top', 'compact']),
    body('landingBehavior').optional().isIn(['default_page', 'last_visited']),
    body('defaultPageId').optional().custom(isUuidOrInt),
    body('settings').optional().isObject()
]);

const assignUserValidators = validate([
    param('id').custom(isUuid),
    body('email').isEmail().normalizeEmail(),
    body('roleKey').isIn(['admin', 'employee', 'business_user', 'psychologist']),
    body('permissions').optional().isObject(),
    body('permissions.canView').optional().isBoolean(),
    body('permissions.canEdit').optional().isBoolean(),
    body('permissions.canUse').optional().isBoolean()
]);

const updateUserValidators = validate([
    param('id').custom(isUuid),
    param('userId').custom(isUuid),
    body('roleKey').optional().isIn(['admin', 'employee', 'business_user', 'psychologist']),
    body('permissions').optional().isObject(),
    body('permissions.canView').optional().isBoolean(),
    body('permissions.canEdit').optional().isBoolean(),
    body('permissions.canUse').optional().isBoolean()
]);

const updateUserStatusValidators = validate([
    param('id').custom(isUuid),
    param('userId').custom(isUuid),
    body('status').isIn(['pending', 'active', 'disabled'])
]);

const resendInviteValidators = validate([
    param('id').custom(isUuid),
    param('userId').custom(isUuid)
]);

const acceptInviteValidators = validate([
    body('token').isLength({ min: 6 })
]);

const linkPageValidators = validate([
    param('id').custom(isUuid),
    body('pageId').custom(isUuidOrInt),
    body('navLabel').optional().trim(),
    body('navOrder').optional().isInt({ min: 1 }),
    body('isDefault').optional().isBoolean(),
    body('isVisible').optional().isBoolean(),
    body('roleVisibility').optional().isObject()
]);

const updatePageValidators = validate([
    param('id').custom(isUuid),
    param('mappingId').custom(isUuidOrInt),
    body('navLabel').optional().trim(),
    body('navOrder').optional().isInt({ min: 1 }),
    body('isDefault').optional().isBoolean(),
    body('isVisible').optional().isBoolean(),
    body('roleVisibility').optional().isObject()
]);

const reorderValidators = validate([
    param('id').custom(isUuid),
    body('orderedIds').isArray({ min: 1 })
]);

module.exports = {
    appIdValidator,
    createAppValidators,
    updateAppValidators,
    settingsValidators,
    assignUserValidators,
    updateUserValidators,
    updateUserStatusValidators,
    resendInviteValidators,
    acceptInviteValidators,
    linkPageValidators,
    updatePageValidators,
    reorderValidators
};
