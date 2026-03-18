import React from 'react';

export default function CustomPageComponent({ props = {} }) {
    const name = props.name || 'Custom Page Component';
    const version = props.version || '1.0';
    const preview = props.preview_enabled !== false;
    const layoutJson = props.layout_json || '{}';
    const author = props.author_id || 'admin';

    return (
        <div className="custom-page">
            <div className="custom-page-header">
                <strong>{name}</strong>
                <span>v{version}</span>
            </div>
            <p className="custom-page-author">By {author}</p>
            <pre className="custom-page-layout">{layoutJson}</pre>
            <div className="custom-page-preview-chip">{preview ? 'Preview enabled' : 'Preview off'}</div>
        </div>
    );
}
