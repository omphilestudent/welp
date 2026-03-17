import React from 'react';

export default function NotificationPanel({ props = {}, context = {} }) {
    const notifications = Array.isArray(props.items) ? props.items : (context.notifications || []);
    return (
        <div className="kodi-comp kodi-notifications">
            <div className="kodi-notifications__title">{props.title || 'Notifications'}</div>
            {notifications.length === 0 ? (
                <div className="kodi-comp-empty">No notifications</div>
            ) : (
                <div className="kodi-notifications__list">
                    {notifications.map((n, idx) => (
                        <div key={n.id || idx} className="kodi-notifications__item">
                            <div style={{ fontWeight: 700 }}>{n.title || n.type || 'Notice'}</div>
                            <div style={{ opacity: 0.85 }}>{n.message || n.text}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export const config = {
    name: 'NotificationPanel',
    props: [{ name: 'title', type: 'string' }],
    editable: true
};

