import React from 'react';

const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString();
};

const AppUsersTable = ({ users, onRoleChange, onStatusChange, onResend, onRemove }) => (
    <div className="kodi-portal-table kodi-portal-users-table">
        <div className="kodi-portal-table__row header user expanded">
            <span>User</span>
            <span>Role</span>
            <span>Status</span>
            <span>Invite</span>
            <span>Permissions</span>
            <span>Actions</span>
        </div>
        {users.map((user) => (
            <div key={user.id} className="kodi-portal-table__row user expanded">
                <div className="kodi-portal-user-cell">
                    <div className="kodi-portal-user-avatar">
                        {(user.display_name || user.email || '?').slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                        <div className="kodi-portal-user-name">{user.display_name || 'No name set'}</div>
                        <div className="kodi-portal-user-email">{user.email}</div>
                        <div className="kodi-portal-user-meta">
                            <span>Global role: {user.role || 'n/a'}</span>
                            <span>Staff role: {user.staff_role_key || user.staffRoleKey || '—'}</span>
                            <span>User ID: {user.user_id || user.id}</span>
                        </div>
                    </div>
                </div>
                <div className="kodi-portal-user-role">
                    <select value={user.role_key || 'employee'} onChange={(e) => onRoleChange(user, e.target.value)}>
                        <option value="employee">Internal employee</option>
                        <option value="business_user">External user</option>
                    </select>
                    <span className="kodi-portal-role-pill">
                        {user.role_key === 'business_user' ? 'External user' : 'Internal employee'}
                    </span>
                </div>
                <div className="kodi-portal-user-status">
                    <span className={`status-pill ${user.status}`}>{user.status}</span>
                    <div className="kodi-portal-user-meta">
                        <span>Accepted: {formatDate(user.accepted_at)}</span>
                        <span>Disabled: {formatDate(user.disabled_at)}</span>
                    </div>
                </div>
                <div className="kodi-portal-user-invite">
                    <div className="kodi-portal-user-meta">
                        <span>Invited: {formatDate(user.invited_at)}</span>
                        <span>Token: {user.invite_token ? 'Active' : '—'}</span>
                    </div>
                </div>
                <div className="kodi-portal-user-perms">
                    <div className="kodi-portal-perm-row">
                        <span>View</span>
                        <span className={user.permissions?.canView ? 'pill-good' : 'pill-muted'}>
                            {user.permissions?.canView ? 'Yes' : 'No'}
                        </span>
                    </div>
                    <div className="kodi-portal-perm-row">
                        <span>Edit</span>
                        <span className={user.permissions?.canEdit ? 'pill-good' : 'pill-muted'}>
                            {user.permissions?.canEdit ? 'Yes' : 'No'}
                        </span>
                    </div>
                    <div className="kodi-portal-perm-row">
                        <span>Use</span>
                        <span className={user.permissions?.canUse ? 'pill-good' : 'pill-muted'}>
                            {user.permissions?.canUse ? 'Yes' : 'No'}
                        </span>
                    </div>
                </div>
                <div className="kodi-portal-table__actions">
                    <button className="btn-text" onClick={() => onStatusChange(user, user.status === 'disabled' ? 'active' : 'disabled')}>
                        {user.status === 'disabled' ? 'Enable' : 'Disable'}
                    </button>
                    <button className="btn-text" onClick={() => onResend(user)}>Resend Invite</button>
                    <button className="btn-text danger" onClick={() => onRemove(user)}>Remove</button>
                </div>
            </div>
        ))}
        {users.length === 0 && <p className="kodi-portal-empty">No users assigned.</p>}
    </div>
);

export default AppUsersTable;
