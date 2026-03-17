import React, { useState } from 'react';
import { renderComponent } from '../DynamicRenderer';

export default function Accordion({ props = {}, context = {}, events = {} }) {
    const items = Array.isArray(props.items) ? props.items : [];
    const [openKey, setOpenKey] = useState(items[0]?.key || '');

    if (!items.length) return <div className="kodi-comp-empty">Accordion: missing `items`.</div>;

    return (
        <div className="kodi-comp kodi-accordion">
            {items.map((it) => {
                const isOpen = it.key === openKey;
                return (
                    <div key={it.key} className={`kodi-accordion__item ${isOpen ? 'open' : ''}`}>
                        <button
                            type="button"
                            className="kodi-accordion__header"
                            onClick={() => setOpenKey((prev) => (prev === it.key ? '' : it.key))}
                        >
                            <span>{it.title || it.key}</span>
                            <span style={{ opacity: 0.7 }}>{isOpen ? '−' : '+'}</span>
                        </button>
                        {isOpen && (
                            <div className="kodi-accordion__body">
                                {it.componentName
                                    ? renderComponent({ componentName: it.componentName, props: it.props || {}, context, events })
                                    : <div style={{ opacity: 0.8 }}>No content configured.</div>}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export const config = {
    name: 'Accordion',
    props: [{ name: 'items', type: 'array', required: true }],
    editable: true
};

