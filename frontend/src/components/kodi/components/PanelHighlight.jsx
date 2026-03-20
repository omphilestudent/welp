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
        title = 'Highlights',
        subtitle = 'Summary of key fields',
        fields = [],
        actions = [],
        iconActions = []
    } = props;

    const resolvedFields = normalizeFields(fields);

    return (
        <section className="kodi-panel-highlight">
            <div className="kodi-panel-highlight__header">
                <div>
                    <p className="kodi-panel-highlight__eyebrow">{subtitle}</p>
                    <h2>{title}</h2>
                </div>
                <div className="kodi-panel-highlight__icon-actions">
                    {(iconActions.length ? iconActions : [{ label: 'Star' }, { label: 'Follow' }]).map((action) => (
                        <button key={action.label || action} type="button" onClick={() => onAction?.(action)}>
                            {action.icon || action.label || action}
                        </button>
                    ))}
                </div>
            </div>
            <div className="kodi-panel-highlight__fields">
                {resolvedFields.map((field) => (
                    <div key={field.key} className="kodi-panel-highlight__field">
                        <span>{field.label}</span>
                        <strong>{getValueByPath(record, field.key) ?? '—'}</strong>
                    </div>
                ))}
            </div>
            <div className="kodi-panel-highlight__actions">
                {(actions.length ? actions : ['Create Case', 'Assign Case', 'Handover']).map((action) => (
                    <button key={action.label || action} type="button" onClick={() => onAction?.(action)}>
                        {action.label || action}
                    </button>
                ))}
                {canEdit === false && <span className="kodi-panel-highlight__note">Upgrade permissions to edit.</span>}
            </div>
        </section>
    );
};

export default PanelHighlight;
