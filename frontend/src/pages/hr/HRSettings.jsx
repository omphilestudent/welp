import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import './HRMvp.css';

const HRSettings = () => {
    const [settings, setSettings] = useState(null);
    const [leaveTypes, setLeaveTypes] = useState('');
    const [approvalRules, setApprovalRules] = useState('{}');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const fetchSettings = async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await api.get('/hr/settings');
            const payload = data?.data?.settings || null;
            setSettings(payload);
            setLeaveTypes(Array.isArray(payload?.leave_types) ? payload.leave_types.join(', ') : '');
            setApprovalRules(JSON.stringify(payload?.approval_rules || {}, null, 2));
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to load HR settings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleSave = async () => {
        setError('');
        try {
            const leaveTypesArray = leaveTypes
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean);
            const approval = approvalRules ? JSON.parse(approvalRules) : {};
            const { data } = await api.put('/hr/settings', {
                leave_types: leaveTypesArray,
                approval_rules: approval
            });
            setSettings(data?.data?.settings);
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to save settings');
        }
    };

    return (
        <div className="hr-mvp">
            <div className="hr-header">
                <div>
                    <h2>HR Settings</h2>
                    <p className="hr-subtitle">Configure leave types and approval rules.</p>
                </div>
            </div>

            {error && <div className="hr-banner">{error}</div>}

            <div className="hr-card">
                <div className="hr-card-header">
                    <strong>Configuration</strong>
                </div>
                {loading ? (
                    <div className="hr-empty">Loading settings...</div>
                ) : (
                    <div className="hr-grid">
                        <div className="hr-field">
                            <label>Leave Types (comma-separated)</label>
                            <input value={leaveTypes} onChange={(e) => setLeaveTypes(e.target.value)} />
                        </div>
                        <div className="hr-field">
                            <label>Approval Rules (JSON)</label>
                            <textarea rows="6" value={approvalRules} onChange={(e) => setApprovalRules(e.target.value)} />
                        </div>
                    </div>
                )}
                <div className="hr-actions">
                    <button className="btn btn-primary" onClick={handleSave} disabled={loading}>Save settings</button>
                </div>
            </div>

            {settings && (
                <div className="hr-card">
                    <div className="hr-card-header">
                        <strong>Current Settings Snapshot</strong>
                    </div>
                    <pre>{JSON.stringify(settings, null, 2)}</pre>
                </div>
            )}
        </div>
    );
};

export default HRSettings;
