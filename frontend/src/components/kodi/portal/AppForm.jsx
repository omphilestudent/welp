import React from 'react';

const AppForm = ({ value, onChange }) => (
    <div className="kodi-portal-form">
        <label>
            App name
            <input
                type="text"
                value={value.name || ''}
                onChange={(event) => onChange({ ...value, name: event.target.value })}
                placeholder="Employee Operations"
            />
        </label>
        <label>
            App label
            <input
                type="text"
                value={value.label || ''}
                onChange={(event) => onChange({ ...value, label: event.target.value })}
                placeholder="Employee Operations"
            />
        </label>
        <label>
            Description
            <textarea
                rows={3}
                value={value.description || ''}
                onChange={(event) => onChange({ ...value, description: event.target.value })}
                placeholder="Describe the app purpose"
            />
        </label>
        <label>
            Icon (URL)
            <input
                type="text"
                value={value.icon || ''}
                onChange={(event) => onChange({ ...value, icon: event.target.value })}
                placeholder="https://..."
            />
        </label>
    </div>
);

export default AppForm;
