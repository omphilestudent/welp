import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ResizeHandle from './ResizeHandle';

const GRID_COLUMNS = 12;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const SAMPLE_PREVIEWS = {
    RecordDetails: {
        title: 'Record Details',
        fields: [
            { label: 'Name', value: 'Ava Thompson' },
            { label: 'Email', value: 'ava@kodi.app' },
            { label: 'Status', value: 'Active' },
            { label: 'Last Touch', value: '2 hours ago' }
        ]
    },
    RelatedList: {
        title: 'Related List',
        headers: ['Type', 'Status', 'Owner'],
        rows: [
            ['Case', 'Open', 'J. Rivers'],
            ['Task', 'In Progress', 'T. Patel'],
            ['Note', 'Logged', 'System']
        ]
    },
    ActivityTimeline: {
        title: 'Activity Timeline',
        items: ['Email sent - 10m', 'Call scheduled - 1h', 'Lead converted - 1d']
    },
    HighlightsPanel: {
        title: 'Highlights Panel',
        pills: ['Open Cases: 4', 'ARR: $48k', 'Health: Good']
    },
    DataTable: {
        title: 'Data Table',
        headers: ['Account', 'Stage', 'Value'],
        rows: [
            ['BlueNova', 'Proposal', '$12k'],
            ['Futura', 'Qualified', '$7k'],
            ['Nimbus', 'Discovery', '$4k']
        ]
    },
    CardList: {
        title: 'Card List',
        cards: [
            { title: 'Psychologist Onboard', meta: 'Due in 2 days' },
            { title: 'Business Review', meta: 'Priority: High' }
        ]
    },
    KeyValueFields: {
        title: 'Key Value Fields',
        fields: [
            { label: 'Industry', value: 'Healthcare' },
            { label: 'Seats', value: '128' },
            { label: 'Tier', value: 'Enterprise' }
        ]
    },
    ContactProfile: {
        title: 'Contact Profile',
        subtitle: 'Primary decision maker',
        fields: [
            { label: 'Name', value: 'Luis Chen' },
            { label: 'Role', value: 'HR Director' },
            { label: 'Phone', value: '+1 (555) 221-8844' }
        ]
    },
    SubscriptionOverview: {
        title: 'Subscription Overview',
        pills: ['Plan: Growth', 'Renewal: Jul 14', 'Status: Active']
    },
    EmployeePanel: {
        title: 'Employee Panel',
        fields: [
            { label: 'Employee', value: 'Sofia Ramos' },
            { label: 'Role', value: 'People Ops' },
            { label: 'Status', value: 'Onboarding' }
        ]
    },
    PsychologistProfile: {
        title: 'Psychologist Profile',
        fields: [
            { label: 'Specialty', value: 'Trauma' },
            { label: 'Availability', value: 'Tue - Thu' },
            { label: 'Rating', value: '4.9' }
        ]
    },
    BusinessInfoPanel: {
        title: 'Business Info',
        fields: [
            { label: 'Industry', value: 'Fintech' },
            { label: 'Region', value: 'EMEA' },
            { label: 'Tier', value: 'Premium' }
        ]
    },
    AccountSummary: {
        title: 'Account Summary',
        pills: ['NPS 52', 'Usage up 18%', 'Churn risk: Low']
    },
    ApplicationStatusPanel: {
        title: 'Application Status',
        steps: ['Lead', 'Qualified', 'Under Review', 'Approved']
    },
    LeadSummary: {
        title: 'Lead Summary',
        fields: [
            { label: 'Score', value: '82' },
            { label: 'Source', value: 'Referral' },
            { label: 'Stage', value: 'Qualified' }
        ]
    },
    OpportunitySummary: {
        title: 'Opportunity Summary',
        fields: [
            { label: 'Pipeline', value: '$96k' },
            { label: 'Close Date', value: 'Aug 02' },
            { label: 'Probability', value: '68%' }
        ]
    },
    ActionButton: {
        title: 'Primary Action',
        actions: ['Launch Workflow']
    },
    QuickActionsBar: {
        title: 'Quick Actions',
        actions: ['Send Email', 'Assign Psychologist', 'Approve']
    },
    LinkList: {
        title: 'Link List',
        links: ['Open Profile', 'View Subscription', 'Audit Log']
    },
    FormPanel: {
        title: 'Form Panel',
        fields: ['First name', 'Email', 'Role']
    },
    SendEmailButton: {
        title: 'Send Email',
        actions: ['Compose']
    },
    AssignPsychologistButton: {
        title: 'Assign Psychologist',
        actions: ['Assign']
    },
    ApproveRejectPanel: {
        title: 'Approve / Reject',
        actions: ['Approve', 'Reject']
    }
};

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
    previewRole
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

    const renderPreview = (component) => {
        const previewKey = resolvePreviewKey(component);
        const preview = SAMPLE_PREVIEWS[previewKey] || null;

        if (!preview) {
            return (
                <div className="kodi-builder__preview kodi-builder__preview--placeholder">
                    <div className="kodi-builder__preview-title">{previewKey || 'Component'} Preview</div>
                    <div className="kodi-builder__preview-text">Drop in live data bindings to render.</div>
                </div>
            );
        }

        return (
            <div className="kodi-builder__preview">
                <div className="kodi-builder__preview-title">{preview.title}</div>

                {preview.fields && (
                    <div className="kodi-builder__preview-fields">
                        {preview.fields.map((field) => (
                            <div key={field.label} className="kodi-builder__preview-field">
                                <span>{field.label}</span>
                                <strong>{field.value}</strong>
                            </div>
                        ))}
                    </div>
                )}

                {preview.items && (
                    <ul className="kodi-builder__preview-list">
                        {preview.items.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                )}

                {preview.pills && (
                    <div className="kodi-builder__preview-pills">
                        {preview.pills.map((pill) => (
                            <span key={pill}>{pill}</span>
                        ))}
                    </div>
                )}

                {preview.steps && (
                    <div className="kodi-builder__preview-steps">
                        {preview.steps.map((step, index) => (
                            <div key={step} className={`kodi-builder__preview-step ${index === 1 ? 'active' : ''}`}>
                                {step}
                            </div>
                        ))}
                    </div>
                )}

                {preview.headers && preview.rows && (
                    <div className="kodi-builder__preview-table">
                        <div className="kodi-builder__preview-table-head">
                            {preview.headers.map((header) => (
                                <span key={header}>{header}</span>
                            ))}
                        </div>
                        {preview.rows.map((row, idx) => (
                            <div key={`${row[0]}-${idx}`} className="kodi-builder__preview-table-row">
                                {row.map((cell) => (
                                    <span key={cell}>{cell}</span>
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                {preview.cards && (
                    <div className="kodi-builder__preview-cards">
                        {preview.cards.map((card) => (
                            <div key={card.title} className="kodi-builder__preview-card">
                                <strong>{card.title}</strong>
                                <span>{card.meta}</span>
                            </div>
                        ))}
                    </div>
                )}

                {preview.links && (
                    <div className="kodi-builder__preview-links">
                        {preview.links.map((link) => (
                            <div key={link} className="kodi-builder__preview-link">{link}</div>
                        ))}
                    </div>
                )}

                {preview.actions && (
                    <div className="kodi-builder__preview-actions">
                        {preview.actions.map((action) => (
                            <button key={action} type="button">{action}</button>
                        ))}
                    </div>
                )}

                {preview.subtitle && (
                    <div className="kodi-builder__preview-subtitle">{preview.subtitle}</div>
                )}

                {preview.fields == null && preview.items == null && preview.pills == null && preview.headers == null && preview.cards == null && preview.links == null && preview.actions == null && (
                    <div className="kodi-builder__preview-text">Preview data is ready.</div>
                )}
            </div>
        );
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
