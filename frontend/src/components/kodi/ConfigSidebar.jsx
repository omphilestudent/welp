import React, { useMemo, useState, useEffect } from 'react';
import PermissionEditor from './PermissionEditor';
import VisibilityRuleEditor from './VisibilityRuleEditor';

const ConfigSidebar = ({
    component,
    objects = [],
    onUpdate,
    onClose
}) => {
    const objectOptions = useMemo(() => objects || [], [objects]);
    const selectedObject = objectOptions.find((obj) => obj.name === component?.binding?.object);
    const fields = selectedObject?.fields || [];
    const [propsDraft, setPropsDraft] = useState('');
    const [propsError, setPropsError] = useState('');

    useEffect(() => {
        if (!component) return;
        setPropsDraft(JSON.stringify(component.props || {}, null, 2));
        setPropsError('');
    }, [component]);

    if (!component) {
        return (
            <aside className="kodi-config">
                <div className="kodi-config__empty">
                    <p>Select a component to configure.</p>
                </div>
            </aside>
        );
    }

    const update = (patch) => {
        onUpdate({ ...component, ...patch });
    };

    const updateBinding = (patch) => {
        update({ binding: { ...(component.binding || {}), ...patch } });
    };

    const updateStyle = (patch) => {
        update({ style: { ...(component.style || {}), ...patch } });
    };

    return (
        <aside className="kodi-config">
            <div className="kodi-config__header">
                <div>
                    <p>Configure</p>
                    <h3>{component.label || component.name}</h3>
                </div>
                <button className="btn-text" onClick={onClose}>
                    Close
                </button>
            </div>

            <div className="kodi-config__body">
                <div className="kodi-config__section">
                    <h4>Label</h4>
                    <label className="kodi-config__field">
                        Title
                        <input
                            type="text"
                            value={component.label || ''}
                            onChange={(event) => update({ label: event.target.value })}
                        />
                    </label>
                </div>

                <div className="kodi-config__section">
                    <h4>Data Binding</h4>
                    <label className="kodi-config__field">
                        Object
                        <select
                            value={component.binding?.object || ''}
                            onChange={(event) => updateBinding({ object: event.target.value })}
                        >
                            <option value="">Select object</option>
                            {objectOptions.map((obj) => (
                                <option key={obj.id} value={obj.name}>
                                    {obj.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="kodi-config__field">
                        Field
                        <select
                            value={component.binding?.field || ''}
                            onChange={(event) => updateBinding({ field: event.target.value })}
                        >
                            <option value="">Select field</option>
                            {fields.map((field) => (
                                <option key={field.id || field.field_name} value={field.field_name}>
                                    {field.field_name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="kodi-config__field">
                        Data source
                        <input
                            type="text"
                            value={component.binding?.source || ''}
                            onChange={(event) => updateBinding({ source: event.target.value })}
                            placeholder="/api/contacts"
                        />
                    </label>
                </div>

                <div className="kodi-config__section">
                    <h4>Size</h4>
                    <label className="kodi-config__field">
                        Width (1-12)
                        <input
                            type="number"
                            min={component.layout?.minWidth || 1}
                            max={component.layout?.maxWidth || 12}
                            value={component.layout?.width || 6}
                            onChange={(event) =>
                                update({ layout: { ...component.layout, width: Number(event.target.value) } })
                            }
                        />
                    </label>
                    <label className="kodi-config__field">
                        Min width
                        <input
                            type="number"
                            min={1}
                            max={12}
                            value={component.layout?.minWidth || 2}
                            onChange={(event) =>
                                update({ layout: { ...component.layout, minWidth: Number(event.target.value) } })
                            }
                        />
                    </label>
                    <label className="kodi-config__field">
                        Max width
                        <input
                            type="number"
                            min={1}
                            max={12}
                            value={component.layout?.maxWidth || 12}
                            onChange={(event) =>
                                update({ layout: { ...component.layout, maxWidth: Number(event.target.value) } })
                            }
                        />
                    </label>
                    <label className="kodi-config__field">
                        Height (rows)
                        <input
                            type="number"
                            min={1}
                            max={12}
                            value={component.layout?.height || 2}
                            onChange={(event) =>
                                update({ layout: { ...component.layout, height: Number(event.target.value) } })
                            }
                        />
                    </label>
                </div>

                <VisibilityRuleEditor
                    value={component.visibilityRule}
                    onChange={(rule) => update({ visibilityRule: rule })}
                />

                <PermissionEditor
                    value={component.permissions}
                    onChange={(permissions) => update({ permissions })}
                />

                <div className="kodi-config__section">
                    <h4>Actions & Links</h4>
                    <label className="kodi-config__field">
                        Action labels (comma separated)
                        <input
                            type="text"
                            value={(component.actions || []).join(', ')}
                            onChange={(event) =>
                                update({ actions: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })
                            }
                        />
                    </label>
                    <label className="kodi-config__field">
                        Primary link
                        <input
                            type="text"
                            value={component.link || ''}
                            onChange={(event) => update({ link: event.target.value })}
                            placeholder="https://"
                        />
                    </label>
                </div>

                <div className="kodi-config__section">
                    <h4>Props</h4>
                    <label className="kodi-config__field">
                        Component props (JSON)
                        <textarea
                            rows={6}
                            value={propsDraft}
                            onChange={(event) => {
                                const nextValue = event.target.value;
                                setPropsDraft(nextValue);
                                try {
                                    const parsed = JSON.parse(nextValue || '{}');
                                    setPropsError('');
                                    update({ props: parsed });
                                } catch (error) {
                                    setPropsError('Invalid JSON');
                                }
                            }}
                        />
                    </label>
                    {propsError && <p className="kodi-config__error">{propsError}</p>}
                </div>

                <div className="kodi-config__section">
                    <h4>Style</h4>
                    <label className="kodi-config__field">
                        Background
                        <input
                            type="color"
                            value={component.style?.background || '#ffffff'}
                            onChange={(event) => updateStyle({ background: event.target.value })}
                        />
                    </label>
                    <label className="kodi-config__field">
                        Text color
                        <input
                            type="color"
                            value={component.style?.color || '#1f2b3b'}
                            onChange={(event) => updateStyle({ color: event.target.value })}
                        />
                    </label>
                </div>
            </div>
        </aside>
    );
};

export default ConfigSidebar;
