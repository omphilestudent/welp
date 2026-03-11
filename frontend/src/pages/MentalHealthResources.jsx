import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import Loading from '../components/common/Loading';

const MentalHealthResources = () => {
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');

    useEffect(() => {
        const fetchResources = async () => {
            try {
                const { data } = await api.get('/resources/mental-health');
                setResources(data?.resources || []);
            } catch (err) {
                console.error('Failed to load mental health resources', err);
                setError('Unable to load resources right now.');
            } finally {
                setLoading(false);
            }
        };

        fetchResources();
    }, []);

    const categories = useMemo(() => {
        const unique = new Set(resources.map((item) => item.category).filter(Boolean));
        return ['all', ...Array.from(unique)];
    }, [resources]);

    const filteredResources = useMemo(() => {
        const term = query.trim().toLowerCase();
        return resources.filter((item) => {
            if (activeCategory !== 'all' && item.category !== activeCategory) {
                return false;
            }
            if (!term) return true;
            return [item.title, item.description, item.category, item.audience, item.resource_type]
                .filter(Boolean)
                .some((value) => value.toLowerCase().includes(term));
        });
    }, [resources, query, activeCategory]);

    if (loading) return <Loading />;

    return (
        <div className="resources-page">
            <div className="resources-hero">
                <div>
                    <h1>Mental Health Resources</h1>
                    <p>Find trusted support options, crisis contacts, and wellbeing tools curated for employees and psychologists.</p>
                </div>
                <div className="resources-search">
                    <input
                        type="text"
                        placeholder="Search by keyword, category, or audience..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="resources-filters">
                {categories.map((category) => (
                    <button
                        key={category}
                        className={`filter-pill ${activeCategory === category ? 'active' : ''}`}
                        onClick={() => setActiveCategory(category)}
                    >
                        {category === 'all' ? 'All Resources' : category}
                    </button>
                ))}
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {filteredResources.length === 0 && !error && (
                <div className="resources-empty">
                    <h3>No resources available yet</h3>
                    <p>Resources will appear here once they are added by the team.</p>
                </div>
            )}

            <div className="resources-grid">
                {filteredResources.map((resource) => (
                    <div key={resource.id} className={`resource-card ${resource.is_emergency ? 'is-emergency' : ''}`}>
                        <div className="resource-card__header">
                            <div>
                                <h3>{resource.title}</h3>
                                {resource.category && <span className="resource-tag">{resource.category}</span>}
                            </div>
                            {resource.is_emergency && <span className="resource-emergency">Emergency</span>}
                        </div>
                        {resource.description && <p>{resource.description}</p>}
                        <div className="resource-meta">
                            {resource.audience && <span>Audience: {resource.audience}</span>}
                            {resource.resource_type && <span>Type: {resource.resource_type}</span>}
                        </div>
                        <div className="resource-actions">
                            {resource.url && (
                                <a className="btn btn-primary btn-small" href={resource.url} target="_blank" rel="noreferrer">
                                    Visit Resource
                                </a>
                            )}
                            {resource.phone && (
                                <a className="btn btn-outline btn-small" href={`tel:${resource.phone}`}>
                                    Call {resource.phone}
                                </a>
                            )}
                            {resource.email && (
                                <a className="btn btn-secondary btn-small" href={`mailto:${resource.email}`}>
                                    Email Support
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MentalHealthResources;
