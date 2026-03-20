import React from 'react';
import PanelHighlight from './components/PanelHighlight';

const normalizeActions = (component) => {
    const raw = component?.actions || component?.props?.actions;
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return raw.map((action) => {
            if (typeof action === 'string') {
                return { label: action };
            }
            if (typeof action === 'object' && action) {
                return {
                    label: action.label || action.title || action.name || 'Action',
                    ...action
                };
            }
            return null;
        }).filter(Boolean);
    }
    return [];
};

const getValueByPath = (obj, path) => {
    if (!obj || !path) return null;
    return path.split('.').reduce((acc, part) => (acc ? acc[part] : null), obj);
};

const hasPermission = (component, role) => {
    const allowed = component?.permissions?.roles;
    if (!allowed || allowed.length === 0) return true;
    return allowed.includes(role);
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
            return Array.isArray(target)
                ? target.includes(value)
                : String(target || '').split(',').map((v) => v.trim()).includes(String(value));
        case 'greater_than':
            return Number(value) > Number(target);
        case 'less_than':
            return Number(value) < Number(target);
        default:
            return value === target;
    }
};

const normalizeFields = (fields) => {
    if (!fields) return [];
    if (Array.isArray(fields)) {
        return fields.map((field) => {
            if (typeof field === 'string') {
                return { key: field, label: field, type: 'text' };
            }
            if (typeof field === 'object' && field) {
                return {
                    key: field.key || field.binding || field.field || field.name,
                    label: field.label || field.key || field.binding || 'Field',
                    type: field.type || 'text',
                    editable: field.editable ?? false,
                    required: field.required ?? false,
                    visible: field.visible ?? true,
                    placeholder: field.placeholder,
                    options: field.options || [],
                    helpText: field.helpText,
                    width: field.width || field.span
                };
            }
            return null;
        }).filter(Boolean);
    }
    return [];
};

const renderFieldValue = (value, type) => {
    if (value === null || value === undefined) return '—';
    if (type === 'checkbox') return value ? 'Yes' : 'No';
    return String(value);
};

const FieldRow = ({ field, value, canEdit, onChange }) => {
    const isEditable = Boolean(canEdit && field.editable);
    if (!isEditable) {
        return (
            <div className="kodi-runtime__field">
                <span>{field.label}{field.required ? ' *' : ''}</span>
                <strong>{renderFieldValue(value, field.type)}</strong>
            </div>
        );
    }

    if (field.type === 'checkbox') {
        return (
            <div className="kodi-runtime__field">
                <span>{field.label}{field.required ? ' *' : ''}</span>
                <label className="kodi-runtime__checkbox">
                    <input
                        type="checkbox"
                        checked={Boolean(value)}
                        required={field.required}
                        onChange={(event) => onChange(event.target.checked)}
                    />
                    <span>{field.helpText || (value ? 'Enabled' : 'Disabled')}</span>
                </label>
            </div>
        );
    }

    if (field.type === 'select' || field.type === 'multi-select') {
        const options = Array.isArray(field.options) ? field.options : [];
        return (
            <div className="kodi-runtime__field">
                <span>{field.label}{field.required ? ' *' : ''}</span>
                <select
                    value={value || ''}
                    multiple={field.type === 'multi-select'}
                    required={field.required}
                    onChange={(event) => {
                        if (field.type === 'multi-select') {
                            const selected = Array.from(event.target.selectedOptions).map((opt) => opt.value);
                            onChange(selected);
                        } else {
                            onChange(event.target.value);
                        }
                    }}
                >
                    {!field.required && field.type !== 'multi-select' && <option value="">Select</option>}
                    {options.map((option) => {
                        const label = typeof option === 'string' ? option : option.label || option.value;
                        const val = typeof option === 'string' ? option : option.value;
                        return (
                            <option key={val} value={val}>
                                {label}
                            </option>
                        );
                    })}
                </select>
            </div>
        );
    }

    return (
        <div className="kodi-runtime__field">
            <span>{field.label}{field.required ? ' *' : ''}</span>
            <input
                type={(() => {
                    if (field.type === 'number' || field.type === 'currency') return 'number';
                    if (field.type === 'date') return 'date';
                    if (field.type === 'datetime') return 'datetime-local';
                    if (field.type === 'email') return 'email';
                    if (field.type === 'phone') return 'tel';
                    return 'text';
                })()}
                value={value ?? ''}
                required={field.required}
                placeholder={field.placeholder || ''}
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    );
};

const renderDetails = (component, context) => {
    const record = context?.record || {};
    const canEdit = context?.canEdit;
    const onRecordUpdate = context?.onRecordUpdate;
    const sections = component?.props?.sections;
    const fields = normalizeFields(component?.props?.fields);

    return (
        <div className="kodi-runtime__details">
            {Array.isArray(sections) && sections.length > 0 ? (
                sections.map((section, index) => {
                    const sectionFields = normalizeFields(section.fields || []);
                    return (
                        <div key={section.title || index} className="kodi-runtime__details-section">
                            <div className="kodi-runtime__details-section-header">
                                <h4>{section.title || `Section ${index + 1}`}</h4>
                                {section.collapsible && <span className="kodi-runtime__details-toggle">▾</span>}
                            </div>
                            <div className="kodi-runtime__details-grid">
                                {sectionFields.filter((field) => field.visible !== false).map((field) => (
                                    <FieldRow
                                        key={field.key}
                                        field={field}
                                        value={getValueByPath(record, field.key)}
                                        canEdit={canEdit}
                                        onChange={(value) => onRecordUpdate?.(field.key, value)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })
            ) : (
                <div className="kodi-runtime__details-grid">
                    {fields.filter((field) => field.visible !== false).map((field) => (
                        <FieldRow
                            key={field.key}
                            field={field}
                            value={getValueByPath(record, field.key)}
                            canEdit={canEdit}
                            onChange={(value) => onRecordUpdate?.(field.key, value)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const renderActivity = (component, context) => {
    const items = context?.activity || component?.props?.items || [];
    const tabs = component?.props?.tabs || ['Activity', 'Chatter', 'Email'];
    const actions = component?.props?.actions || ['Log Call', 'New Task', 'Email'];
    return (
        <div className="kodi-runtime__activity">
            <div className="kodi-runtime__activity-tabs">
                {tabs.map((tab, index) => (
                    <button key={tab} type="button" className={index === 0 ? 'active' : ''}>
                        {tab}
                    </button>
                ))}
            </div>
            <div className="kodi-runtime__activity-actions">
                {actions.map((action) => (
                    <button key={action.label || action} type="button">
                        {action.label || action}
                    </button>
                ))}
            </div>
            <div className="kodi-runtime__activity-filters">
                <span>Filters: All time • All activities • All types</span>
                <div>
                    <button type="button">Refresh</button>
                    <button type="button">Expand All</button>
                    <button type="button">View All</button>
                </div>
            </div>
            <div className="kodi-runtime__activity-list">
                {(items.length ? items : [{
                    title: 'Follow up scheduled',
                    meta: 'Today • Internal',
                    actor: 'System'
                }]).map((item, index) => (
                    <div key={item.title || index} className="kodi-runtime__activity-item">
                        <div>
                            <strong>{item.title || item.label || 'Activity'}</strong>
                            <p>{item.meta || item.time || 'Recently updated'}</p>
                        </div>
                        <span>{item.actor || item.user || '—'}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const renderComponentBody = (component, context, onAction) => {
    const record = context?.record || {};
    const actions = normalizeActions(component);
    const list = Array.isArray(component.props?.items) ? component.props.items : null;

    switch (component.component_type) {
        case 'HighlightsPanel':
            return (
                <PanelHighlight
                    props={{
                        title: component.props?.title || component.label || 'Record',
                        subtitle: component.props?.subtitle || component.props?.description,
                        fields: component.props?.fields || [],
                        actions: actions.length ? actions : (component.props?.actions || []),
                        iconActions: component.props?.iconActions || [],
                        iconColor: component.props?.iconColor,
                        icon: component.props?.icon
                    }}
                    record={record}
                    canEdit={context?.canEdit}
                    onAction={(action) => onAction?.(action, component, context)}
                />
            );
        case 'RecordDetails':
        case 'KeyValueFields':
            return renderDetails(component, context);
        case 'ContactProfile':
        case 'EmployeePanel':
        case 'PsychologistProfile':
        case 'BusinessInfoPanel':
        case 'SubscriptionOverview':
        case 'AccountSummary':
        case 'LeadSummary':
        case 'OpportunitySummary':
        case 'ApplicationStatusPanel':
            return renderDetails(component, context);
        case 'ActivityTimeline':
            return renderActivity(component, context);
        case 'QuickActionsBar':
            return (
                <div className="kodi-runtime__actions">
                    {(actions.length ? actions : [{ label: 'Primary Action' }]).map((action) => (
                        <button key={action.label} type="button" onClick={() => onAction?.(action, component, context)}>
                            {action.label}
                        </button>
                    ))}
                </div>
            );
        case 'DataTable':
        case 'RelatedList': {
            const fields = normalizeFields(component?.props?.fields || []);
            const relatedKey = component.instanceId || component.id || component?.props?.relatedObject;
            const items = context?.related?.[relatedKey] || list || [];
            return (
                <div className="kodi-runtime__table">
                    {(items || []).length ? (
                        <table>
                            <thead>
                                <tr>
                                    {fields.map((field) => (
                                        <th key={field.key}>{field.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.id}>
                                        {fields.map((field) => (
                                            <td key={field.key}>{getValueByPath(item.record || item, field.key) ?? '—'}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p>No records available.</p>
                    )}
                </div>
            );
        }
        default:
            return (
                <pre className="kodi-runtime__json">
                    {JSON.stringify({ props: component.props || {}, binding: component.binding || {} }, null, 2)}
                </pre>
            );
    }
};

const RuntimeRenderer = ({ layout, context, role, onAction }) => (
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
                                        {Array.isArray(component.props?.headerTabs) ? (
                                            <div className="kodi-runtime__card-tabs">
                                                {component.props.headerTabs.map((tab, index) => (
                                                    <button key={tab} type="button" className={index === 0 ? 'active' : ''}>
                                                        {tab}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <span>{component.component_type}</span>
                                        )}
                                    </div>
                                    {renderComponentBody(component, context, onAction)}
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
