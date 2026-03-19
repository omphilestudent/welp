const formatPermissions = (rows) => {
    const map = {};
    for (const row of rows) {
        map[row.role] = {
            can_view: row.can_view,
            can_edit: row.can_edit,
            can_use: row.can_use
        };
    }
    return map;
};

const normalizeRole = (value) => String(value || '').toLowerCase().trim();
const ADMIN_ALIASES = new Set(['admin', 'super_admin', 'superadmin', 'system_admin', 'hr_admin']);

const resolveRole = (role) => {
    const normalized = normalizeRole(role);
    if (ADMIN_ALIASES.has(normalized)) return 'admin';
    return normalized;
};

const userHasViewAccess = (permissionMap, role) => {
    const resolvedRole = resolveRole(role);
    if (!permissionMap || Object.keys(permissionMap).length === 0) {
        return resolvedRole === 'admin';
    }
    if (!resolvedRole) return false;
    const entry = permissionMap[resolvedRole];
    return Boolean(entry?.can_view);
};

module.exports = {
    formatPermissions,
    userHasViewAccess
};
