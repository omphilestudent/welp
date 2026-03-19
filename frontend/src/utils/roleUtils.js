export const isWelpStaff = (user) => {
  if (!user) return false;
  if (user.isWelpStaff) return true;
  if (user.staffRoleKey) return true;
  const role = String(user.role || '').toLowerCase();
  return ['admin', 'super_admin', 'superadmin', 'system_admin', 'hr_admin', 'welp_employee'].includes(role);
};

export const isWelpAdmin = (user) => {
  if (!user) return false;
  const staffRole = String(user.staffRoleKey || '').toLowerCase();
  if (['admin', 'super_admin', 'hr_admin', 'kodi_admin'].includes(staffRole)) return true;
  const role = String(user.role || '').toLowerCase();
  return ['admin', 'super_admin', 'superadmin', 'system_admin', 'hr_admin'].includes(role);
};
