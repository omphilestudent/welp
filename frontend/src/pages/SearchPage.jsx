// frontend/src/pages/SearchPage.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';
import CompanyCard from '../components/companies/CompanyCard';
import Loading from '../components/common/Loading';

const SearchPage = () => {
    const [searchParams] = useSearchParams();
    const query = searchParams.get('q') || '';
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({
        page: 1,
        total: 0,
        pages: 0
    });

    useEffect(() => {
        searchCompanies(1);
    }, [query]);

    const searchCompanies = async (page) => {
        setLoading(true);
        try {
            const { data } = await api.get('/companies/search', {
                params: { q: query, page, limit: 12 }
            });
            setCompanies(data.companies);
            setPagination(data.pagination);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <Loading />;

    return (
        <div className="search-page">
            <div className="container">
                <h1 className="search-title">
                    {query ? `Search results for "${query}"` : 'All Companies'}
                </h1>

                {pagination.total > 0 && (
                    <p className="search-count">
                        Found {pagination.total} companies
                    </p>
                )}

                {companies.length > 0 ? (
                    <>
                        <div className="companies-grid">
                            {companies.map(company => (
                                <CompanyCard key={company.id} company={company} />
                            ))}
                        </div>

                        {/* Pagination */}
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
                    </>
                ) : (
                    <div className="no-results">
                        <p>No companies found matching your search.</p>
                        <p>Try different keywords or browse all companies.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchPage;