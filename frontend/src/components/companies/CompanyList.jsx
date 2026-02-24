// frontend/src/components/companies/CompanyList.jsx
import React from 'react';
import CompanyCard from './CompanyCard';

const CompanyList = ({ companies, loading, error }) => {
    if (loading) {
        return <div className="loading-spinner">Loading...</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    if (!companies || companies.length === 0) {
        return (
            <div className="empty-state">
                <p>No companies found</p>
            </div>
        );
    }

    return (
        <div className="company-list">
            {companies.map(company => (
                <CompanyCard key={company.id} company={company} />
            ))}
        </div>
    );
};

export default CompanyList;