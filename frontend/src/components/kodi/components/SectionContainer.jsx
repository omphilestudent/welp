import React from 'react';

export default function SectionContainer({ props = {} }) {
    const backgroundColor = props.background_color || '#fff';
    const padding = props.padding || '16px';
    const shadow = props.shadow || '0 4px 12px rgba(0,0,0,0.08)';
    const collapsible = props.collapsible !== false;
    const title = props.title || 'Section';
    const description = props.description || 'Add nested blocks or metadata inside';

    return (
        <div
            className="section-container"
            style={{ backgroundColor, padding, boxShadow: collapsible ? shadow : 'none' }}
        >
            <div className="section-header">
                <h4>{title}</h4>
                {collapsible && <span className="section-badge">Collapsible</span>}
            </div>
            <p className="section-subtitle">{description}</p>
        </div>
    );
}
