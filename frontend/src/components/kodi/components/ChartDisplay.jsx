import React from 'react';

const parseArray = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return value.split(',').map((item) => item.trim());
        }
    }
    return [];
};

export default function ChartDisplay({ props = {} }) {
    const type = (props.type || 'bar').toLowerCase();
    const data = parseArray(props.data || '[]').map((item) => Number(item) || 0);
    const labels = parseArray(props.labels || '[]');
    const color = props.color_scheme || '#0b6fc5';
    const tooltip = props.tooltip_enabled ? 'Tooltips enabled' : 'Tooltips off';

    return (
        <div className="chart-display">
            <div className="chart-header">
                <strong>{type.toUpperCase()} Chart</strong>
                <span>{tooltip}</span>
            </div>
            <div className={`chart-body chart-${type}`}>
                {data.map((value, index) => (
                    <div key={`point-${index}`} className="chart-bar" style={{ height: `${value}%`, background: color }}>
                        <span className="chart-label">{labels[index] || `P${index + 1}`}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
