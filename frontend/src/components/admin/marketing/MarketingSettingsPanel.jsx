import React, { useState, useEffect } from 'react';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

const MarketingSettingsPanel = ({ settings, onSave }) => {
    const [form, setForm] = useState(settings || {});

    useEffect(() => {
        setForm(settings || {});
    }, [settings]);

    return (
        <div>
            <div className="marketing-form">
                <label>
                    Sender name
                    <input value={form.sender_name || ''} onChange={(e) => setForm({ ...form, sender_name: e.target.value })} />
                </label>
                <label>
                    Sender email
                    <input value={form.sender_email || ''} onChange={(e) => setForm({ ...form, sender_email: e.target.value })} />
                </label>
                <label className="checkbox-row">
                    <input
                        type="checkbox"
                        checked={form.employee_marketing_enabled !== false}
                        onChange={(e) => setForm({ ...form, employee_marketing_enabled: e.target.checked })}
                    />
                    Employee marketing enabled
                </label>
                <label className="checkbox-row">
                    <input
                        type="checkbox"
                        checked={form.psychologist_marketing_enabled !== false}
                        onChange={(e) => setForm({ ...form, psychologist_marketing_enabled: e.target.checked })}
                    />
                    Psychologist marketing enabled
                </label>
                <label className="checkbox-row">
                    <input
                        type="checkbox"
                        checked={form.review_email_stop_after_registration !== false}
                        onChange={(e) => setForm({ ...form, review_email_stop_after_registration: e.target.checked })}
                    />
                    Stop review outreach after registration
                </label>
                <div className="marketing-days">
                    <span className="text-xs text-secondary">Default campaign days</span>
                    {DAYS.map((day) => (
                        <label key={day}>
                            <input
                                type="checkbox"
                                checked={(form.default_campaign_days || ['Monday','Wednesday','Friday']).includes(day)}
                                onChange={() => {
                                    const current = new Set(form.default_campaign_days || ['Monday','Wednesday','Friday']);
                                    if (current.has(day)) current.delete(day); else current.add(day);
                                    setForm({ ...form, default_campaign_days: Array.from(current) });
                                }}
                            />
                            {day.slice(0,3)}
                        </label>
                    ))}
                </div>
                <button className="btn-primary" onClick={() => onSave(form)}>Save Settings</button>
            </div>
        </div>
    );
};

export default MarketingSettingsPanel;
