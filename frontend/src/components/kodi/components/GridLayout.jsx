import React from 'react';

const parseRows = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return [];
        }
    }
    return [];
};

export default function GridLayout({ props = {} }) {
    const rows = parseRows(props.rows || '[]');
    const gap = props.gap || '16px';
    const responsive = parseRows(props.responsive_breakpoints || '[]');

    return (
        <div className="grid-layout-preview" style={{ gap }}>
            {rows.map((row, rowIndex) => {
                const columns = row?.columns || props.columns || 2;
                return (
                    <div key={`grid-row-${rowIndex}`} className="grid-row">
                        {Array.from({ length: columns }).map((_, colIndex) => (
                            <div key={`grid-col-${colIndex}`} className="grid-cell">
                                <span>{`Row ${rowIndex + 1} · Col ${colIndex + 1}`}</span>
                            </div>
                        ))}
                    </div>
                );
            })}
            {responsive.length > 0 && (
                <div className="grid-responsive">
                    {responsive.map((item, index) => (
                        <span key={`break-${index}`}>{`${item.name}: ${item.columns} cols`}</span>
                    ))}
                </div>
            )}
        </div>
    );
}
