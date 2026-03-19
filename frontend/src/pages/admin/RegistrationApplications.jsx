import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaCheckCircle, FaClock, FaSearch } from 'react-icons/fa';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { resolveMediaUrl } from '../../utils/media';

const STATUS_OPTIONS = [
    { value: 'pending_review', label: 'Pending Review' },
    { value: 'under_verification', label: 'Under Verification' },
    { value: 'awaiting_information', label: 'Awaiting Additional Information' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All statuses' }
];

const TYPE_OPTIONS = [
    { value: 'all', label: 'All profiles' },
    { value: 'psychologist', label: 'Psychologist' },
    { value: 'business', label: 'Business Owner' }
];

const CHECKLIST_FIELDS = {
    psychologist: [
        { key: 'documents', label: 'Documents verification', action: 'verify_documents' },
        { key: 'ownership', label: 'Ownership confirmation', action: 'verify_ownership' },
        { key: 'experience', label: 'Experience verification', action: 'verify_experience' }
    ],
    business: [
        { key: 'documents', label: 'Documents verification', action: 'verify_documents' },
        { key: 'ownership', label: 'Ownership confirmation', action: 'verify_ownership' }
    ]
};

const formatDateTime = (value) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString();
    } catch {
        return value;
    }
};

const formatRelative = (value) => {
    if (!value) return '';
    const diff = Date.now() - new Date(value).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days > 0) return `${days}d ago`;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours > 0) return `${hours}h ago`;
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
};

const RegistrationApplications = () => {
    const [applications, setApplications] = useState([]);
    const [statusFilter, setStatusFilter] = useState('pending_review');
    const [typeFilter, setTypeFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState(null);
    const [notes, setNotes] = useState('');
    const [actionLoading, setActionLoading] = useState('');
    const selectionRef = useRef(null);

    useEffect(() => {
        selectionRef.current = selectedId;
    }, [selectedId]);

    const fetchApplications = useCallback(async ({ preserveSelection = false } = {}) => {
        try {
            setLoading(true);
            setError('');
            const { data } = await api.get('/admin/registration-applications', {
                params: {
                    status: statusFilter,
                    type: typeFilter
                }
            });
            const list = Array.isArray(data?.applications) ? data.applications : [];
            setApplications(list);
            if (!list.length) {
                setSelectedId(null);
                return;
            }
            const activeSelection = selectionRef.current;
            if (preserveSelection && activeSelection && list.some((app) => app.id === activeSelection)) {
                return;
            }
            setSelectedId(list[0].id);
        } catch (err) {
            setApplications([]);
            setSelectedId(null);
            setError(err?.response?.data?.error || 'Failed to load applications.');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, typeFilter, selectedId]);

    useEffect(() => {
        fetchApplications();
    }, [fetchApplications]);

    const filteredApplications = useMemo(() => {
        if (!search.trim()) return applications;
        const query = search.trim().toLowerCase();
        return applications.filter((app) => {
            const haystack = [
                app.applicant_name,
                app.applicant_email,
                app.metadata?.registrationNumber,
                app.metadata?.companyName,
                app.metadata?.licenseNumber
            ].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(query);
        });
    }, [applications, search]);

    useEffect(() => {
        if (!filteredApplications.length) {
            setSelectedId(null);
            return;
        }
        if (!selectedId || !filteredApplications.some((app) => app.id === selectedId)) {
            setSelectedId(filteredApplications[0].id);
        }
    }, [filteredApplications, selectedId]);

    const selectedApplication = useMemo(
        () => filteredApplications.find((app) => app.id === selectedId),
        [filteredApplications, selectedId]
    );

    useEffect(() => {
        setNotes(selectedApplication?.adminNotes || '');
    }, [selectedApplication?.id]);

    const handleAction = async (action, options = {}) => {
        const { requireNotes = false, includeNotes = false, confirmMessage } = options;
        if (!selectedApplication) return;
        if (requireNotes && !notes.trim()) {
            toast.error('Please add reviewer notes before sending this action.');
            return;
        }
        if (confirmMessage && !window.confirm(confirmMessage)) {
            return;
        }
        setActionLoading(action);
        try {
            await api.patch(`/admin/registration-applications/${selectedApplication.id}`, {
                type: selectedApplication.application_type,
                action,
                ...(includeNotes && notes.trim() ? { notes: notes.trim() } : {})
            });
            toast.success('Application updated');
            await fetchApplications({ preserveSelection: true });
        } catch (err) {
            toast.error(err?.response?.data?.error || 'Failed to update application.');
        } finally {
            setActionLoading('');
        }
    };

    const checklistFields = selectedApplication
        ? CHECKLIST_FIELDS[selectedApplication.application_type] || []
        : [];

    return (
        <div className="admin-applications">
            <div className="review-page__header">
                <h1>Registration Applications</h1>
                <p>Manage psychologist registrations and business claims through a structured three-step workflow.</p>
            </div>

            <div className="review-toolbar">
                <label>
                    Status
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </label>
                <label>
                    Profile type
                    <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                        {TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </label>
                <label className="review-search">
                    <FaSearch />
                    <input
                        type="text"
                        placeholder="Search by name, email, or registration number"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </label>
            </div>

            {error && <p className="review-error">{error}</p>}
            {loading ? (
                <p>Loading applications…</p>
            ) : (
                <div className="applications-grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem' }}>
                    <div className="application-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {filteredApplications.length === 0 ? (
                            <p>No applications found.</p>
                        ) : (
                            filteredApplications.map((app) => {
                                const isSelected = app.id === selectedId;
                                return (
                                    <button
                                        key={app.id}
                                        onClick={() => setSelectedId(app.id)}
                                        className="application-card"
                                        style={{
                                            textAlign: 'left',
                                            borderRadius: '12px',
                                            border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                                            padding: '0.9rem',
                                            background: isSelected ? '#f0f4ff' : '#fff',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <strong>{app.applicant_name || app.metadata?.companyName || 'Applicant'}</strong>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{app.profile_type}</div>
                                            </div>
                                            <span
                                                style={{
                                                    fontSize: '0.75rem',
                                                    padding: '0.15rem 0.5rem',
                                                    borderRadius: '999px',
                                                    background: '#e0e7ff',
                                                    color: '#312e81'
                                                }}
                                            >
                                                {app.statusLabel}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                                            Submitted {formatRelative(app.submittedAt)}
                                        </div>
                                        <div style={{ marginTop: '0.5rem', height: '6px', background: '#e2e8f0', borderRadius: '999px' }}>
                                            <div
                                                style={{
                                                    height: '100%',
                                                    borderRadius: '999px',
                                                    width: `${app.verificationProgress || 0}%`,
                                                    background: '#2563eb'
                                                }}
                                            />
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    <div className="application-detail" style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.5rem' }}>
                        {!selectedApplication ? (
                            <p>Select an application to review details.</p>
                        ) : (
                            <>
                                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                                    <div>
                                        <h2 style={{ marginBottom: '0.25rem' }}>
                                            {selectedApplication.applicant_name || selectedApplication.metadata?.companyName || 'Applicant'}
                                        </h2>
                                        <p style={{ color: '#64748b', margin: 0 }}>{selectedApplication.applicant_email}</p>
                                        <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.85rem' }}>
                                            {selectedApplication.profile_type} • Submitted {formatDateTime(selectedApplication.submittedAt)}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span
                                            style={{
                                                fontSize: '0.85rem',
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '999px',
                                                background: '#dbeafe',
                                                color: '#1d4ed8'
                                            }}
                                        >
                                            {selectedApplication.statusLabel}
                                        </span>
                                        <p style={{ marginTop: '0.35rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                                            {selectedApplication.verificationProgress}% checklist complete
                                        </p>
                                        <p style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: '#64748b' }}>
                                            KYC: {selectedApplication.kyc_status || 'unknown'} • Docs {selectedApplication.documents_submitted ? 'submitted' : 'missing'}
                                        </p>
                                    </div>
                                </header>

                                <section style={{ marginTop: '1.25rem' }}>
                                    <h3 style={{ marginBottom: '0.5rem' }}>Verification checklist</h3>
                                    <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                                        {checklistFields.map((field) => {
                                            const fieldState = selectedApplication.checklist?.[field.key] || {};
                                            const verified = fieldState.verified;
                                            return (
                                                <div
                                                    key={field.key}
                                                    style={{
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '12px',
                                                        padding: '0.85rem',
                                                        background: verified ? '#ecfdf5' : '#fff'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        {verified ? <FaCheckCircle color="#047857" /> : <FaClock color="#f97316" />}
                                                        <strong>{field.label}</strong>
                                                    </div>
                                                    <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.4rem' }}>
                                                        {verified
                                                            ? `Verified ${formatDateTime(fieldState.verifiedAt)}`
                                                            : 'Awaiting verification'}
                                                    </p>
                                                    {verified ? (
                                                        fieldState.verifiedByName && (
                                                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
                                                                {fieldState.verifiedByName}
                                                            </p>
                                                        )
                                                    ) : (
                                                        <button
                                                            onClick={() => handleAction(field.action)}
                                                            disabled={actionLoading === field.action}
                                                            className="btn btn-primary"
                                                            style={{ marginTop: '0.5rem' }}
                                                        >
                                                            {actionLoading === field.action ? 'Saving…' : 'Mark as verified'}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>

                                <section style={{ marginTop: '1.25rem' }}>
                                    <h3 style={{ marginBottom: '0.5rem' }}>Documents</h3>
                                    {selectedApplication.documents?.length ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                            {selectedApplication.documents.map((doc) => (
                                                <div
                                                    key={doc.id}
                                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.6rem 0.8rem' }}
                                                >
                                                    <div>
                                                        <strong>{doc.label}</strong>
                                                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{doc.filename || doc.type}</div>
                                                    </div>
                                                    <a
                                                        href={resolveMediaUrl(doc.url)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-secondary"
                                                    >
                                                        View
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p>No documents uploaded.</p>
                                    )}
                                    <div style={{ marginTop: '0.6rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                                        Required: {selectedApplication.requiredDocuments.map((doc) => {
                                            const hasDoc = selectedApplication.documents?.some((uploaded) => uploaded.type === doc.type);
                                            return (
                                                <span key={doc.type} style={{ marginRight: '0.35rem' }}>
                                                    {hasDoc ? '✔' : '•'} {doc.label}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </section>

                                <section style={{ marginTop: '1.25rem' }}>
                                    <h3 style={{ marginBottom: '0.5rem' }}>Applicant information</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                                        {[
                                            { label: 'License number', value: selectedApplication.metadata?.licenseNumber },
                                            { label: 'License body', value: selectedApplication.metadata?.licenseBody },
                                            { label: 'Experience', value: selectedApplication.metadata?.yearsExperience },
                                            { label: 'Registration number', value: selectedApplication.metadata?.registrationNumber },
                                            { label: 'Company', value: selectedApplication.metadata?.companyName },
                                            { label: 'Country', value: selectedApplication.metadata?.country },
                                            { label: 'Job title', value: selectedApplication.metadata?.jobTitle }
                                        ].filter((item) => item.value).map((item) => (
                                            <div key={item.label} style={{ padding: '0.65rem', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.label}</div>
                                                <div>{item.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                    {selectedApplication.metadata?.contactInformation && (
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#475569' }}>
                                            <strong>Business contact:</strong>{' '}
                                            {selectedApplication.metadata.contactInformation.name} • {selectedApplication.metadata.contactInformation.email} •{' '}
                                            {selectedApplication.metadata.contactInformation.phone}
                                        </div>
                                    )}
                                </section>

                                <section style={{ marginTop: '1.25rem' }}>
                                    <h3 style={{ marginBottom: '0.5rem' }}>Timeline</h3>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                        {selectedApplication.timeline?.map((event) => (
                                            <li key={`${event.key}-${event.at}`} style={{ padding: '0.45rem 0', borderBottom: '1px solid #f1f5f9' }}>
                                                <div style={{ fontWeight: 600 }}>{event.label}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{formatDateTime(event.at)}</div>
                                            </li>
                                        ))}
                                    </ul>
                                </section>

                                <section style={{ marginTop: '1.25rem' }}>
                                    <h3 style={{ marginBottom: '0.5rem' }}>Reviewer notes</h3>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Add context for approvals, rejections, or info requests"
                                        rows={4}
                                        style={{ width: '100%', borderRadius: '10px', border: '1px solid #d1d5db', padding: '0.75rem' }}
                                    />
                                </section>

                                <section style={{ marginTop: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => handleAction('request_info', { requireNotes: true, includeNotes: true })}
                                        disabled={actionLoading === 'request_info'}
                                    >
                                        {actionLoading === 'request_info' ? 'Requesting…' : 'Request info'}
                                    </button>
                                    <button
                                        className="btn btn-danger"
                                        onClick={() => handleAction('reject', { includeNotes: true, confirmMessage: 'Reject this application?' })}
                                        disabled={actionLoading === 'reject'}
                                    >
                                        {actionLoading === 'reject' ? 'Rejecting…' : 'Reject'}
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => handleAction('approve', { includeNotes: true })}
                                        disabled={!selectedApplication.readyForDecision || actionLoading === 'approve'}
                                    >
                                        {actionLoading === 'approve' ? 'Approving…' : 'Approve application'}
                                    </button>
                                </section>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RegistrationApplications;
