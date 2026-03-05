
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import CompanyCard from '../components/companies/CompanyCard';
import CompanySearch from '../components/companies/CompanySearch';
import Loading from '../components/common/Loading';
import { FaBuilding, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

const SearchPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const query = searchParams.get('q') || '';
    const unclaimed = searchParams.get('unclaimed') === 'true';
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        pages: 0
    });
    const [filter, setFilter] = useState(unclaimed ? 'unclaimed' : 'all');

    useEffect(() => {
        searchCompanies(1);
    }, [query, filter]);

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