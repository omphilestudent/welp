
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const CompanySearch = ({ onSearch, initialQuery = '' }) => {
    const navigate = useNavigate();
    const [query, setQuery] = useState(initialQuery);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (query.trim()) {
            if (onSearch) {
                onSearch(query);
            } else {
                navigate(`/search?q=${encodeURIComponent(query)}`);
            }
        }
    };

    return (
        <form onSubmit={handleSubmit} className="company-search">
            <div className="search-input-wrapper">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search companies by name, industry, or location..."
                    className="search-input"
                />
                <button type="submit" className="search-button">
                    Search
                </button>
            </div>
        </form>
    );
};

export default CompanySearch;