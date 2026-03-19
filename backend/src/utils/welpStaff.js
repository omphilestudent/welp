const { query } = require('./database');

const STAFF_ROLE_KEYS = [
  'admin',
  'hr_admin',
  'developer',
  'call_center_agent',
  'kodi_admin',
  'support_agent',
  'operations',
  'welp_employee'
];

const ADMIN_STAFF_ROLES = new Set(['admin', 'super_admin', 'hr_admin', 'kodi_admin']);

const getWelpStaffByUserId = async (userId) => {
  const result = await query(
    `SELECT * FROM welp_staff WHERE user_id = $1 AND is_active = true`,
    [userId]
  );
  return result.rows[0] || null;
};

const isWelpStaff = async (userId) => {
  if (!userId) return false;
  const row = await getWelpStaffByUserId(userId);
  return Boolean(row);
};

const getWelpStaffRole = async (userId) => {
  const row = await getWelpStaffByUserId(userId);
  return row?.staff_role_key || null;
};

const isWelpStaffRoleKey = (roleKey) => STAFF_ROLE_KEYS.includes(String(roleKey || '').toLowerCase());

const isInternalAdminRole = (roleKey) => ADMIN_STAFF_ROLES.has(String(roleKey || '').toLowerCase());

const normalizeUserRole = (role) => String(role || '').toLowerCase().trim();

const isLegacyAdminRole = (role) => ['admin', 'super_admin', 'system_admin', 'hr_admin', 'superadmin'].includes(normalizeUserRole(role));

const enrichUserWithStaff = async (user) => {
  if (!user || !user.id) return user;
  const staff = await getWelpStaffByUserId(user.id);
  return {
    ...user,
    isWelpStaff: Boolean(staff),
    staffRoleKey: staff?.staff_role_key || null,
    staffDepartment: staff?.department || null
  };
};

module.exports = {
  STAFF_ROLE_KEYS,
  getWelpStaffByUserId,
  getWelpStaffRole,
  isWelpStaff,
  isWelpStaffRoleKey,
  isInternalAdminRole,
  isLegacyAdminRole,
  enrichUserWithStaff
};
