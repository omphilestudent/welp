import React from 'react';

const MarketingDeliveryLogs = ({ logs = [], onFilter, filters, campaigns = [], triggers = [] }) => (
    <div className="marketing-panel">
        <div className="marketing-panel__header">
            <h3>Delivery Logs</h3>
        </div>
        <div className="marketing-filters">
            <select value={filters.status || ''} onChange={(e) => onFilter({ ...filters, status: e.target.value })}>
                <option value="">All statuses</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="queued">Queued</option>
            </select>
            <select value={filters.audience || ''} onChange={(e) => onFilter({ ...filters, audience: e.target.value })}>
                <option value="">All audiences</option>
                <option value="employee">Employee</option>
                <option value="psychologist">Psychologist</option>
                <option value="business">Business</option>
            </select>
            <select value={filters.trigger_key || ''} onChange={(e) => onFilter({ ...filters, trigger_key: e.target.value })}>
                <option value="">All triggers</option>
                {triggers.map((trigger) => (
                    <option key={trigger.trigger_key} value={trigger.trigger_key}>
                        {trigger.name}
                    </option>
                ))}
            </select>
            <select value={filters.campaign_id || ''} onChange={(e) => onFilter({ ...filters, campaign_id: e.target.value })}>
                <option value="">All campaigns</option>
                {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                    </option>
                ))}
            </select>
        </div>
        <div className="marketing-log-list">
            {logs.map((log) => (
                <div key={log.id} className="marketing-log">
                    <div>
                        <strong>{log.recipient_email}</strong>
                        <div className="text-xs text-secondary">{log.subject}</div>
                        <div className="text-xs text-secondary">
                            {log.sent_at ? new Date(log.sent_at).toLocaleString() : 'Not sent'}
                        </div>
                        {log.error_message && <div className="text-xs text-danger">{log.error_message}</div>}
                    </div>
                    <span className="status-chip">{log.status}</span>
                </div>
            ))}
        </div>
    </div>
);

export default MarketingDeliveryLogs;
