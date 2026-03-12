import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const CalendarTroubleshoot = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [selected, setSelected] = useState(null);
    const [schedule, setSchedule] = useState([]);
    const [integrations, setIntegrations] = useState([]);
    const [externalEvents, setExternalEvents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!selected?.id) return;
        const fetchDetails = async () => {
            setLoading(true);
            try {
                const [scheduleRes, integrationsRes, externalRes] = await Promise.all([
                    api.get(`/admin/psychologists/${selected.id}/schedule`),
                    api.get(`/admin/psychologists/${selected.id}/calendar-integrations`),
                    api.get(`/admin/psychologists/${selected.id}/external-events`)
                ]);
                setSchedule(scheduleRes.data || []);
                setIntegrations(integrationsRes.data || []);
                setExternalEvents(externalRes.data || []);
            } catch (err) {
                setSchedule([]);
                setIntegrations([]);
                setExternalEvents([]);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [selected]);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;
        try {
            setError('');
            const { data } = await api.get('/admin/psychologists/search', {
                params: { q: query.trim() }
            });
            setResults(data || []);
        } catch (err) {
            setResults([]);
            setError(err?.response?.data?.error || 'Search failed.');
        }
    };

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <div>
                    <h2>Calendar Troubleshooting</h2>
                    <p>Search psychologists and inspect schedules + external calendar sync.</p>
                </div>
            </div>

            <form className="admin-search-bar" onSubmit={handleSearch}>
                <input
                    type="text"
                    placeholder="Search by name, email, or ID"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
                <button className="btn btn-primary">Search</button>
            </form>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="admin-grid">
                <div className="admin-panel">
                    <h3>Results</h3>
                    {results.length === 0 ? (
                        <p className="admin-empty">No psychologists found.</p>
                    ) : (
                        <div className="admin-list">
                            {results.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={`admin-list-item ${selected?.id === item.id ? 'active' : ''}`}
                                    onClick={() => setSelected(item)}
                                >
                                    <strong>{item.display_name || 'Unnamed'}</strong>
                                    <span>{item.email}</span>
                                    <small>{item.id}</small>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="admin-panel">
                    <h3>Schedule</h3>
                    {loading ? (
                        <p>Loading...</p>
                    ) : schedule.length === 0 ? (
                        <p className="admin-empty">No scheduled items.</p>
                    ) : (
                        <div className="admin-list">
                            {schedule.map((item) => (
                                <div key={item.id} className="admin-list-item static">
                                    <strong>{item.title}</strong>
                                    <span>{new Date(item.scheduled_for).toLocaleString()}</span>
                                    <small>{item.location || item.type}</small>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="admin-panel">
                    <h3>Calendar Integrations</h3>
                    {loading ? (
                        <p>Loading...</p>
                    ) : integrations.length === 0 ? (
                        <p className="admin-empty">No integrations.</p>
                    ) : (
                        <div className="admin-list">
                            {integrations.map((item) => (
                                <div key={item.id} className="admin-list-item static">
                                    <strong>{item.name || item.provider}</strong>
                                    <span>{item.provider}</span>
                                    <small>{item.ical_url}</small>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="admin-panel">
                    <h3>External Events</h3>
                    {loading ? (
                        <p>Loading...</p>
                    ) : externalEvents.length === 0 ? (
                        <p className="admin-empty">No external events.</p>
                    ) : (
                        <div className="admin-list">
                            {externalEvents.map((item, index) => (
                                <div key={`${item.source_uid || item.title}-${index}`} className="admin-list-item static">
                                    <strong>{item.title}</strong>
                                    <span>{new Date(item.starts_at).toLocaleString()}</span>
                                    <small>{item.location || 'External event'}</small>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CalendarTroubleshoot;
