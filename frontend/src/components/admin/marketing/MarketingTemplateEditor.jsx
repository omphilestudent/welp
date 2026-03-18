import React, { useState, useEffect } from 'react';

const MarketingTemplateEditor = ({ template, onSave }) => {
    const [form, setForm] = useState(template || {});

    useEffect(() => {
        setForm(template || {});
    }, [template]);

    if (!template) {
        return <div className="marketing-panel">Select a template to edit.</div>;
    }

    return (
        <div className="marketing-panel">
            <div className="marketing-panel__header">
                <h3>Edit Template</h3>
                <button className="btn-primary" onClick={() => onSave(form)}>Save</button>
            </div>
            <div className="marketing-form">
                <label>
                    Name
                    <input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </label>
                <label>
                    Subject
                    <input value={form.subject || ''} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                </label>
                <label>
                    Preheader
                    <input value={form.preheader || ''} onChange={(e) => setForm({ ...form, preheader: e.target.value })} />
                </label>
                <label>
                    HTML Body
                    <textarea rows={8} value={form.html_body || ''} onChange={(e) => setForm({ ...form, html_body: e.target.value })} />
                </label>
                <label>
                    Text Body
                    <textarea rows={6} value={form.text_body || ''} onChange={(e) => setForm({ ...form, text_body: e.target.value })} />
                </label>
                <label className="checkbox-row">
                    <input type="checkbox" checked={form.is_active !== false} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                    Active
                </label>
            </div>
        </div>
    );
};

export default MarketingTemplateEditor;
