// src/components/companies/CompanyList.jsx
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import CompanyCard from './CompanyCard';
import Loading from '../common/Loading';

/**
 * CompanyList component displays a grid/list of company cards
 * @param {Object} props - Component props
 * @param {Array} props.companies - Array of company objects
 * @param {boolean} props.loading - Loading state
 * @param {string|null} props.error - Error message if any
 * @param {Function} props.onRetry - Optional retry function for error cases
 * @param {boolean} props.isGridView - Toggle between grid and list view (default: true)
 */
const CompanyList = ({
                         companies,
                         loading,
                         error,
                         onRetry,
                         isGridView = true,
                         emptyMessage = 'No companies found',
                         className = ''
                     }) => {

    // Memoize the companies array to prevent unnecessary re-renders
    const validCompanies = useMemo(() => {
        if (!Array.isArray(companies)) return [];
        return companies.filter(company => company && company.id);
    }, [companies]);

    // Loading state with skeleton loading for better UX
    if (loading) {
        return (
            <div className="company-list-loading" aria-label="Loading companies">
                <Loading
                    size="large"
                    text="Fetching companies..."
                    fullPage={false}
                />
                {/* Skeleton loading for visual feedback */}
                <div className="company-list-skeleton" aria-hidden="true">
                    {[...Array(6)].map((_, index) => (
                        <div key={index} className="company-card-skeleton">
                            <div className="skeleton-image"></div>
                            <div className="skeleton-content">
                                <div className="skeleton-title"></div>
                                <div className="skeleton-text"></div>
                                <div className="skeleton-text-short"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // Error state with retry option
    if (error) {
        return (
            <div className="company-list-error" role="alert">
                <div className="error-container">
                    <svg
                        className="error-icon"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                        <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                        />
                    </svg>
                    <h3 className="error-title">Something went wrong</h3>
                    <p className="error-message">{error}</p>
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className="retry-button"
                            aria-label="Try again"
                        >
                            Try Again
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Empty state with helpful message
    if (validCompanies.length === 0) {
        return (
            <div className="company-list-empty" role="status">
                <div className="empty-container">
                    <svg
                        className="empty-icon"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                    </svg>
                    <h3 className="empty-title">{emptyMessage}</h3>
                    <p className="empty-description">
                        Try adjusting your search or filters to find what you're looking for.
                    </p>
                </div>
            </div>
        );
    }

    // Main content with companies
    const listClassName = `company-list ${isGridView ? 'grid-view' : 'list-view'} ${className}`.trim();

    return (
        <div className={listClassName}>
            {/* Optional: Show result count for better context */}
            <div className="company-list-header" aria-live="polite">
                <p className="result-count">
                    Showing <strong>{validCompanies.length}</strong> {validCompanies.length === 1 ? 'company' : 'companies'}
                </p>
            </div>

            {/* Companies grid/list */}
            <div className="company-list-container" role="feed" aria-busy={loading}>
                {validCompanies.map((company, index) => (
                    <CompanyCard
                        key={company.id}
                        company={company}
                        priority={index < 4} // Prioritize loading first 4 images
                    />
                ))}
            </div>

            {/* Optional: Scroll to top button when many items */}
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

// PropTypes for better type checking and documentation
CompanyList.propTypes = {
    companies: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
            name: PropTypes.string,
            industry: PropTypes.string,
            // Add other expected company properties
        })
    ),
    loading: PropTypes.bool,
    error: PropTypes.string,
    onRetry: PropTypes.func,
    isGridView: PropTypes.bool,
    emptyMessage: PropTypes.string,
    className: PropTypes.string
};

// Default props
CompanyList.defaultProps = {
    companies: [],
    loading: false,
    error: null,
    onRetry: null,
    isGridView: true,
    emptyMessage: 'No companies found',
    className: ''
};

export default CompanyList;