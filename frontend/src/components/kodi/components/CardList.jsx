import React from 'react';

export default function CardList({ props = {} }) {
    const items = Array.isArray(props.items) ? props.items : [];
    return (
        <div className="kodi-comp kodi-cards">
            <div className="kodi-cards__title">{props.title || 'Cards'}</div>
            <div className="kodi-cards__grid">
                {items.map((it, idx) => (
                    <div key={it.id || idx} className="kodi-cards__card">
                        <div style={{ fontWeight: 800 }}>{it.title || it.name || `Item ${idx + 1}`}</div>
                        {it.subtitle ? <div style={{ opacity: 0.8 }}>{it.subtitle}</div> : null}
                        {it.body ? <div style={{ marginTop: 8, opacity: 0.9 }}>{it.body}</div> : null}
                    </div>
                ))}
                {items.length === 0 ? <div className="kodi-comp-empty">No items</div> : null}
            </div>
        </div>
    );
}

export const config = {
    name: 'CardList',
    props: [
        { name: 'title', type: 'string' },
        { name: 'items', type: 'array' }
    ],
    editable: true
};

