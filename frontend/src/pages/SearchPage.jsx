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
    const [error, setError] = useState('');

    useEffect(() => {
        fetchCompanies();
    }, [query]);

    const fetchCompanies = async () => {
        setLoading(true);
        setError('');
        try {
            console.log('Fetching companies...');
            const response = await api.get('/companies/search', {
                params: { q: query || undefined }
            });

            console.log('API Response:', response.data);

            // Make sure we're setting the companies array correctly
            if (response.data && Array.isArray(response.data.companies)) {
                setCompanies(response.data.companies);
            } else {
                setCompanies([]);
                console.error('Unexpected response format:', response.data);
            }
        } catch (error) {
            console.error('Search failed:', error);
            setError(error.response?.data?.error || 'Failed to load companies');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading companies...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="error-container">
                <p className="error-text">{error}</p>
                <button onClick={fetchCompanies} className="btn btn-primary">
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="search-page">
            <div className="container">
                <h1 className="search-title">
                    {query ? `Search results for "${query}"` : 'All Companies'}
                </h1>

                {companies.length === 0 ? (
                    <div className="empty-state">
                        <p>No companies found</p>
                        <p>Try a different search term</p>
                    </div>
                ) : (
                    <>
                        <p className="search-count">Found {companies.length} companies</p>
                        <div className="companies-grid">
                            {companies.map(company => (
                                <CompanyCard key={company.id} company={company} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default SearchPage;