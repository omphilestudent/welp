import React from 'react';

const OPERATORS = [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not equals' },
    { value: 'exists', label: 'Exists' },
    { value: 'not_exists', label: 'Not exists' },
    { value: 'contains', label: 'Contains' },
    { value: 'in', label: 'In list' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' }
];

const VisibilityRuleEditor = ({ value, onChange }) => {
    const rule = value || {};
    const update = (patch) => {
        onChange({ ...rule, ...patch });
    };

    return (
        <div className="kodi-config__section">
            <h4>Visibility Rules</h4>
            <label className="kodi-config__field">
                Field
                <input
                    type="text"
                    value={rule.field || ''}
                    onChange={(event) => update({ field: event.target.value })}
                    placeholder="subscription.status"
                />
            </label>
            <label className="kodi-config__field">
                Operator
                <select value={rule.operator || 'equals'} onChange={(event) => update({ operator: event.target.value })}>
                    {OPERATORS.map((op) => (
                        <option key={op.value} value={op.value}>
                            {op.label}
                        </option>
                    ))}
                </select>
            </label>
            <label className="kodi-config__field">
                Value
                <input
                    type="text"
                    value={rule.value ?? ''}
                    onChange={(event) => update({ value: event.target.value })}
                    placeholder="active"
                />
            </label>
        </div>
    );
};

export default VisibilityRuleEditor;
