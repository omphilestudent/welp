
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import CompanyCard from '../components/companies/CompanyCard';
import CompanySearch from '../components/companies/CompanySearch';
import Loading from '../components/common/Loading';
import { FaBuilding } from 'react-icons/fa';
import { useAuth } from '../hooks/useAuth';
import { isWelpStaff } from '../utils/roleUtils';
import SponsoredCard from '../components/ads/SponsoredCard';
import CompactSponsoredCard from '../components/ads/CompactSponsoredCard';
import { usePlacementAds } from '../hooks/usePlacementAds';

const SearchPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const query = searchParams.get('q') || '';
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
    const { user } = useAuth();
    const [showAddCompanyForm, setShowAddCompanyForm] = useState(false);
    const [submissionMessage, setSubmissionMessage] = useState('');
    const [createForm, setCreateForm] = useState({
        name: query || '',
        website: '',
        country: '',
        city: '',
        address: '',
        phone: '',
        email: '',
        industry: '',
        description: ''
    });
    const normalizedRole = String(user?.role || '').toLowerCase();
    const adminRoles = new Set(['admin', 'super_admin', 'superadmin', 'system_admin', 'hr_admin']);
    const isAdminRole = isWelpStaff(user) || adminRoles.has(normalizedRole);
    const canSuggestCompany = user && ['employee', 'business', ...adminRoles].includes(normalizedRole);
    
    const canShowAddCompany = true;
    const { campaigns: placementAds } = usePlacementAds({ placement: 'search_results' });

    useEffect(() => {
        searchCompanies(1);
    }, [query]);

    useEffect(() => {
        setCreateForm(prev => ({ ...prev, name: query || '' }));
    }, [query]);

    const searchCompanies = async (page) => {
        setLoading(true);
        setError('');
        try {
            const params = {
                search: query || undefined,
                page,
                limit: 12
            };


            const response = await api.get('/companies/search', { params });

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

    const handleClaimRedirect = (company) => {
        if (!company?.id) return;
        navigate(`/claim/${company.id}`);
    };

    const handleCreateCompany = async (e) => {
        e.preventDefault();
        setCreateError('');
        setCreating(true);
        try {
            const payload = {
                name: createForm.name?.trim(),
                website: createForm.website?.trim() || undefined,
                country: createForm.country?.trim(),
                city: createForm.city?.trim() || undefined,
                address: createForm.address?.trim() || undefined,
                phone: createForm.phone?.trim() || undefined,
                email: createForm.email?.trim() || undefined,
                industry: createForm.industry?.trim() || undefined,
                description: createForm.description?.trim() || undefined
            };
            const endpoint = isAdminRole ? '/admin/companies' : '/companies';
            const { data } = await api.post(endpoint, payload);
            const created = data?.company;
            if (created?.id && payload.website) {
                try {
                    await api.post(`/companies/${created.id}/scrape-missing`);
                } catch {
                    // best-effort scrape
                }
            }
            setSubmissionMessage('Thanks! The company is pending review and will appear once an admin approves it.');
            setShowAddCompanyForm(false);
            setCreateForm({
                name: query || '',
                website: '',
                country: '',
                city: '',
                address: '',
                phone: '',
                email: '',
                industry: '',
                description: ''
            });
        } catch (err) {
            const message = err.response?.data?.error || 'Failed to submit company';
            setCreateError(message);
        } finally {
            setCreating(false);
        }
    };

    const handleAddCompanyClick = () => {
        setCreateError('');
        if (!user) {
            navigate('/login', { state: { from: location.pathname + location.search } });
            return;
        }
        if (!canSuggestCompany) {
            setCreateError('Only employees, business users, or admins can add companies.');
            return;
        }
        setShowAddCompanyForm(true);
        setSubmissionMessage('');
    };

    return (
        <div className="search-page">
            <div className="container">
                <h1 className="search-title">
                    {query ? `Search results for "${query}"` : 'All Companies'}
                </h1>

                <CompanySearch initialQuery={query} onSearch={(q) => {
                    navigate(`/search?q=${encodeURIComponent(q)}`);
                }} />

                <div className="filter-tabs">
                    <button
                        className="filter-tab active"
                        onClick={() => {
                            navigate(`/search${query ? `?q=${encodeURIComponent(query)}` : ''}`);
                        }}
                    >
                        <FaBuilding /> All Companies
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
                        {companies.map((company, index) => {
                            const items = [];
                            items.push(
                                <div key={company.id} className="company-card-wrapper">
                                    <CompanyCard
                                        company={company}
                                        showClaimAction
                                        onClaim={handleClaimRedirect}
                                    />
                                </div>
                            );
                            const shouldInsertAd = (index + 1) % 3 === 0;
                            const adIndex = Math.floor(index / 3);
                            const adCampaign = placementAds[adIndex];
                            if (shouldInsertAd && adCampaign) {
                                items.push(
                                    <div key={`ad-${adCampaign.id}-${adIndex}`} className="company-card-wrapper">
                                        <CompactSponsoredCard campaign={adCampaign} />
                                    </div>
                                );
                            }
                            return items;
                        })}
                    </div>
                )}

                {!loading && (
                    <section className="ads-rail">
                        <div className="ads-rail__grid">
                            <SponsoredCard
                                placement="search_results"
                                rotateIntervalMs={48000}
                            />
                        </div>
                    </section>
                )}

                {!loading && companies.length === 0 && (
                    <div className="empty-state">
                        <FaBuilding size={48} />
                        <h3>No companies found</h3>
                        <p>
                            {'Try adjusting your search or browse all companies.'}
                        </p>
                        {(query || canShowAddCompany) && (
                            <>
                                {submissionMessage && (
                                    <div className="alert alert-success" style={{ textAlign: 'center' }}>
                                        {submissionMessage}
                                    </div>
                                )}
                                {createError && !showAddCompanyForm && (
                                    <div className="alert alert-error" style={{ textAlign: 'center' }}>
                                        {createError}
                                    </div>
                                )}
                                {canShowAddCompany ? (
                                    <>
                                        {!showAddCompanyForm ? (
                                            <button
                                                type="button"
                                                className="btn btn-primary"
                                                style={{ marginTop: '1rem' }}
                                                onClick={handleAddCompanyClick}
                                            >
                                                {user
                                                    ? (query ? `Add "${query}" to the directory` : 'Add a company to the directory')
                                                    : 'Log in to add this company'}
                                            </button>
                                        ) : (
                                            <form onSubmit={handleCreateCompany} className="company-create-form" style={{ marginTop: '1rem', maxWidth: 520 }}>
                                                <h4 style={{ marginBottom: '0.5rem' }}>Add a company for review</h4>
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
                                                    <label>Country *</label>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        placeholder="South Africa"
                                                        value={createForm.country}
                                                        onChange={(e) => setCreateForm(prev => ({ ...prev, country: e.target.value }))}
                                                        required
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>City (optional)</label>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        value={createForm.city}
                                                        onChange={(e) => setCreateForm(prev => ({ ...prev, city: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Address (optional)</label>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        value={createForm.address}
                                                        onChange={(e) => setCreateForm(prev => ({ ...prev, address: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Phone (optional)</label>
                                                    <input
                                                        type="tel"
                                                        className="form-input"
                                                        value={createForm.phone}
                                                        onChange={(e) => setCreateForm(prev => ({ ...prev, phone: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Email (optional)</label>
                                                    <input
                                                        type="email"
                                                        className="form-input"
                                                        value={createForm.email}
                                                        onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
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
                                                <p style={{ fontSize: '0.85rem', color: '#4a5568', marginBottom: '0.75rem' }}>
                                                    The company will be pending review and will appear once an admin approves it.
                                                </p>
                                                <button className="btn btn-primary" type="submit" disabled={creating}>
                                                    {creating ? 'Submitting...' : 'Submit for review'}
                                                </button>
                                            </form>
                                        )}
                                    </>
                                ) : (
                                    <p style={{ marginTop: '1rem' }}>
                                        Log in as an employee or business user to add this company and leave a review.
                                    </p>
                                )}
                            </>
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

