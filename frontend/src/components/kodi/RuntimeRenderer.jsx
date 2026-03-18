import React from 'react';

const getValueByPath = (obj, path) => {
    if (!obj || !path) return null;
    return path.split('.').reduce((acc, part) => (acc ? acc[part] : null), obj);
};

const evaluateRule = (rule, context) => {
    if (!rule || !rule.field) return true;
    const value = getValueByPath(context, rule.field);
    const target = rule.value;
    switch (rule.operator) {
        case 'not_equals':
            return value !== target;
        case 'exists':
            return value !== null && value !== undefined;
        case 'not_exists':
            return value === null || value === undefined;
        case 'contains':
            return String(value || '').includes(String(target || ''));
        case 'in':
            return Array.isArray(target) ? target.includes(value) : String(target || '').split(',').map((v) => v.trim()).includes(String(value));
        case 'greater_than':
            return Number(value) > Number(target);
        case 'less_than':
            return Number(value) < Number(target);
        default:
            return value === target;
    }
};

const hasPermission = (component, role) => {
    const allowed = component?.permissions?.roles;
    if (!allowed || allowed.length === 0) return true;
    return allowed.includes(role);
};

const renderComponentBody = (component, context) => {
    const binding = component.binding || {};
    const record = context?.record || {};
    const value = binding.field ? getValueByPath(record, binding.field) : null;
    const list = Array.isArray(component.props?.items) ? component.props.items : null;

    switch (component.component_type) {
        case 'EmptyState':
            return <p>{component.props?.message || 'No data available.'}</p>;
        case 'Divider':
            return <hr />;
        case 'Spacer':
            return <div style={{ height: 16 }} />;
        case 'ActionButton':
        case 'SendEmailButton':
        case 'AssignPsychologistButton':
            return <button type="button">{component.label || component.component_type}</button>;
        case 'QuickActionsBar':
            return (
                <div className="kodi-runtime__actions">
                    {(component.actions || ['Primary Action']).map((action) => (
                        <button key={action} type="button">{action}</button>
                    ))}
                </div>
            );
        case 'DataTable':
        case 'RelatedList':
            return (
                <div className="kodi-runtime__table">
                    {(list || []).length ? (
                        list.map((item, index) => <div key={index}>{JSON.stringify(item)}</div>)
                    ) : (
                        <p>No records available.</p>
                    )}
                </div>
            );
        case 'ContactProfile':
        case 'EmployeePanel':
        case 'PsychologistProfile':
        case 'BusinessInfoPanel':
            return (
                <div className="kodi-runtime__profile">
                    <p>{component.props?.subtitle || 'Profile details'}</p>
                    <strong>{value || component.props?.headline || 'Profile summary'}</strong>
                </div>
            );
        case 'SubscriptionOverview':
        case 'AccountSummary':
            return (
                <div className="kodi-runtime__profile">
                    <p>{component.props?.subtitle || 'Account overview'}</p>
                    <strong>{value || component.props?.headline || 'Summary'}</strong>
                </div>
            );
        case 'LeadSummary':
        case 'OpportunitySummary':
        case 'ApplicationStatusPanel':
            return (
                <div className="kodi-runtime__profile">
                    <p>{component.props?.subtitle || 'Pipeline status'}</p>
                    <strong>{component.props?.stage || value || 'In progress'}</strong>
                </div>
            );
        case 'KeyValueFields':
        case 'RecordDetails':
            return (
                <div className="kodi-runtime__kv">
                    <div>
                        <strong>{binding.field || 'Field'}</strong>
                        <span>{value ?? '—'}</span>
                    </div>
                </div>
            );
        case 'ActivityTimeline':
            return (
                <ul>
                    {(list || component.props?.items || ['No activity yet']).map((item, index) => (
                        <li key={index}>{item}</li>
                    ))}
                </ul>
            );
        default:
            return (
                <pre className="kodi-runtime__json">
                    {JSON.stringify({ props: component.props || {}, binding: component.binding || {} }, null, 2)}
                </pre>
            );
    }
};

const RuntimeRenderer = ({ layout, context, role }) => (
    <div className="kodi-runtime__layout">
        {(layout?.rows || []).map((row, rowIndex) => (
            <div key={row.id || rowIndex} className="kodi-runtime__row">
                {(row.columns || []).map((column, colIndex) => (
                    <div key={column.id || `${rowIndex}-${colIndex}`} className="kodi-runtime__column">
                        {(column.components || []).map((component, compIndex) => {
                            if (!hasPermission(component, role)) return null;
                            if (!evaluateRule(component.visibilityRule, context?.record || context || {})) return null;
                            return (
                                <div
                                    key={component.instanceId || `${rowIndex}-${colIndex}-${compIndex}`}
                                    className="kodi-runtime__card"
                                    style={{
                                        background: component.style?.background || '#ffffff',
                                        color: component.style?.color || '#1f2b3b'
                                    }}
                                >
                                    <div className="kodi-runtime__card-header">
                                        <strong>{component.label || component.name}</strong>
                                        <span>{component.component_type}</span>
                                    </div>
                                    {renderComponentBody(component, context)}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        ))}
    </div>
);

export default RuntimeRenderer;
