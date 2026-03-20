import React from 'react';
import './PanelHighlight.css';

const normalizeFields = (fields) => {
    if (!fields) return [];
    if (Array.isArray(fields)) {
        return fields.map((field) => {
            if (typeof field === 'string') {
                return { key: field, label: field };
            }
            if (typeof field === 'object' && field) {
                return {
                    key: field.key || field.binding || field.field || field.name,
                    label: field.label || field.key || field.binding,
                    type: field.type || 'text',
                    editable: field.editable ?? false
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

const PanelHighlight = ({ props = {}, record = {}, canEdit, onAction }) => {
    const {
        title = 'Record',
        subtitle = 'Object',
        fields = [],
        actions = [],
        iconActions = [],
        iconColor = '#22c55e',
        icon = '●'
    } = props;

    const resolvedFields = normalizeFields(fields);
    const resolvedActions = (actions.length ? actions : ['Submit for Approval', 'New Event', 'Change Owner']).map((action) => {
        if (typeof action === 'string') return { label: action };
        return action;
    });
    const overflowAction = resolvedActions.find((action) => action.variant === 'overflow');
    const primaryActions = resolvedActions.filter((action) => action.variant !== 'overflow');

    return (
        <section className="kodi-panel-highlight">
            <div className="kodi-panel-highlight__left">
                <div className="kodi-panel-highlight__icon" style={{ background: iconColor }}>
                    {icon}
                </div>
                <div className="kodi-panel-highlight__identity">
                    <span className="kodi-panel-highlight__label">{subtitle}</span>
                    <strong className="kodi-panel-highlight__title">{title}</strong>
                </div>
            </div>
            <div className="kodi-panel-highlight__summary">
                {resolvedFields.map((field) => (
                    <div key={field.key} className="kodi-panel-highlight__summary-field">
                        <span>{field.label}</span>
                        <strong>{getValueByPath(record, field.key) ?? '—'}</strong>
                    </div>
                ))}
            </div>
            <div className="kodi-panel-highlight__actions">
                <div className="kodi-panel-highlight__action-group">
                    {primaryActions.map((action) => (
                        <button key={action.label} type="button" onClick={() => onAction?.(action)}>
                            {action.label}
                        </button>
                    ))}
                    {overflowAction && (
                        <button type="button" className="kodi-panel-highlight__overflow" onClick={() => onAction?.(overflowAction)}>
                            {overflowAction.label || '⋯'}
                        </button>
                    )}
                </div>
                <div className="kodi-panel-highlight__icon-actions">
                    {(iconActions.length ? iconActions : [{ label: '☆' }, { label: 'Follow' }]).map((action) => (
                        <button key={action.label || action} type="button" onClick={() => onAction?.(action)}>
                            {action.icon || action.label || action}
                        </button>
                    ))}
                </div>
                {canEdit === false && <span className="kodi-panel-highlight__note">Read-only access</span>}
            </div>
        </section>
    );
};

export default PanelHighlight;
