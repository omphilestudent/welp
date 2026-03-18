import React from 'react';

const parseItems = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return value.split(',').map((item) => ({ label: item.trim(), route: '/' }));
        }
    }
    return [];
};

export default function TabsNavigation({ props = {} }) {
    const menuItems = parseItems(props.menu_items || '[]');
    const active = props.active_item || menuItems[0]?.label || 'Home';
    const collapsible = props.collapsible !== false;

    return (
        <div className="tabs-nav">
            <div className="tabs-list">
                {menuItems.map((item) => (
                    <span key={item.label} className={item.label === active ? 'active' : ''}>
                        {item.icon ? `${item.icon} ` : ''}{item.label}
                    </span>
                ))}
            </div>
            {collapsible && <button type="button" className="tabs-toggle">⇅ Toggle</button>}
        </div>
    );
}
