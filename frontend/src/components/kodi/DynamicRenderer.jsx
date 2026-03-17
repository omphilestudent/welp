import React from 'react';

const UnknownComponent = ({ name, type, props }) => (
    <div className="kodi-dyn-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <strong>{name || 'Unknown component'}</strong>
            <span style={{ opacity: 0.7 }}>{type}</span>
        </div>
        {props ? (
            <pre style={{ marginTop: 12, fontSize: 12, opacity: 0.9, overflowX: 'auto' }}>
                {JSON.stringify(props, null, 2)}
            </pre>
        ) : null}
    </div>
);

// NOTE: For production, you’ll likely want a secure sandboxed runtime
// for user-authored components. For now, render metadata + props only.
const renderComponent = ({ component, props }) => {
    return (
        <UnknownComponent
            name={component?.name}
            type={component?.type}
            props={props}
        />
    );
};

const DynamicRenderer = ({ layout, components }) => {
    const rows = layout?.rows || [];
    const compById = new Map((components || []).map((m) => [m.component?.id, m]));

    return (
        <div className="kodi-layout">
            {rows.map((row, rowIndex) => (
                <div key={`row-${rowIndex}`} className="kodi-row">
                    {(row.columns || []).map((col, colIndex) => (
                        <div key={`col-${rowIndex}-${colIndex}`} className="kodi-col">
                            {(col.components || []).map((slot, slotIndex) => {
                                const match = compById.get(slot.componentId) || null;
                                const mergedProps = { ...(slot.props || {}), ...(match?.props || {}) };
                                return (
                                    <div key={`slot-${rowIndex}-${colIndex}-${slotIndex}`} className="kodi-slot">
                                        {renderComponent({ component: match?.component, props: mergedProps })}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default DynamicRenderer;

