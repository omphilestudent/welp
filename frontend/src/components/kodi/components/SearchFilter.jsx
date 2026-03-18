import React from 'react';

const parseArray = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return value.split(',').map((item) => item.trim()).filter(Boolean);
        }
    }
    return [];
};

export default function SearchFilter({ props = {} }) {
    const searchFields = parseArray(props.search_fields || '[]');
    const filters = parseArray(props.filter_options || '[]');
    const sort = props.default_sort || 'recent';
    const debounce = props.debounce_time || 300;

    return (
        <div className="search-filter-preview">
            <div className="search-field">
                <input type="text" placeholder="Search..." disabled />
                <span>Debounce: {debounce}ms</span>
            </div>
            <div className="search-fields">
                <strong>Fields:</strong>
                {searchFields.map((field) => (
                    <span key={field}>{field}</span>
                ))}
            </div>
            <div className="filter-options">
                <strong>Filters:</strong>
                {filters.map((filter) => (
                    <span key={filter}>{filter}</span>
                ))}
            </div>
            <div className="sort-label">
                Default sort: <strong>{sort}</strong>
            </div>
        </div>
    );
}
