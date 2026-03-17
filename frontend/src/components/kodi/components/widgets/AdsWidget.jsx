import React, { useEffect, useState } from 'react';
import api from '../../../../services/api';

export default function AdsWidget({ props = {} }) {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState([]);

    const endpoint = props.apiEndpoint || '/kodi/ads';

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
            <div className="kodi-widget__title">{props.title || 'Ads Review'}</div>
            {loading ? <div className="kodi-comp-empty">Loading…</div> : null}
            {!loading && rows.length === 0 ? <div className="kodi-comp-empty">No ads</div> : null}
            <div className="kodi-widget__list">
                {rows.slice(0, props.limit || 6).map((a) => (
                    <div key={a.id} className="kodi-widget__row">
                        <div style={{ fontWeight: 700 }}>Ad {String(a.id).slice(0, 6)}</div>
                        <div style={{ opacity: 0.8, fontSize: 12 }}>{a.status}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export const config = {
    name: 'AdsWidget',
    props: [
        { name: 'title', type: 'string' },
        { name: 'apiEndpoint', type: 'string' },
        { name: 'limit', type: 'number' }
    ],
    editable: true
};

