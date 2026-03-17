import React from 'react';

export default function RecordViewer({ props = {} }) {
    const record = props.record || null;
    if (!record) return <div className="kodi-comp-empty">RecordViewer: no `record` provided.</div>;

    return (
        <div className="kodi-comp kodi-record">
            <div className="kodi-record__title">{props.title || record.title || record.name || 'Record'}</div>
            <pre className="kodi-record__json">{JSON.stringify(record, null, 2)}</pre>
        </div>
    );
}

export const config = {
    name: 'RecordViewer',
    props: [
        { name: 'title', type: 'string' },
        { name: 'record', type: 'object', required: true }
    ],
    editable: true
};

