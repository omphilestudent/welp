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

const userHasViewAccess = (permissionMap, role) => {
    if (!permissionMap || Object.keys(permissionMap).length === 0) {
        return role === 'admin';
    }
    if (!role) return false;
    const entry = permissionMap[role];
    return Boolean(entry?.can_view);
};

module.exports = {
    formatPermissions,
    userHasViewAccess
};
