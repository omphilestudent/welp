import React from 'react';
import './UserTable.css';

const UserTable = ({ users, selectedUsers, setSelectedUsers, onEdit, onDelete, onResetPassword }) => {
    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedUsers(users.map((u) => u.id));
        else setSelectedUsers([]);
    };

    const handleSelectUser = (userId) => {
        setSelectedUsers((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    return (
        <div className="user-table-container">
            <table className="user-table">
                <thead>
                    <tr>
                        <th><input type="checkbox" onChange={handleSelectAll} checked={selectedUsers.length === users.length && users.length > 0} /></th>
                        <th>User</th>
                        <th>Contact</th>
                        <th>Role</th>
                        <th>Department</th>
                        <th>Status</th>
                        <th>Last Login</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((user) => (
                        <tr key={user.id} className={selectedUsers.includes(user.id) ? 'selected' : ''}>
                            <td><input type="checkbox" checked={selectedUsers.includes(user.id)} onChange={() => handleSelectUser(user.id)} /></td>
                            <td>
                                <div className="user-info">
                                    <div className="user-avatar">
                                        {user.profilePicture ? (
                                            <img src={user.profilePicture} alt={`${user.firstName} ${user.lastName}`} />
                                        ) : (
                                            <div className="avatar-placeholder">{user.firstName?.[0] || '?'}{user.lastName?.[0] || '?'}</div>
                                        )}
                                    </div>
                                    <div className="user-details">
                                        <span className="user-name">{user.firstName} {user.lastName}</span>
                                        <span className="user-email">{user.email}</span>
                                    </div>
                                </div>
                            </td>
                            <td>{user.phoneNumber || '—'}</td>
                            <td><span className="role-badge">{user.Role?.name || 'Unknown'}</span></td>
                            <td>{user.department || '—'}</td>
                            <td>
                                <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>{user.isActive ? 'Active' : 'Inactive'}</span>
                                {!user.emailVerified && <span className="unverified-badge" title="Email not verified">⚠️</span>}
                            </td>
                            <td>{user.lastLogin ? formatDate(user.lastLogin) : 'Never'}</td>
                            <td>
                                <div className="action-buttons">
                                    <button onClick={() => onEdit(user)} className="action-btn edit" title="Edit user">✏️</button>
                                    <button onClick={() => onResetPassword(user.id)} className="action-btn reset" title="Reset password">🔑</button>
                                    <button onClick={() => onDelete(user)} className="action-btn delete" title="Delete user">🗑️</button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {users.length === 0 && <div className="no-data"><p>No users found</p></div>}
        </div>
    );
};

export default UserTable;
