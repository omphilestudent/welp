import React, { useEffect, useState } from 'react';
import api from '../../../../services/api';

export default function CaseWidget({ props = {} }) {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState([]);

    const endpoint = props.apiEndpoint || '/kodi/cases';

    useEffect(() => {
        let mounted = true;
        (async () => {
            setLoading(true);
            try {
                const { data } = await api.get(endpoint);
                if (!mounted) return;
                setRows(data?.data || data || []);
            } catch {
                if (!mounted) return;
                setRows([]);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [endpoint]);

    return (
        <div className="kodi-comp kodi-widget">
            <div className="kodi-widget__title">{props.title || 'Cases'}</div>
            {loading ? <div className="kodi-comp-empty">Loading…</div> : null}
            {!loading && rows.length === 0 ? <div className="kodi-comp-empty">No cases</div> : null}
            <div className="kodi-widget__list">
                {rows.slice(0, props.limit || 6).map((c) => (
                    <div key={c.id} className="kodi-widget__row">
                        <div style={{ fontWeight: 700 }}>{c.client_name || 'Case'}</div>
                        <div style={{ opacity: 0.8, fontSize: 12 }}>
                            {c.status} · {c.priority}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export const config = {
    name: 'CaseWidget',
    props: [
        { name: 'title', type: 'string' },
        { name: 'apiEndpoint', type: 'string' },
        { name: 'limit', type: 'number' }
    ],
    editable: true
};

