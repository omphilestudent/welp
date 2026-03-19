import React from 'react';

const ROLE_KEYS = ['admin', 'employee', 'business_user', 'psychologist'];

const AppPagesTable = ({ pages, onUpdate, onRemove, onDragStart, onDragOver, onDrop }) => (
    <div className="kodi-portal-table">
        <div className="kodi-portal-table__row header">
            <span>Label</span>
            <span>Type</span>
            <span>Order</span>
            <span>Default</span>
            <span>Visible</span>
            <span>Role Visibility</span>
            <span>Actions</span>
        </div>
        {pages.map((page, index) => (
            <div
                key={page.mapping_id}
                className="kodi-portal-table__row"
                draggable
                onDragStart={() => onDragStart(page.mapping_id)}
                onDragOver={(e) => {
                    e.preventDefault();
                    onDragOver(index);
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    onDrop(index);
                }}
            >
                <input
                    type="text"
                    value={page.nav_label || page.label}
                    onChange={(e) => onUpdate(page, { navLabel: e.target.value })}
                />
                <span>{page.page_type}</span>
                <span>{page.nav_order}</span>
                <input
                    type="radio"
                    checked={page.is_default}
                    onChange={() => onUpdate(page, { isDefault: true })}
                />
                <input
                    type="checkbox"
                    checked={page.is_visible}
                    onChange={() => onUpdate(page, { isVisible: !page.is_visible })}
                />
                <div className="kodi-portal-role-grid">
                    {ROLE_KEYS.map((role) => (
                        <label key={`${page.mapping_id}-${role}`}>
                            <input
                                type="checkbox"
                                checked={page.role_visibility?.[role] !== false}
                                onChange={() => {
                                    const next = { ...(page.role_visibility || {}) };
                                    next[role] = !(next[role] !== false);
                                    onUpdate(page, { roleVisibility: next });
                                }}
                            />
                            {role}
                        </label>
                    ))}
                </div>
                <div className="kodi-portal-table__actions">
                    <button className="btn-text danger" onClick={() => onRemove(page)}>Remove</button>
                </div>
            </div>
        ))}
        {pages.length === 0 && <p className="kodi-portal-empty">No pages linked.</p>}
    </div>
);

export default AppPagesTable;
