import React, { useEffect, useMemo, useState } from 'react';
import { FaExclamationTriangle, FaEyeSlash, FaEye, FaSearch, FaTrash, FaEnvelopeOpenText, FaRedoAlt } from 'react-icons/fa';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

const ReviewModeration = () => {
    const [reviews, setReviews] = useState([]);
    const [status, setStatus] = useState('all');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [processingId, setProcessingId] = useState(null);
    const [notificationLogs, setNotificationLogs] = useState([]);
    const [logPagination, setLogPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [logStatus, setLogStatus] = useState('all');
    const [logSearch, setLogSearch] = useState('');
    const [logLoading, setLogLoading] = useState(false);
    const [logError, setLogError] = useState('');
    const [logMessage, setLogMessage] = useState('');
    const [resendingLogId, setResendingLogId] = useState(null);
    const { user } = useAuth();

    const userRole = String(user?.role || '').toLowerCase().trim();
    const isSuperAdmin = ['super_admin', 'superadmin'].includes(userRole);

    const fetchReviews = async (nextStatus = status) => {
        try {
            setLoading(true);
            setError('');
            const { data } = await api.get('/admin/reviews', { params: { status: nextStatus, limit: 100 } });
            setReviews(Array.isArray(data?.reviews) ? data.reviews : []);
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to load reviews.');
            setReviews([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReviews(status);
    }, [status]);

    const fetchNotificationLogs = async ({ page = 1, status: statusFilter = logStatus, search: searchTerm = logSearch } = {}) => {
        try {
            setLogLoading(true);
            setLogError('');
            const params = {
                page,
                limit: 10,
                status: statusFilter,
                search: searchTerm.trim() || undefined
            };
            const { data } = await api.get('/admin/review-notifications/logs', { params });
            setNotificationLogs(Array.isArray(data?.logs) ? data.logs : []);
            setLogPagination(data?.pagination || { page, pages: 1, total: 0 });
        } catch (e) {
            setLogError(e.response?.data?.error || 'Failed to load notification activity.');
            setNotificationLogs([]);
        } finally {
            setLogLoading(false);
        }
    };

    useEffect(() => {
        fetchNotificationLogs({ page: 1, status: logStatus });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [logStatus]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return reviews;
        return reviews.filter((r) =>
            [r.title, r.content, r.author_name, r.company_name, r.author_email]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query))
        );
    }, [reviews, search]);

    const setVisibility = async (id, isPublic) => {
        try {
            setProcessingId(id);
            setError('');
            await api.patch(`/admin/reviews/${id}/visibility`, { isPublic });
            await fetchReviews(status);
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to update review visibility.');
        } finally {
            setProcessingId(null);
        }
    };

    const removeReview = async (id) => {
        try {
            setProcessingId(id);
            setError('');
            await api.delete(`/admin/reviews/${id}`);
            await fetchReviews(status);
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to delete review.');
        } finally {
            setProcessingId(null);
        }
    };

    const handleLogSearch = () => {
        fetchNotificationLogs({ page: 1, status: logStatus, search: logSearch });
    };

    const handleLogPageChange = (nextPage) => {
        if (nextPage < 1 || nextPage > (logPagination.pages || 1)) return;
        fetchNotificationLogs({ page: nextPage, status: logStatus, search: logSearch });
    };

    const resendNotification = async (logId) => {
        try {
            setResendingLogId(logId);
            setLogMessage('');
            setLogError('');
            await api.post(`/admin/review-notifications/logs/${logId}/resend`);
            setLogMessage('Notification resent successfully.');
            await fetchNotificationLogs({ page: logPagination.page, status: logStatus, search: logSearch });
        } catch (e) {
            setLogError(e.response?.data?.error || 'Failed to resend notification.');
        } finally {
            setResendingLogId(null);
        }
    };

    return (
        <div className="review-page">
            <div className="review-page__header">
                <h1>Review Moderation</h1>
                <p>Reviews are auto-approved, flagged, or rejected by the system. Super admins can hide or delete.</p>
            </div>

            <div className="review-toolbar">
                <label>
                    Status
                    <select value={status} onChange={(e) => setStatus(e.target.value)}>
                        <option value="all">All</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="flagged">Flagged</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </label>

                <label className="review-search">
                    <FaSearch />
                    <input
                        type="text"
                        placeholder="Search by review, company, or author"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </label>
            </div>

            {error && (
                <p className="review-error"><FaExclamationTriangle /> {error}</p>
            )}

            {loading ? (
                <p>Loading reviews…</p>
            ) : filtered.length === 0 ? (
                <p>No reviews found for this filter.</p>
            ) : (
                <div className="review-grid">
                    {filtered.map((review) => (
                        <article key={review.id} className="review-card">
                            <header>
                                <h3>{review.title || 'Untitled review'}</h3>
                                <span>{review.company_name || 'Unknown company'}</span>
                            </header>
                            <p className="review-card__meta">
                                By {review.author_name || 'Unknown'} • {new Date(review.created_at).toLocaleString()}
                            </p>
                            <p className="review-card__status">
                                Status: {review.moderation_status || 'approved'} • {review.is_public ? 'Public' : 'Hidden'}
                            </p>
                            <p className="review-card__content">{review.content || review.review_text || 'No review body provided.'}</p>
                            {isSuperAdmin && (
                                <div className="review-card__actions">
                                    {review.is_public ? (
                                        <button disabled={processingId === review.id} onClick={() => setVisibility(review.id, false)}>
                                            <FaEyeSlash /> Hide from Public
                                        </button>
                                    ) : (
                                        <button disabled={processingId === review.id} onClick={() => setVisibility(review.id, true)}>
                                            <FaEye /> Restore Public
                                        </button>
                                    )}
                                    <button disabled={processingId === review.id} className="danger" onClick={() => removeReview(review.id)}>
                                        <FaTrash /> Delete
                                    </button>
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            )}

            <section className="notification-section" style={{ marginTop: '2.5rem' }}>
                <div className="review-page__header">
                    <h2>Review Notification Activity</h2>
                    <p>See which businesses were notified about new reviews and resend alerts when necessary.</p>
                </div>

                <div className="review-toolbar">
                    <label>
                        Status
                        <select value={logStatus} onChange={(e) => setLogStatus(e.target.value)}>
                            <option value="all">All</option>
                            <option value="sent">Sent</option>
                            <option value="failed">Failed</option>
                            <option value="awaiting_contact">Awaiting Contact</option>
                            <option value="pending">Pending</option>
                        </select>
                    </label>

                    <label className="review-search">
                        <FaSearch />
                        <input
                            type="text"
                            placeholder="Search by company or email"
                            value={logSearch}
                            onChange={(e) => setLogSearch(e.target.value)}
                        />
                    </label>
                    <button type="button" onClick={handleLogSearch} style={{ minWidth: 120 }}>
                        Apply Filter
                    </button>
                </div>

                {logError && (
                    <p className="review-error"><FaExclamationTriangle /> {logError}</p>
                )}
                {logMessage && (
                    <p style={{ color: '#047857', marginTop: 8 }}>{logMessage}</p>
                )}

                {logLoading ? (
                    <p>Loading notification activityâ€¦</p>
                ) : notificationLogs.length === 0 ? (
                    <p>No notification activity recorded.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '8px' }}><FaEnvelopeOpenText /> Company</th>
                                    <th style={{ textAlign: 'left', padding: '8px' }}>Email</th>
                                    <th style={{ textAlign: 'left', padding: '8px' }}>Status</th>
                                    <th style={{ textAlign: 'left', padding: '8px' }}>Sent At</th>
                                    <th style={{ textAlign: 'left', padding: '8px' }}>Review</th>
                                    <th style={{ textAlign: 'left', padding: '8px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {notificationLogs.map((log) => {
                                    const meta = log.metadata || {};
                                    const reviewSummary = meta.reviewExcerpt || log.content || '';
                                    return (
                                        <tr key={log.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                            <td style={{ padding: '8px' }}>
                                                <strong>{log.company_name || 'Unknown business'}</strong>
                                                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                                    Rating: {log.rating ?? meta.rating ?? 'N/A'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '8px' }}>{log.email_to}</td>
                                            <td style={{ padding: '8px' }}>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '999px',
                                                    background: log.status === 'sent' ? '#d1fae5' : log.status === 'failed' ? '#fee2e2' : '#e5e7eb',
                                                    color: log.status === 'sent' ? '#065f46' : log.status === 'failed' ? '#991b1b' : '#374151',
                                                    fontSize: '0.85rem',
                                                    textTransform: 'capitalize'
                                                }}>
                                                    {log.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                                            </td>
                                            <td style={{ padding: '8px', maxWidth: 280 }}>
                                                {reviewSummary || 'No excerpt available.'}
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => resendNotification(log.id)}
                                                    disabled={resendingLogId === log.id}
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                                >
                                                    <FaRedoAlt /> {resendingLogId === log.id ? 'Resending...' : 'Resend'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={() => handleLogPageChange((logPagination.page || 1) - 1)}
                        disabled={(logPagination.page || 1) <= 1}
                    >
                        Previous
                    </button>
                    <span>
                        Page {logPagination.page || 1} of {logPagination.pages || 1}
                    </span>
                    <button
                        type="button"
                        onClick={() => handleLogPageChange((logPagination.page || 1) + 1)}
                        disabled={(logPagination.page || 1) >= (logPagination.pages || 1)}
                    >
                        Next
                    </button>
                </div>
            </section>
        </div>
    );
};

export default ReviewModeration;
