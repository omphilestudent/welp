import React from 'react';

const AppUsersTable = ({ users, onRoleChange, onStatusChange, onResend, onRemove }) => (
    <div className="kodi-portal-table">
        <div className="kodi-portal-table__row header user">
            <span>User</span>
            <span>Role</span>
            <span>Status</span>
            <span>Actions</span>
        </div>
        {users.map((user) => (
            <div key={user.id} className="kodi-portal-table__row user">
                <span>{user.display_name || user.email}</span>
                <select value={user.role_key || 'employee'} onChange={(e) => onRoleChange(user, e.target.value)}>
                    <option value="admin">admin</option>
                    <option value="employee">employee</option>
                    <option value="business_user">business_user</option>
                    <option value="psychologist">psychologist</option>
                </select>
                <span className={`status-pill ${user.status}`}>{user.status}</span>
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
