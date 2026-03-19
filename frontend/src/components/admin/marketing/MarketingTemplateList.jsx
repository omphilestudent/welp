import React from 'react';

const MarketingTemplateList = ({ templates = [], onSelect, selectedId, onCreate }) => (
    <div className="marketing-panel">
        <div className="marketing-panel__header">
            <div>
                <div className="marketing-panel__title">Templates</div>
                <p className="text-xs text-secondary">Manage campaign and trigger layouts.</p>
            </div>
            <button className="btn-primary" onClick={onCreate}>+ New</button>
        </div>
        <div className="marketing-list">
            {templates.map((template) => (
                <button
                    key={template.id}
                    className={`marketing-list__item ${selectedId === template.id ? 'active' : ''}`}
                    onClick={() => onSelect(template)}
                >
                    <div>
                        <strong>{template.name}</strong>
                        <span className="text-xs text-secondary">{template.key}</span>
                    </div>
                    <span className="status-chip">{template.is_active ? 'Active' : 'Inactive'}</span>
                </button>
            ))}
        </div>
    </div>
);

export default MarketingTemplateList;
