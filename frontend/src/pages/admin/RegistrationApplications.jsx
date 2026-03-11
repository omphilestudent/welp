import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { FaCheck, FaTimes, FaSearch, FaUserMd, FaBuilding } from 'react-icons/fa';

const RegistrationApplications = () => {
    const [applications, setApplications] = useState([]);
    const [status, setStatus] = useState('pending');
    const [type, setType] = useState('all');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [processingId, setProcessingId] = useState(null);

    const fetchApplications = async () => {
        try {
            setLoading(true);
            setError('');
            const { data } = await api.get('/admin/registration-applications', {
                params: { status, type }
            });
            setApplications(Array.isArray(data?.applications) ? data.applications : []);
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to load applications.');
            setApplications([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchApplications();
    }, [status, type]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return applications;
        return applications.filter((a) =>
            [a.user_email, a.user_name, a.company_name, a.full_name, a.email]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query))
        );
    }, [applications, search]);

    const reviewApplication = async (id, applicationType, nextStatus) => {
        try {
            setProcessingId(id);
            setError('');
            await api.patch(`/admin/registration-applications/${id}`, {
                type: applicationType,
                status: nextStatus
            });
            await fetchApplications();
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to update application.');
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="admin-applications">
            <div className="review-page__header">
                <h1>Registration Applications</h1>
                <p>Review psychologist and business registrations.</p>
            </div>

            <div className="review-toolbar">
                <label>
                    Status
                    <select value={status} onChange={(e) => setStatus(e.target.value)}>
                        <option value="all">All</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </label>

                <label>
                    Type
                    <select value={type} onChange={(e) => setType(e.target.value)}>
                        <option value="all">All</option>
                        <option value="psychologist">Psychologist</option>
                        <option value="business">Business</option>
                    </select>
                </label>

                <label className="review-search">
                    <FaSearch />
                    <input
                        type="text"
                        placeholder="Search by name or email"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </label>
            </div>

            {error && <p className="review-error">{error}</p>}

            {loading ? (
                <p>Loading applications…</p>
            ) : filtered.length === 0 ? (
                <p>No applications found.</p>
            ) : (
                <div className="review-grid">
                    {filtered.map((app) => {
                        const isPsych = app.application_type === 'psychologist';
                        return (
                            <article key={app.id} className="review-card">
                                <header>
                                    <h3>
                                        {isPsych ? <FaUserMd /> : <FaBuilding />} {app.user_name || app.full_name || app.company_name || 'Applicant'}
                                    </h3>
                                    <span>{app.user_email || app.email}</span>
                                </header>
                                <p className="review-card__meta">
                                    Type: {app.application_type} • Status: {app.status}
                                </p>

                                {isPsych && (
                                    <p className="review-card__content">
                                        License: {app.license_number || app.licenseNumber || '—'} • Experience: {app.years_experience || app.years_of_experience || '—'}
                                    </p>
                                )}

                                {!isPsych && (
                                    <p className="review-card__content">
                                        Company: {app.company_name || '—'} • Website: {app.company_website || '—'}
                                    </p>
                                )}

                                <div className="review-card__actions">
                                    <button
                                        disabled={processingId === app.id}
                                        onClick={() => reviewApplication(app.id, app.application_type, 'approved')}
                                    >
                                        <FaCheck /> Approve
                                    </button>
                                    <button
                                        disabled={processingId === app.id}
                                        className="danger"
                                        onClick={() => reviewApplication(app.id, app.application_type, 'rejected')}
                                    >
                                        <FaTimes /> Reject
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default RegistrationApplications;
