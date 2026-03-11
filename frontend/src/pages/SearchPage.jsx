
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import CompanyCard from '../components/companies/CompanyCard';
import CompanySearch from '../components/companies/CompanySearch';
import Loading from '../components/common/Loading';
import { FaBuilding, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { useAuth } from '../hooks/useAuth';

const SearchPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const query = searchParams.get('q') || '';
    const unclaimed = searchParams.get('unclaimed') === 'true';
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [createError, setCreateError] = useState('');
    const [creating, setCreating] = useState(false);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        pages: 0
    });
    const [filter, setFilter] = useState(unclaimed ? 'unclaimed' : 'all');
    const { user } = useAuth();
    const [createForm, setCreateForm] = useState({
        name: query || '',
        website: '',
        industry: '',
        description: ''
    });

    useEffect(() => {
        searchCompanies(1);
    }, [query, filter]);

    useEffect(() => {
        setCreateForm(prev => ({ ...prev, name: query || '' }));
    }, [query]);

    const searchCompanies = async (page) => {
        setLoading(true);
        setError('');
        try {
            console.log('Searching companies with query:', query, 'filter:', filter);

            const params = {
                q: query || undefined,
                page,
                limit: 12
            };


            if (filter === 'unclaimed') {
                params.unclaimed = true;
            }

            const response = await api.get('/companies/search', { params });

            console.log('API Response:', response.data);

            setCompanies(response.data.companies || []);
            setPagination(response.data.pagination || {
                page: 1,
                limit: 20,
                total: 0,
                pages: 0
            });
        } catch (error) {
            console.error('Search failed:', error);
            setError(error.response?.data?.error || 'Failed to search companies');
        } finally {
            setLoading(false);
        }
    };

    const handleClaimClick = (companyId) => {
        navigate(`/claim/${companyId}`);
    };

    const handleCreateCompany = async (e) => {
        e.preventDefault();
        setCreateError('');
        setCreating(true);
        try {
            const payload = {
                name: createForm.name?.trim(),
                website: createForm.website?.trim() || undefined,
                industry: createForm.industry?.trim() || undefined,
                description: createForm.description?.trim() || undefined
            };
            const response = await api.post('/companies', payload);
            navigate(`/companies/${response.data.id}`);
        } catch (err) {
            const message = err.response?.data?.error || 'Failed to create company';
            setCreateError(message);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="search-page">
            <div className="container">
                <h1 className="search-title">
                    {unclaimed ? 'Companies Ready to Claim' : (query ? `Search results for "${query}"` : 'All Companies')}
                </h1>

                <CompanySearch initialQuery={query} onSearch={(q) => {
                    navigate(`/search?q=${encodeURIComponent(q)}${filter === 'unclaimed' ? '&unclaimed=true' : ''}`);
                }} />

                {}
                <div className="filter-tabs">
                    <button
                        className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                        onClick={() => {
                            setFilter('all');
                            navigate(`/search${query ? `?q=${encodeURIComponent(query)}` : ''}`);
                        }}
                    >
                        <FaBuilding /> All Companies
                    </button>
                    <button
                        className={`filter-tab ${filter === 'unclaimed' ? 'active' : ''}`}
                        onClick={() => {
                            setFilter('unclaimed');
                            navigate(`/search?unclaimed=true${query ? `&q=${encodeURIComponent(query)}` : ''}`);
                        }}
                    >
                        <FaExclamationTriangle /> Unclaimed Companies
                    </button>
                </div>

                {error && (
                    <div className="alert alert-error">
                        {error}
                    </div>
                )}

                {pagination.total > 0 && (
                    <p className="search-count">
                        Found {pagination.total} companies
                    </p>
                )}

                {loading ? (
                    <Loading />
                ) : (
                    <div className="companies-grid">
                        {companies.map(company => (
                            <div key={company.id} className="company-card-wrapper">
                                <CompanyCard company={company} />
                                {filter === 'unclaimed' && (
                                    <button
                                        onClick={() => handleClaimClick(company.id)}
                                        className="btn btn-primary claim-now-btn"
                                    >
                                        Claim Now
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {!loading && companies.length === 0 && (
                    <div className="empty-state">
                        <FaBuilding size={48} />
                        <h3>No companies found</h3>
                        <p>
                            {filter === 'unclaimed'
                                ? 'There are no unclaimed companies matching your criteria.'
                                : 'Try adjusting your search or browse all companies.'}
                        </p>
                        {filter !== 'unclaimed' && query && (user?.role === 'employee' || user?.role === 'business') && (
                            <form onSubmit={handleCreateCompany} className="company-create-form" style={{ marginTop: '1rem', maxWidth: 520 }}>
                                <h4 style={{ marginBottom: '0.5rem' }}>Add this company so you can review it</h4>
                                {createError && <div className="alert alert-error">{createError}</div>}
                                <div className="form-group">
                                    <label>Company name *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={createForm.name}
                                        onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Website (optional)</label>
                                    <input
                                        type="url"
                                        className="form-input"
                                        placeholder="https://example.com"
                                        value={createForm.website}
                                        onChange={(e) => setCreateForm(prev => ({ ...prev, website: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Industry (optional)</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={createForm.industry}
                                        onChange={(e) => setCreateForm(prev => ({ ...prev, industry: e.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Description (optional)</label>
                                    <textarea
                                        className="form-textarea"
                                        rows={3}
                                        value={createForm.description}
                                        onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                                    />
                                </div>
                                <button className="btn btn-primary" type="submit" disabled={creating}>
                                    {creating ? 'Creating...' : 'Create Company'}
                                </button>
                            </form>
                        )}
                        {filter !== 'unclaimed' && query && !user && (
                            <p style={{ marginTop: '1rem' }}>
                                Log in as an employee or business user to add this company and leave a review.
                            </p>
                        )}
                    </div>
                )}

                {pagination.pages > 1 && (
                    <div className="pagination">
                        <button
                            onClick={() => searchCompanies(pagination.page - 1)}
                            disabled={pagination.page === 1}
                            className="btn btn-secondary"
                        >
                            Previous
                        </button>
                        <span className="page-info">
                            Page {pagination.page} of {pagination.pages}
                        </span>
                        <button
                            onClick={() => searchCompanies(pagination.page + 1)}
                            disabled={pagination.page === pagination.pages}
                            className="btn btn-secondary"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchPage;
