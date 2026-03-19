import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ResizeHandle from './ResizeHandle';

const GRID_COLUMNS = 12;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const resolvePreviewKey = (component) =>
    component?.component_type
    || component?.componentName
    || component?.component_name
    || component?.name
    || '';

const BuilderCanvas = ({
    layout,
    selected,
    onSelectComponent,
    onLayoutChange,
    onComponentDrop,
    onRemoveComponent,
    previewRole,
    previewContext
}) => {
    const canvasRef = useRef(null);
    const [dragOver, setDragOver] = useState(null);
    const [resizeState, setResizeState] = useState(null);

    const handleDragStart = (event, position) => {
        event.dataTransfer.setData('kodi-component-instance', JSON.stringify(position));
        event.dataTransfer.effectAllowed = 'move';
    };

    const handleDrop = (event, rowIndex, colIndex, targetIndex) => {
        event.preventDefault();
        const instancePayload = event.dataTransfer.getData('kodi-component-instance');
        const libraryPayload = event.dataTransfer.getData('kodi-component-library');
        if (instancePayload) {
            onComponentDrop?.({
                source: JSON.parse(instancePayload),
                target: { rowIndex, colIndex, targetIndex }
            });
        } else if (libraryPayload) {
            onComponentDrop?.({
                source: null,
                target: { rowIndex, colIndex, targetIndex },
                component: JSON.parse(libraryPayload)
            });
        }
        setDragOver(null);
    };

    const handleResize = useCallback((event) => {
        if (!resizeState) return;
        event.preventDefault();
        const { start, component, position, type } = resizeState;
        const deltaX = event.clientX - start.x;
        const deltaY = event.clientY - start.y;
        const colWidth = 56;
        const rowHeight = 48;
        let nextWidth = component.layout?.width || 6;
        let nextHeight = component.layout?.height || 2;
        if (type === 'width' || type === 'both') {
            nextWidth = clamp(
                nextWidth + Math.round(deltaX / colWidth),
                component.layout?.minWidth || 2,
                component.layout?.maxWidth || GRID_COLUMNS
            );
        }
        if (type === 'height' || type === 'both') {
            nextHeight = clamp(nextHeight + Math.round(deltaY / rowHeight), 1, 12);
        }
        onLayoutChange?.((draft) => {
            const target = draft.rows[position.rowIndex]?.columns[position.colIndex]?.components[position.compIndex];
            if (!target) return;
            target.layout = { ...target.layout, width: nextWidth, height: nextHeight };
        });
    }, [resizeState, onLayoutChange]);

    const stopResize = useCallback(() => {
        if (resizeState) setResizeState(null);
    }, [resizeState]);

    useEffect(() => {
        if (!resizeState) return undefined;
        window.addEventListener('mousemove', handleResize);
        window.addEventListener('mouseup', stopResize);
        return () => {
            window.removeEventListener('mousemove', handleResize);
            window.removeEventListener('mouseup', stopResize);
        };
    }, [handleResize, stopResize, resizeState]);

    const gridTemplate = useMemo(() => `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`, []);
    const hasPermission = (component) => {
        const roles = component?.permissions?.roles;
        if (!previewRole || !roles || roles.length === 0) return true;
        return roles.includes(previewRole);
    };

    const getRecordValue = (record, field) => {
        if (!record || !field) return null;
        return field.split('.').reduce((acc, part) => (acc ? acc[part] : null), record);
    };

    const formatValue = (value) => {
        if (value === null || value === undefined) return '—';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        return String(value);
    };

    const resolveRecord = (component) => {
        const bindingObject = component?.binding?.object;
        const recordMap = previewContext?.records || {};
        if (bindingObject && recordMap[bindingObject]) {
            return recordMap[bindingObject][0] || previewContext?.record || {};
        }
        return previewContext?.record || {};
    };

    const resolveFields = (component, record) => {
        const bindingField = component?.binding?.field;
        const bindingObject = component?.binding?.object;
        const objectList = previewContext?.objects || [];
        const objectFields = bindingObject
            ? objectList.find((obj) => obj.name === bindingObject)?.fields || []
            : previewContext?.object?.fields || [];
        const propsFields = component?.props?.fields;
        let fields = [];
        if (Array.isArray(propsFields) && propsFields.length) {
            fields = propsFields;
        } else if (bindingField) {
            fields = [bindingField];
        } else {
            fields = Object.keys(record || {}).filter((key) => key !== 'id').slice(0, 5);
        }
        return fields.map((field) => {
            const fieldMeta = objectFields.find((item) => item.field_name === field);
            return {
                label: fieldMeta?.label || fieldMeta?.field_name || field,
                value: formatValue(getRecordValue(record, field))
            };
        });
    };

    const resolveTable = (component, record) => {
        const items = component?.props?.items;
        if (Array.isArray(items) && items.length) {
            const headers = Object.keys(items[0]).slice(0, 3);
            const rows = items.slice(0, 4).map((item) => headers.map((header) => formatValue(item[header])));
            return { headers, rows };
        }
        const keys = Object.keys(record || {}).filter((key) => key !== 'id').slice(0, 3);
        const headers = keys.length ? keys : ['Item', 'Status', 'Owner'];
        const rows = Array.from({ length: 3 }).map((_, index) =>
            headers.map((header) => `${formatValue(getRecordValue(record, header))}` || `${header} ${index + 1}`)
        );
        return { headers, rows };
    };

    const renderPreview = (component) => {
        const previewKey = resolvePreviewKey(component);
        const record = resolveRecord(component);
        const fields = resolveFields(component, record);
        const bindingObject = component?.binding?.object;
        const objectList = previewContext?.objects || [];
        const objectLabel = bindingObject
            ? (objectList.find((obj) => obj.name === bindingObject)?.label || bindingObject)
            : (previewContext?.object?.label || previewContext?.object?.name || 'Record');
        const actions = component?.actions?.length ? component.actions : component?.props?.actions || [];
        const table = resolveTable(component, record);

        switch (previewKey) {
            case 'RecordDetails':
            case 'KeyValueFields':
                return (
                    <div className="kodi-builder__preview kodi-builder__preview--record">
                        <div className="kodi-builder__preview-header">
                            <div>
                                <p className="kodi-builder__preview-eyebrow">{objectLabel}</p>
                                <h4>{component.label || 'Record Details'}</h4>
                            </div>
                            <span className="kodi-builder__preview-badge">Live</span>
                        </div>
                        <div className="kodi-builder__preview-grid">
                            {fields.map((field) => (
                                <div key={field.label} className="kodi-builder__preview-row">
                                    <span>{field.label}</span>
                                    <strong>{field.value}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'HighlightsPanel':
                return (
                    <div className="kodi-builder__preview kodi-builder__preview--highlights">
                        <div className="kodi-builder__preview-header">
                            <h4>{component.label || 'Highlights'}</h4>
                            <span className="kodi-builder__preview-pill">Today</span>
                        </div>
                        <div className="kodi-builder__preview-pills">
                            {fields.slice(0, 3).map((field) => (
                                <span key={field.label}>{field.label}: {field.value}</span>
                            ))}
                        </div>
                        <div className="kodi-builder__preview-actions">
                            {(actions.length ? actions : ['Send Email', 'Assign', 'Review']).map((action) => (
                                <button key={action} type="button">{action}</button>
                            ))}
                        </div>
                    </div>
                );
            case 'RelatedList':
            case 'DataTable':
                return (
                    <div className="kodi-builder__preview kodi-builder__preview--table">
                        <div className="kodi-builder__preview-header">
                            <h4>{component.label || 'Related Records'}</h4>
                            <span className="kodi-builder__preview-badge">{table.rows.length} rows</span>
                        </div>
                        <div className="kodi-builder__preview-table">
                            <div className="kodi-builder__preview-table-head">
                                {table.headers.map((header) => (
                                    <span key={header}>{header}</span>
                                ))}
                            </div>
                            {table.rows.map((row, idx) => (
                                <div key={`${row[0]}-${idx}`} className="kodi-builder__preview-table-row">
                                    {row.map((cell) => (
                                        <span key={cell}>{cell}</span>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'ActivityTimeline':
                return (
                    <div className="kodi-builder__preview kodi-builder__preview--timeline">
                        <div className="kodi-builder__preview-header">
                            <h4>{component.label || 'Activity Timeline'}</h4>
                            <span className="kodi-builder__preview-pill">Last 7 days</span>
                        </div>
                        <ul className="kodi-builder__preview-timeline">
                            {(component.props?.items || [
                                `Updated ${fields[0]?.value || 'record'}`,
                                `Follow-up scheduled`,
                                `Note added to account`
                            ]).map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </div>
                );
            case 'ContactProfile':
            case 'EmployeePanel':
            case 'PsychologistProfile':
            case 'BusinessInfoPanel':
                return (
                    <div className="kodi-builder__preview kodi-builder__preview--profile">
                        <div className="kodi-builder__preview-header">
                            <h4>{component.label || 'Profile'}</h4>
                            <span className="kodi-builder__preview-badge">Active</span>
                        </div>
                        <div className="kodi-builder__preview-profile">
                            <div className="kodi-builder__preview-avatar">{(fields[0]?.value || 'A')[0]}</div>
                            <div>
                                <strong>{fields[0]?.value || 'Profile Name'}</strong>
                                <span>{fields[1]?.value || 'Role'}</span>
                            </div>
                        </div>
                        <div className="kodi-builder__preview-grid">
                            {fields.slice(2, 5).map((field) => (
                                <div key={field.label} className="kodi-builder__preview-row">
                                    <span>{field.label}</span>
                                    <strong>{field.value}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            case 'SubscriptionOverview':
            case 'AccountSummary':
            case 'LeadSummary':
            case 'OpportunitySummary':
            case 'ApplicationStatusPanel':
                return (
                    <div className="kodi-builder__preview kodi-builder__preview--summary">
                        <div className="kodi-builder__preview-header">
                            <h4>{component.label || 'Summary'}</h4>
                            <span className="kodi-builder__preview-badge">On Track</span>
                        </div>
                        <div className="kodi-builder__preview-pills">
                            {fields.slice(0, 3).map((field) => (
                                <span key={field.label}>{field.label}: {field.value}</span>
                            ))}
                        </div>
                        <div className="kodi-builder__preview-actions">
                            {(actions.length ? actions : ['View', 'Update']).map((action) => (
                                <button key={action} type="button">{action}</button>
                            ))}
                        </div>
                    </div>
                );
            case 'QuickActionsBar':
            case 'ActionButton':
            case 'SendEmailButton':
            case 'AssignPsychologistButton':
            case 'ApproveRejectPanel':
                return (
                    <div className="kodi-builder__preview kodi-builder__preview--actions">
                        <div className="kodi-builder__preview-header">
                            <h4>{component.label || 'Actions'}</h4>
                            <span className="kodi-builder__preview-pill">Ready</span>
                        </div>
                        <div className="kodi-builder__preview-actions">
                            {(actions.length ? actions : ['Primary Action']).map((action) => (
                                <button key={action} type="button">{action}</button>
                            ))}
                        </div>
                    </div>
                );
            case 'LinkList':
                return (
                    <div className="kodi-builder__preview kodi-builder__preview--links">
                        <div className="kodi-builder__preview-header">
                            <h4>{component.label || 'Links'}</h4>
                        </div>
                        <div className="kodi-builder__preview-links">
                            {(component.props?.links || fields.slice(0, 3).map((f) => f.label)).map((link) => (
                                <div key={link} className="kodi-builder__preview-link">{link}</div>
                            ))}
                        </div>
                    </div>
                );
            case 'CardList':
                return (
                    <div className="kodi-builder__preview kodi-builder__preview--cards">
                        <div className="kodi-builder__preview-header">
                            <h4>{component.label || 'Cards'}</h4>
                        </div>
                        <div className="kodi-builder__preview-cards">
                            {(component.props?.cards || fields.slice(0, 2)).map((card) => (
                                <div key={card.title || card.label} className="kodi-builder__preview-card">
                                    <strong>{card.title || card.label}</strong>
                                    <span>{card.meta || card.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            default:
                return (
                    <div className="kodi-builder__preview kodi-builder__preview--placeholder">
                        <div className="kodi-builder__preview-title">{component.label || previewKey || 'Component'}</div>
                        <div className="kodi-builder__preview-text">Bind fields to preview live data.</div>
                    </div>
                );
        }
    };

    return (
        <section className="kodi-builder__canvas" ref={canvasRef}>
            {(layout?.rows || []).map((row, rowIndex) => {
                const orientation = row.orientation || layout.orientation || 'horizontal';
                return (
                    <div key={row.id || rowIndex} className={`kodi-builder__row kodi-builder__row--${orientation}`}>
                        {(row.columns || []).map((column, colIndex) => (
                            <div
                                key={column.id || `${rowIndex}-${colIndex}`}
                                className={`kodi-builder__column ${dragOver === `${rowIndex}-${colIndex}` ? 'is-over' : ''}`}
                                onDragOver={(event) => event.preventDefault()}
                                onDragEnter={() => setDragOver(`${rowIndex}-${colIndex}`)}
                                onDragLeave={() => setDragOver(null)}
                                onDrop={(event) => handleDrop(event, rowIndex, colIndex, (column.components || []).length)}
                            >
                                <div
                                    className="kodi-builder__column-grid"
                                    style={{ gridTemplateColumns: gridTemplate }}
                                >
                                    {(column.components || []).map((component, compIndex) => {
                                        const layoutConfig = component.layout || {};
                                        const isSelected = selected?.instanceId === component.instanceId;
                                        const gridColumn = `span ${layoutConfig.width || 6}`;
                                        const gridRow = `span ${layoutConfig.height || 2}`;
                                        return (
                                            <div
                                                key={component.instanceId || `${rowIndex}-${colIndex}-${compIndex}`}
                                                className={`kodi-builder__component ${isSelected ? 'is-selected' : ''} ${!hasPermission(component) ? 'is-hidden' : ''}`}
                                                style={{ gridColumn, gridRow }}
                                                draggable
                                                onDragStart={(event) =>
                                                    handleDragStart(event, { rowIndex, colIndex, compIndex })
                                                }
                                                onClick={() => onSelectComponent?.(component, { rowIndex, colIndex, compIndex })}
                                                onDrop={(event) => handleDrop(event, rowIndex, colIndex, compIndex)}
                                                onDragOver={(event) => event.preventDefault()}
                                            >
                                                <div className="kodi-builder__component-header">
                                                    <strong>{component.label || component.name}</strong>
                                                    <div className="kodi-builder__component-actions">
                                                        <span>{component.component_type}</span>
                                                        <button
                                                            type="button"
                                                            className="kodi-builder__component-delete"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                onRemoveComponent?.({ rowIndex, colIndex, compIndex });
                                                            }}
                                                            title="Remove component"
                                                        >
                                                            x
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="kodi-builder__component-body">
                                                    {hasPermission(component)
                                                        ? renderPreview(component)
                                                        : <p>Hidden by permissions</p>}
                                                </div>
                                                <ResizeHandle
                                                    direction="width"
                                                    onResizeStart={(start) =>
                                                        setResizeState({
                                                            start,
                                                            component,
                                                            position: { rowIndex, colIndex, compIndex },
                                                            type: 'width'
                                                        })
                                                    }
                                                />
                                                <ResizeHandle
                                                    direction="height"
                                                    onResizeStart={(start) =>
                                                        setResizeState({
                                                            start,
                                                            component,
                                                            position: { rowIndex, colIndex, compIndex },
                                                            type: 'height'
                                                        })
                                                    }
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                                {(column.components || []).length === 0 && (
                                    <div className="kodi-builder__column-empty">Drop components here</div>
                                )}
                            </div>
                        ))}
                    </div>
                );
            })}
        </section>
    );
};

export default BuilderCanvas;
