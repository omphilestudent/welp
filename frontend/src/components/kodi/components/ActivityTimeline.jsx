import React from 'react';

const parseEvents = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return [];
        }
    }
    return [];
};

export default function ActivityTimeline({ props = {} }) {
    const events = parseEvents(props.events || '[]');
    const sortOrder = props.sort_order || 'desc';
    const sorted = [...events].sort((a, b) => {
        if (sortOrder === 'asc') {
            return new Date(a.timestamp) - new Date(b.timestamp);
        }
        return new Date(b.timestamp) - new Date(a.timestamp);
    });

    return (
        <div className="timeline-preview">
            {sorted.map((event, index) => (
                <div key={`event-${index}`} className="timeline-item">
                    <div className="timeline-dot" />
                    <div>
                        <strong>{event.title || `Step ${index + 1}`}</strong>
                        <p>{event.description || 'No description.'}</p>
                        <span className="timeline-meta">{event.timestamp || 'TBD'} · {event.type || 'info'}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}
