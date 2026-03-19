import React, { useState } from 'react';

const AssignUserModal = ({ open, onClose, onSubmit }) => {
    const [email, setEmail] = useState('');
    const [roleKey, setRoleKey] = useState('employee');
    const [permissions, setPermissions] = useState({ canView: true, canEdit: false, canUse: false });

    if (!open) return null;

    return (
        <div className="kodi-portal-modal">
            <div className="kodi-portal-modal__content">
                <div className="kodi-portal-modal__header">
                    <h2>Assign user</h2>
                    <button className="btn-text" onClick={onClose}>Close</button>
                </div>
                <label>
                    Email
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label>
                    Role
                    <select value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
                        <option value="admin">admin</option>
                        <option value="employee">employee</option>
                        <option value="business_user">business_user</option>
                        <option value="psychologist">psychologist</option>
                    </select>
                </label>
                <div className="kodi-portal-checkboxes">
                    <label>
                        <input
                            type="checkbox"
                            checked={permissions.canView}
                            onChange={() => setPermissions((prev) => ({ ...prev, canView: !prev.canView }))}
                        />
                        Can view
                    </label>
                    <label>
                        <input
                            type="checkbox"
                            checked={permissions.canEdit}
                            onChange={() => setPermissions((prev) => ({ ...prev, canEdit: !prev.canEdit }))}
                        />
                        Can edit
                    </label>
                    <label>
                        <input
                            type="checkbox"
                            checked={permissions.canUse}
                            onChange={() => setPermissions((prev) => ({ ...prev, canUse: !prev.canUse }))}
                        />
                        Can use
                    </label>
                </div>
                <button className="btn-primary" onClick={() => onSubmit({ email, roleKey, permissions })}>
                    Send invite
                </button>
            </div>
        </div>
    );
};

export default AssignUserModal;
