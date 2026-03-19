const normalizeRole = (value) => String(value || '').toLowerCase().trim();
const ADMIN_ALIASES = new Set(['admin', 'super_admin', 'superadmin', 'system_admin', 'hr_admin']);

const isAdminRole = (role) => ADMIN_ALIASES.has(normalizeRole(role));

const resolveEffectiveRole = ({ appRole, globalRole }) => {
    if (appRole) return normalizeRole(appRole);
    return normalizeRole(globalRole);
};

module.exports = {
    normalizeRole,
    isAdminRole,
    resolveEffectiveRole
};
