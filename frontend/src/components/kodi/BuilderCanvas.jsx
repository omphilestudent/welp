import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ResizeHandle from './ResizeHandle';

const GRID_COLUMNS = 12;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const BuilderCanvas = ({
    layout,
    selected,
    onSelectComponent,
    onLayoutChange,
    onComponentDrop,
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
                                                    <span>{component.component_type}</span>
                                                </div>
                                                <div className="kodi-builder__component-body">
                                                    <p>{hasPermission(component) ? (component.description || 'Drag to reorder or resize.') : 'Hidden by permissions'}</p>
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
