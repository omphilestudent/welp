import React from 'react';

const ROLE_OPTIONS = [
    { id: 'admin', label: 'Admin' },
    { id: 'employee', label: 'Employee' },
    { id: 'business_user', label: 'Business User' },
    { id: 'psychologist', label: 'Psychologist' }
];

const PermissionEditor = ({ value, onChange }) => {
    const roles = new Set(value?.roles || []);
    const toggle = (role) => {
        const next = new Set(roles);
        if (next.has(role)) {
            next.delete(role);
        } else {
            next.add(role);
        }
        onChange({ roles: Array.from(next) });
    };

    return (
        <div className="kodi-config__section">
            <h4>Permissions</h4>
            <div className="kodi-config__checkbox-group">
                {ROLE_OPTIONS.map((role) => (
                    <label key={role.id}>
                        <input
                            type="checkbox"
                            checked={roles.has(role.id)}
                            onChange={() => toggle(role.id)}
                        />
                        {role.label}
                    </label>
                ))}
            </div>
        </div>
    );
};

export default PermissionEditor;
