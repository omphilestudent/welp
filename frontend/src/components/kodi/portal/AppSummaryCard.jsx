import React from 'react';

const AppSummaryCard = ({ app }) => (
    <div className="kodi-portal-summary-card">
        <div>
            <h2>{app.label || app.name}</h2>
            <p>{app.description || 'No description yet.'}</p>
        </div>
        <div className="kodi-portal-summary-meta">
            <span>Status: {app.status}</span>
            <span>Users: {app.counts?.users ?? app.userCount ?? 0}</span>
            <span>Pages: {app.counts?.pages ?? app.pageCount ?? 0}</span>
        </div>
    </div>
);

export default AppSummaryCard;
