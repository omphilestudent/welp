import React, { useEffect, useState } from 'react';

const MarketingTriggerList = ({ triggers = [], onUpdate }) => {
    const [configDrafts, setConfigDrafts] = useState({});
    const [errors, setErrors] = useState({});

    useEffect(() => {
        const draft = {};
        triggers.forEach((trigger) => {
            draft[trigger.trigger_key] = JSON.stringify(trigger.config || {}, null, 2);
        });
        setConfigDrafts(draft);
        setErrors({});
    }, [triggers]);

    const handleConfigChange = (trigger, value) => {
        setConfigDrafts((prev) => ({ ...prev, [trigger.trigger_key]: value }));
        try {
            const parsed = JSON.parse(value || '{}');
            setErrors((prev) => ({ ...prev, [trigger.trigger_key]: '' }));
            onUpdate(trigger.trigger_key, { is_enabled: trigger.is_enabled, config: parsed });
        } catch (error) {
            setErrors((prev) => ({ ...prev, [trigger.trigger_key]: 'Invalid JSON' }));
        }
    };

    return (
        <div className="marketing-panel">
            <h3>Trigger Emails</h3>
            {triggers.map((trigger) => (
                <div key={trigger.trigger_key} className="marketing-card">
                    <div>
                        <strong>{trigger.name}</strong>
                        <p className="text-xs text-secondary">{trigger.trigger_key}</p>
                        {trigger.template_name && (
                            <p className="text-xs text-secondary">
                                Template: {trigger.template_name} ({trigger.template_key})
                            </p>
                        )}
                        <p className="text-xs text-secondary">
                            Recent sends: {trigger.total_sends || 0} · Failures: {trigger.failure_count || 0}
                        </p>
                    </div>
                    <label>
                        <input
                            type="checkbox"
                            checked={trigger.is_enabled}
                            onChange={(e) => onUpdate(trigger.trigger_key, { is_enabled: e.target.checked, config: trigger.config })}
                        />
                        Enabled
                    </label>
                    <textarea
                        rows={3}
                        value={configDrafts[trigger.trigger_key] || ''}
                        onChange={(e) => handleConfigChange(trigger, e.target.value)}
                    />
                    {errors[trigger.trigger_key] && <div className="text-xs text-danger">{errors[trigger.trigger_key]}</div>}
                </div>
            ))}
        </div>
    );
};

export default MarketingTriggerList;
