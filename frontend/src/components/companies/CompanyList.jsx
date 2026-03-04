import React, { useMemo } from 'react';
import CompanyCard from './CompanyCard';
import Loading from '../common/Loading';

/**
 * CompanyList component displays companies as a grid or list with
 * robust loading, error and empty states.
 */
const CompanyList = ({
    companies = [],
    loading = false,
    error = '',
    onRetry = null,
    isGridView = true,
    emptyMessage = 'No companies found',
    className = ''
}) => {
    const validCompanies = useMemo(() => {
        if (!Array.isArray(companies)) return [];

        return companies.filter((company) => company && (company.id || company.slug || company.name));
    }, [companies]);

    if (loading) {
        return (
            <div className="company-list-loading" aria-label="Loading companies">
                <Loading
                    size="large"
                    text="Fetching companies..."
                    fullPage={false}
                />
                <div className="company-list-skeleton" aria-hidden="true">
                    {[...Array(6)].map((_, index) => (
                        <div key={`skeleton-${index}`} className="company-card-skeleton">
                            <div className="skeleton-image" />
                            <div className="skeleton-content">
                                <div className="skeleton-title" />
                                <div className="skeleton-text" />
                                <div className="skeleton-text-short" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="company-list-error" role="alert">
                <div className="error-container">
                    <h3 className="error-title">Something went wrong</h3>
                    <p className="error-message">{error}</p>
                    {onRetry && (
                        <button onClick={onRetry} className="retry-button" aria-label="Try again">
                            Try Again
                        </button>
                    )}
                </div>
            </div>
        );
    }

    if (validCompanies.length === 0) {
        return (
            <div className="company-list-empty" role="status">
                <div className="empty-container">
                    <h3 className="empty-title">{emptyMessage}</h3>
                    <p className="empty-description">
                        Try adjusting your search or filters to find what you&apos;re looking for.
                    </p>
                </div>
            </div>
        );
    }

    const listClassName = `company-list ${isGridView ? 'grid-view' : 'list-view'} ${className}`.trim();

    return (
        <div className={listClassName}>
            <div className="company-list-header" aria-live="polite">
                <p className="result-count">
                    Showing <strong>{validCompanies.length}</strong>{' '}
                    {validCompanies.length === 1 ? 'company' : 'companies'}
                </p>
            </div>

            <div className="company-list-container" role="feed" aria-busy={loading}>
                {validCompanies.map((company, index) => (
                    <CompanyCard
                        key={company.id || company.slug || company.name || `company-${index}`}
                        company={company}
                        priority={index < 4}
                    />
                ))}
            </div>

            {validCompanies.length > 20 && (
                <button
                    className="scroll-to-top"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    aria-label="Scroll to top"
                >
                    ↑
                </button>
            )}
        </div>
    );
};


export default CompanyList;
