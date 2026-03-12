import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import Loading from '../components/common/Loading';

const MentalHealthResources = () => {
    const mockResources = [
        {
            id: 'mock-1',
            title: 'Crisis Text Line',
            description: 'Free, 24/7 support for anyone in crisis. Connect with a trained counselor by text.',
            category: 'Crisis Support',
            audience: 'Employees',
            resource_type: 'Text',
            phone: '988',
            url: 'https://988lifeline.org/',
            is_emergency: true
        },
        {
            id: 'mock-2',
            title: 'Welp Wellbeing Check-In',
            description: 'Self-guided stress check-in to track burnout risk and get tailored tips.',
            category: 'Assessment',
            audience: 'Employees',
            resource_type: 'Tool',
            url: 'https://example.com/wellbeing-checkin',
            is_emergency: false
        },
        {
            id: 'mock-3',
            title: 'Mindful Minutes',
            description: 'Short, guided breathing and grounding exercises to reduce anxiety.',
            category: 'Mindfulness',
            audience: 'Employees',
            resource_type: 'Audio',
            url: 'https://example.com/mindful-minutes',
            is_emergency: false
        },
        {
            id: 'mock-4',
            title: 'Burnout Recovery Plan',
            description: 'A 2-week plan with daily micro-actions for recovery and energy management.',
            category: 'Burnout',
            audience: 'Employees',
            resource_type: 'Program',
            url: 'https://example.com/burnout-plan',
            is_emergency: false
        },
        {
            id: 'mock-5',
            title: 'Clinician Consultation Line',
            description: 'Peer support line for psychologists seeking case consultation or supervision.',
            category: 'Professional Support',
            audience: 'Psychologists',
            resource_type: 'Phone',
            phone: '+1-800-555-0189',
            email: 'support@welp.example',
            is_emergency: false
        },
        {
            id: 'mock-6',
            title: 'Grief and Loss Resource Hub',
            description: 'Articles and worksheets supporting grief, loss, and life transitions.',
            category: 'Grief Support',
            audience: 'Employees',
            resource_type: 'Guide',
            url: 'https://example.com/grief-support',
            is_emergency: false
        }
    ];
    const [resources, setResources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState('all');

    useEffect(() => {
        const fetchResources = async () => {
            try {
                const { data } = await api.get('/resources/mental-health');
                const fetched = data?.resources || [];
                setResources(fetched.length > 0 ? fetched : mockResources);
            } catch (err) {
                console.error('Failed to load mental health resources', err);
                setResources(mockResources);
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
