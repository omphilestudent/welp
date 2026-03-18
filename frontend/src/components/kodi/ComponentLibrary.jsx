import React, { useMemo, useState } from 'react';

const ComponentLibrary = ({ components = [], onDragStart, onSelect }) => {
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('all');

    const categories = useMemo(() => {
        const set = new Set(components.map((item) => item.category).filter(Boolean));
        return ['all', ...Array.from(set)];
    }, [components]);

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return components.filter((item) => {
            if (category !== 'all' && item.category !== category) return false;
            if (!term) return true;
            const haystack = `${item.label || ''} ${item.name || ''} ${item.description || ''}`.toLowerCase();
            return haystack.includes(term);
        });
    }, [components, search, category]);

    return (
        <aside className="kodi-builder__library">
            <div className="kodi-builder__library-header">
                <h3>Components</h3>
                <input
                    type="text"
                    placeholder="Search components..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                    {categories.map((item) => (
                        <option key={item} value={item}>
                            {item === 'all' ? 'All categories' : item}
                        </option>
                    ))}
                </select>
            </div>
            <div className="kodi-builder__library-list">
                {filtered.map((component) => (
                    <div
                        key={component.id}
                        className="kodi-builder__library-item"
                        draggable
                        onDragStart={(event) => onDragStart(event, component)}
                        onClick={() => onSelect?.(component)}
                    >
                        <div>
                            <strong>{component.label || component.name}</strong>
                            <p>{component.description || 'Kodi component'}</p>
                        </div>
                        <span className="kodi-builder__library-type">{component.category}</span>
                    </div>
                ))}
                {!filtered.length && <p className="kodi-builder__library-empty">No components found.</p>}
            </div>
        </aside>
    );
};

export default ComponentLibrary;
