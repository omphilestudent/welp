import React, { useEffect, useMemo, useState } from 'react';
import {
    FaExclamationTriangle,
    FaEyeSlash,
    FaEye,
    FaSearch,
    FaTrash,
    FaEnvelopeOpenText,
    FaRedoAlt,
    FaStar,
    FaRegStar,
    FaFilter,
    FaChevronLeft,
    FaChevronRight,
    FaClock,
    FaCheckCircle,
    FaTimesCircle,
    FaExclamationCircle,
    FaEnvelope,
    FaBuilding,
    FaUser,
    FaCalendarAlt,
    FaBan,
    FaCheck,
    FaUndo,
    FaRegClock
} from 'react-icons/fa';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import Loading from '../../components/common/Loading';
import './ReviewModeration.css'; // We'll create this CSS file

// Modern Stat Card Component
const StatCard = ({ icon: Icon, title, value, subtitle, color = 'blue' }) => {
    const colors = {
        blue: { bg: '#3b82f620', text: '#3b82f6' },
        green: { bg: '#10b98120', text: '#10b981' },
        yellow: { bg: '#f59e0b20', text: '#f59e0b' },
        red: { bg: '#ef444420', text: '#ef4444' },
        purple: { bg: '#8b5cf620', text: '#8b5cf6' }
    };

    return (
        <div className="stat-card" style={{ '--stat-color': colors[color].text }}>
            <div className="stat-card__icon" style={{ background: colors[color].bg, color: colors[color].text }}>
                <Icon />
            </div>
            <div className="stat-card__content">
                <span className="stat-card__label">{title}</span>
                <span className="stat-card__value">{value}</span>
                {subtitle && <span className="stat-card__subtitle">{subtitle}</span>}
            </div>
        </div>
    );
};

// Modern Badge Component
const Badge = ({ children, variant = 'default', icon: Icon }) => {
    return (
        <span className={`badge badge-${variant}`}>
            {Icon && <Icon className="badge__icon" />}
            {children}
        </span>
    );
};

// Modern Rating Component
const Rating = ({ value, max = 5, size = 'small' }) => {
    return (
        <div className={`rating rating-${size}`}>
            {[...Array(max)].map((_, i) => (
                i < Math.floor(value) ? (
                    <FaStar key={i} className="rating__star filled" />
                ) : (
                    <FaRegStar key={i} className="rating__star" />
                )
            ))}
            <span className="rating__value">{value.toFixed(1)}</span>
        </div>
    );
};

// Modern Modal Component
const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal__header">
                    <h3 className="modal__title">{title}</h3>
                    <button className="modal__close" onClick={onClose}>×</button>
                </div>
                <div className="modal__body">
                    {children}
                </div>
            </div>
        </div>
    );
};

const ReviewModeration = () => {
    const [reviews, setReviews] = useState([]);
    const [status, setStatus] = useState('all');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [processingId, setProcessingId] = useState(null);
    const [selectedReview, setSelectedReview] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    // Notification logs state
    const [notificationLogs, setNotificationLogs] = useState([]);
    const [logPagination, setLogPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [logStatus, setLogStatus] = useState('all');
    const [logSearch, setLogSearch] = useState('');
    const [logLoading, setLogLoading] = useState(false);
    const [logError, setLogError] = useState('');
    const [logMessage, setLogMessage] = useState('');
    const [resendingLogId, setResendingLogId] = useState(null);
    const [showFilters, setShowFilters] = useState(false);

    const { user } = useAuth();
    const userRole = String(user?.role || '').toLowerCase().trim();
    const isSuperAdmin = ['super_admin', 'superadmin'].includes(userRole);

    // Calculate stats
    const stats = useMemo(() => ({
        total: reviews.length,
        pending: reviews.filter(r => r.moderation_status === 'pending').length,
        approved: reviews.filter(r => r.moderation_status === 'approved').length,
        flagged: reviews.filter(r => r.moderation_status === 'flagged').length,
        rejected: reviews.filter(r => r.moderation_status === 'rejected').length,
        public: reviews.filter(r => r.is_public).length,
        hidden: reviews.filter(r => !r.is_public).length
    }), [reviews]);

    // Fetch reviews
    const fetchReviews = async (nextStatus = status) => {
        try {
            setLoading(true);
            setError('');
            const { data } = await api.get('/admin/reviews', {
                params: {
                    status: nextStatus,
                    limit: 100,
                    search: search || undefined
                }
            });
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

    // Fetch notification logs
    const fetchNotificationLogs = async ({ page = 1, status: statusFilter = logStatus, search: searchTerm = logSearch } = {}) => {
        try {
            setLogLoading(true);
            setLogError('');
            const params = {
                page,
                limit: 10,
                status: statusFilter !== 'all' ? statusFilter : undefined,
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
    }, [logStatus]);

    // Filter reviews
    const filteredReviews = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return reviews;
        return reviews.filter((r) =>
            [r.title, r.content, r.author_name, r.company_name, r.author_email]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query))
        );
    }, [reviews, search]);

    // Handlers
    const handleSearch = (e) => {
        setSearch(e.target.value);
    };

    const handleStatusChange = (newStatus) => {
        setStatus(newStatus);
    };

    const handleViewDetails = (review) => {
        setSelectedReview(review);
        setShowDetailsModal(true);
    };

    const setVisibility = async (id, isPublic) => {
        try {
            setProcessingId(id);
            setError('');
            await api.patch(`/admin/reviews/${id}/visibility`, { isPublic });
            await fetchReviews(status);
            toast.success(`Review ${isPublic ? 'published' : 'hidden'} successfully`);
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to update review visibility.');
            toast.error('Failed to update review');
        } finally {
            setProcessingId(null);
        }
    };

    const removeReview = async (id) => {
        if (!window.confirm('Are you sure you want to delete this review? This action cannot be undone.')) return;

        try {
            setProcessingId(id);
            setError('');
            await api.delete(`/admin/reviews/${id}`);
            await fetchReviews(status);
            toast.success('Review deleted successfully');
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to delete review.');
            toast.error('Failed to delete review');
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
            toast.success('Notification resent');
            await fetchNotificationLogs({ page: logPagination.page, status: logStatus, search: logSearch });
        } catch (e) {
            setLogError(e.response?.data?.error || 'Failed to resend notification.');
            toast.error('Failed to resend notification');
        } finally {
            setResendingLogId(null);
        }
    };

    const getStatusIcon = (status) => {
        switch(status) {
            case 'approved': return FaCheckCircle;
            case 'pending': return FaRegClock;
            case 'flagged': return FaExclamationCircle;
            case 'rejected': return FaTimesCircle;
            default: return FaClock;
        }
    };

    return (
        <div className="review-moderation">
            {/* Header */}
            <div className="page-header">
                <div className="page-header__left">
                    <h1 className="page-header__title">Review Moderation</h1>
                    <p className="page-header__subtitle">
                        Manage and moderate user reviews across all companies
                    </p>
                </div>
                <div className="page-header__right">
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => fetchReviews(status)}
                        disabled={loading}
                    >
                        <FaRedoAlt /> Refresh
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <StatCard
                    icon={FaEnvelopeOpenText}
                    title="Total Reviews"
                    value={stats.total.toLocaleString()}
                    subtitle="All time"
                    color="blue"
                />
                <StatCard
                    icon={FaClock}
                    title="Pending"
                    value={stats.pending.toLocaleString()}
                    subtitle="Awaiting review"
                    color="yellow"
                />
                <StatCard
                    icon={FaCheckCircle}
                    title="Approved"
                    value={stats.approved.toLocaleString()}
                    subtitle="Live on platform"
                    color="green"
                />
                <StatCard
                    icon={FaExclamationCircle}
                    title="Flagged"
                    value={stats.flagged.toLocaleString()}
                    subtitle="Needs attention"
                    color="red"
                />
                <StatCard
                    icon={FaEye}
                    title="Public"
                    value={stats.public.toLocaleString()}
                    subtitle="Visible to all"
                    color="green"
                />
                <StatCard
                    icon={FaEyeSlash}
                    title="Hidden"
                    value={stats.hidden.toLocaleString()}
                    subtitle="Not visible"
                    color="purple"
                />
            </div>

            {/* Filters Bar */}
            <div className="filters-bar">
                <div className="filters-group">
                    <button
                        className={`filter-chip ${status === 'all' ? 'active' : ''}`}
                        onClick={() => handleStatusChange('all')}
                    >
                        All
                    </button>
                    <button
                        className={`filter-chip pending ${status === 'pending' ? 'active' : ''}`}
                        onClick={() => handleStatusChange('pending')}
                    >
                        <FaRegClock /> Pending
                    </button>
                    <button
                        className={`filter-chip approved ${status === 'approved' ? 'active' : ''}`}
                        onClick={() => handleStatusChange('approved')}
                    >
                        <FaCheckCircle /> Approved
                    </button>
                    <button
                        className={`filter-chip flagged ${status === 'flagged' ? 'active' : ''}`}
                        onClick={() => handleStatusChange('flagged')}
                    >
                        <FaExclamationCircle /> Flagged
                    </button>
                    <button
                        className={`filter-chip rejected ${status === 'rejected' ? 'active' : ''}`}
                        onClick={() => handleStatusChange('rejected')}
                    >
                        <FaTimesCircle /> Rejected
                    </button>
                </div>

                <div className="search-box">
                    <FaSearch className="search-box__icon" />
                    <input
                        type="text"
                        className="search-box__input"
                        placeholder="Search reviews, companies, or authors..."
                        value={search}
                        onChange={handleSearch}
                    />
                </div>

                <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setShowFilters(!showFilters)}
                >
                    <FaFilter /> {showFilters ? 'Hide' : 'Show'} Filters
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="alert alert-error">
                    <FaExclamationTriangle />
                    <span>{error}</span>
                </div>
            )}

            {/* Reviews Grid */}
            {loading ? (
                <div className="loading-container">
                    <Loading size="large" />
                </div>
            ) : filteredReviews.length === 0 ? (
                <div className="empty-state">
                    <FaEnvelopeOpenText className="empty-state__icon" />
                    <h3 className="empty-state__title">No reviews found</h3>
                    <p className="empty-state__text">Try adjusting your search or filter criteria</p>
                </div>
            ) : (
                <div className="reviews-grid">
                    {filteredReviews.map((review) => (
                        <div key={review.id} className="review-card">
                            <div className="review-card__header">
                                <div className="review-card__company">
                                    <FaBuilding className="review-card__company-icon" />
                                    <div>
                                        <h3 className="review-card__company-name">
                                            {review.company_name || 'Unknown Company'}
                                        </h3>
                                        <Rating value={review.rating || 0} />
                                    </div>
                                </div>
                                <Badge
                                    variant={review.moderation_status || 'pending'}
                                    icon={getStatusIcon(review.moderation_status)}
                                >
                                    {review.moderation_status || 'pending'}
                                </Badge>
                            </div>

                            <div className="review-card__content">
                                <h4 className="review-card__title">{review.title || 'Untitled Review'}</h4>
                                <p className="review-card__text">
                                    {review.content || review.review_text || 'No review content provided.'}
                                </p>
                            </div>

                            <div className="review-card__meta">
                                <div className="review-card__author">
                                    <FaUser className="review-card__meta-icon" />
                                    <span>{review.author_name || 'Anonymous'}</span>
                                </div>
                                <div className="review-card__date">
                                    <FaCalendarAlt className="review-card__meta-icon" />
                                    <span>{new Date(review.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="review-card__visibility">
                                    {review.is_public ? (
                                        <Badge variant="success" icon={FaEye}>Public</Badge>
                                    ) : (
                                        <Badge variant="danger" icon={FaEyeSlash}>Hidden</Badge>
                                    )}
                                </div>
                            </div>

                            <div className="review-card__actions">
                                <button
                                    className="btn btn-outline btn-sm"
                                    onClick={() => handleViewDetails(review)}
                                >
                                    <FaEye /> View
                                </button>

                                {isSuperAdmin && (
                                    <>
                                        {review.is_public ? (
                                            <button
                                                className="btn btn-warning btn-sm"
                                                onClick={() => setVisibility(review.id, false)}
                                                disabled={processingId === review.id}
                                            >
                                                <FaEyeSlash /> Hide
                                            </button>
                                        ) : (
                                            <button
                                                className="btn btn-success btn-sm"
                                                onClick={() => setVisibility(review.id, true)}
                                                disabled={processingId === review.id}
                                            >
                                                <FaEye /> Show
                                            </button>
                                        )}
                                        <button
                                            className="btn btn-danger btn-sm"
                                            onClick={() => removeReview(review.id)}
                                            disabled={processingId === review.id}
                                        >
                                            <FaTrash /> Delete
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Notification Logs Section */}
            <section className="notification-logs">
                <div className="section-header">
                    <div>
                        <h2 className="section-header__title">Notification Activity</h2>
                        <p className="section-header__subtitle">
                            Track and resend review notifications sent to businesses
                        </p>
                    </div>
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => fetchNotificationLogs({ page: 1, status: logStatus })}
                        disabled={logLoading}
                    >
                        <FaRedoAlt /> Refresh
                    </button>
                </div>

                {/* Notification Filters */}
                <div className="notification-filters">
                    <div className="filters-group">
                        <select
                            className="filter-select"
                            value={logStatus}
                            onChange={(e) => setLogStatus(e.target.value)}
                        >
                            <option value="all">All Status</option>
                            <option value="sent">Sent</option>
                            <option value="failed">Failed</option>
                            <option value="awaiting_contact">Awaiting Contact</option>
                            <option value="pending">Pending</option>
                        </select>

                        <div className="search-box small">
                            <FaSearch className="search-box__icon" />
                            <input
                                type="text"
                                className="search-box__input"
                                placeholder="Search by company or email..."
                                value={logSearch}
                                onChange={(e) => setLogSearch(e.target.value)}
                            />
                        </div>

                        <button
                            className="btn btn-primary btn-sm"
                            onClick={handleLogSearch}
                        >
                            Apply Filters
                        </button>
                    </div>
                </div>

                {/* Notification Messages */}
                {logError && (
                    <div className="alert alert-error">
                        <FaExclamationTriangle />
                        <span>{logError}</span>
                    </div>
                )}

                {logMessage && (
                    <div className="alert alert-success">
                        <FaCheckCircle />
                        <span>{logMessage}</span>
                    </div>
                )}

                {/* Notification Logs Table */}
                {logLoading ? (
                    <div className="loading-container">
                        <Loading size="medium" />
                    </div>
                ) : notificationLogs.length === 0 ? (
                    <div className="empty-state small">
                        <FaEnvelope className="empty-state__icon" />
                        <h4 className="empty-state__title">No notifications found</h4>
                        <p className="empty-state__text">No notification activity recorded for this filter</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                            <tr>
                                <th>Company</th>
                                <th>Recipient</th>
                                <th>Status</th>
                                <th>Sent At</th>
                                <th>Review</th>
                                <th>Actions</th>
                            </tr>
                            </thead>
                            <tbody>
                            {notificationLogs.map((log) => {
                                const meta = log.metadata || {};
                                const reviewSummary = meta.reviewExcerpt || log.content || '';
                                return (
                                    <tr key={log.id}>
                                        <td>
                                            <div className="company-info">
                                                <strong>{log.company_name || 'Unknown Business'}</strong>
                                                {log.rating && (
                                                    <Rating value={log.rating} size="small" />
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="recipient-info">
                                                <FaEnvelope className="recipient-icon" />
                                                <span>{log.email_to}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <Badge
                                                variant={
                                                    log.status === 'sent' ? 'success' :
                                                        log.status === 'failed' ? 'danger' :
                                                            'warning'
                                                }
                                            >
                                                {log.status}
                                            </Badge>
                                        </td>
                                        <td>
                                                <span className="date-cell">
                                                    {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                                                </span>
                                        </td>
                                        <td>
                                            <p className="review-excerpt">{reviewSummary || 'No excerpt'}</p>
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-outline btn-sm"
                                                onClick={() => resendNotification(log.id)}
                                                disabled={resendingLogId === log.id}
                                            >
                                                <FaRedoAlt />
                                                {resendingLogId === log.id ? 'Resending...' : 'Resend'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {notificationLogs.length > 0 && (
                    <div className="pagination">
                        <button
                            className="pagination__btn"
                            onClick={() => handleLogPageChange((logPagination.page || 1) - 1)}
                            disabled={(logPagination.page || 1) <= 1}
                        >
                            <FaChevronLeft />
                        </button>

                        <span className="pagination__info">
                            Page {logPagination.page || 1} of {logPagination.pages || 1}
                        </span>

                        <button
                            className="pagination__btn"
                            onClick={() => handleLogPageChange((logPagination.page || 1) + 1)}
                            disabled={(logPagination.page || 1) >= (logPagination.pages || 1)}
                        >
                            <FaChevronRight />
                        </button>
                    </div>
                )}
            </section>

            {/* Review Details Modal */}
            <Modal
                isOpen={showDetailsModal}
                onClose={() => setShowDetailsModal(false)}
                title="Review Details"
            >
                {selectedReview && (
                    <div className="review-details">
                        <div className="review-details__header">
                            <div className="review-details__company">
                                <FaBuilding className="review-details__company-icon" />
                                <div>
                                    <h3>{selectedReview.company_name || 'Unknown Company'}</h3>
                                    <Rating value={selectedReview.rating || 0} size="medium" />
                                </div>
                            </div>
                            <div className="review-details__badges">
                                <Badge variant={selectedReview.moderation_status || 'pending'}>
                                    {selectedReview.moderation_status || 'pending'}
                                </Badge>
                                {selectedReview.is_public ? (
                                    <Badge variant="success" icon={FaEye}>Public</Badge>
                                ) : (
                                    <Badge variant="danger" icon={FaEyeSlash}>Hidden</Badge>
                                )}
                            </div>
                        </div>

                        <div className="review-details__content">
                            <h4>{selectedReview.title || 'Untitled Review'}</h4>
                            <p>{selectedReview.content || selectedReview.review_text || 'No content'}</p>
                        </div>

                        <div className="review-details__grid">
                            <div className="review-details__item">
                                <FaUser className="review-details__icon" />
                                <div>
                                    <label>Author</label>
                                    <span>{selectedReview.author_name || 'Anonymous'}</span>
                                </div>
                            </div>
                            <div className="review-details__item">
                                <FaEnvelope className="review-details__icon" />
                                <div>
                                    <label>Email</label>
                                    <span>{selectedReview.author_email || 'Not provided'}</span>
                                </div>
                            </div>
                            <div className="review-details__item">
                                <FaCalendarAlt className="review-details__icon" />
                                <div>
                                    <label>Created</label>
                                    <span>{new Date(selectedReview.created_at).toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="review-details__item">
                                <FaCalendarAlt className="review-details__icon" />
                                <div>
                                    <label>Updated</label>
                                    <span>{new Date(selectedReview.updated_at).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {selectedReview.moderation_notes && (
                            <div className="review-details__notes">
                                <h4>Moderation Notes</h4>
                                <p>{selectedReview.moderation_notes}</p>
                            </div>
                        )}

                        {isSuperAdmin && (
                            <div className="review-details__actions">
                                <button
                                    className="btn btn-outline"
                                    onClick={() => setShowDetailsModal(false)}
                                >
                                    Close
                                </button>
                                {selectedReview.is_public ? (
                                    <button
                                        className="btn btn-warning"
                                        onClick={() => {
                                            setVisibility(selectedReview.id, false);
                                            setShowDetailsModal(false);
                                        }}
                                    >
                                        <FaEyeSlash /> Hide Review
                                    </button>
                                ) : (
                                    <button
                                        className="btn btn-success"
                                        onClick={() => {
                                            setVisibility(selectedReview.id, true);
                                            setShowDetailsModal(false);
                                        }}
                                    >
                                        <FaEye /> Show Review
                                    </button>
                                )}
                                <button
                                    className="btn btn-danger"
                                    onClick={() => {
                                        removeReview(selectedReview.id);
                                        setShowDetailsModal(false);
                                    }}
                                >
                                    <FaTrash /> Delete Review
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default ReviewModeration;