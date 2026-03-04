// src/components/companies/CompanyList.jsx
import React, { useMemo } from 'react';
import CompanyCard from './CompanyCard';
import Loading from '../common/Loading';

const CompanyList = ({ companies = [], loading = false, error = '' }) => {
    const normalizedCompanies = useMemo(() => {
        if (!Array.isArray(companies)) {
            return [];
        }

        return companies.filter((company) => company && typeof company === 'object');
    }, [companies]);

    if (loading) {
        return <Loading />;
    }

    if (error) {
        return (
            <div className="empty-state" role="alert" aria-live="polite">
                <p className="error-text">{error}</p>
            </div>
        );
    }

    if (normalizedCompanies.length === 0) {
        return (
            <div className="empty-state" aria-live="polite">
                <p>No companies found</p>
            </div>
        );
    }

    return (
        <div className="companies-grid" aria-live="polite">
            {normalizedCompanies.map((company, index) => (
                <CompanyCard
                    key={company.id || company.slug || company.name || `company-${index}`}
                    company={company}
                />
            ))}
        </div>
    );
};

export default CompanyList;
