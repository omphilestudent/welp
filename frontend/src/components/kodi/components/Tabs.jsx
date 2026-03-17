import React, { useMemo, useState } from 'react';
import { renderComponent } from '../DynamicRenderer';

export default function Tabs({ props = {}, context = {}, events = {} }) {
    const tabs = Array.isArray(props.tabs) ? props.tabs : [];
    const [active, setActive] = useState(tabs[0]?.key || 'tab-0');

    const activeTab = useMemo(() => tabs.find((t) => t.key === active) || tabs[0] || null, [tabs, active]);

    if (!tabs.length) return <div className="kodi-comp-empty">Tabs: missing `tabs`.</div>;

    return (
        <div className="kodi-comp kodi-tabs">
            <div className="kodi-tabs__bar">
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        className={`kodi-tabs__tab ${t.key === active ? 'active' : ''}`}
                        onClick={() => setActive(t.key)}
                        type="button"
                    >
                        {t.label || t.key}
                    </button>
                ))}
            </div>
            <div className="kodi-tabs__panel">
                {activeTab?.componentName
                    ? renderComponent({
                        componentName: activeTab.componentName,
                        props: activeTab.props || {},
                        context,
                        events
                    })
                    : <div style={{ opacity: 0.8 }}>No tab content configured.</div>}
            </div>
        </div>
    );
}

export const config = {
    name: 'Tabs',
    props: [{ name: 'tabs', type: 'array', required: true }],
    editable: true
};

