import React from 'react';

export default function ProgressKPI({ props = {} }) {
    const value = Number(props.value ?? 0);
    const max = Number(props.max ?? 100);
    const label = props.label || 'Progress';
    const tooltip = props.tooltip || '';
    const color = props.color || '#0b6fc5';
    const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

    return (
        <div className="progress-kpi" title={tooltip}>
            <div className="progress-label">
                <strong>{label}</strong>
                <span>{`${value} / ${max}`}</span>
            </div>
            <div className="progress-track">
                <div className="progress-fill" style={{ width: `${percent}%`, background: color }} />
            </div>
            <div className="progress-meta">
                <span>{`${percent}%`}</span>
            </div>
        </div>
    );
}
