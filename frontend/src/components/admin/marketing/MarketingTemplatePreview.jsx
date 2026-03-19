import React from 'react';

const MarketingTemplatePreview = ({ preview }) => {
    if (!preview) return null;
    return (
        <div className="marketing-panel">
            <div className="marketing-panel__header">
                <div>
                    <div className="marketing-panel__title">Preview</div>
                    <p className="text-xs text-secondary">Live rendering with sample variables.</p>
                </div>
            </div>
            <div className="marketing-preview">
                <h4>Subject</h4>
                <p>{preview.subject}</p>
                <h4>HTML</h4>
                <div className="marketing-preview__html" dangerouslySetInnerHTML={{ __html: preview.html }} />
                <h4>Text</h4>
                <pre>{preview.text}</pre>
            </div>
        </div>
    );
};

export default MarketingTemplatePreview;
