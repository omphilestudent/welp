import React, { useEffect, useMemo, useState } from 'react';
import { FaCheck, FaExclamationTriangle, FaFlag, FaSearch, FaTimes, FaTrash } from 'react-icons/fa';
import api from '../../services/api';

const ReviewModeration = () => {
    const [reviews, setReviews] = useState([]);
    const [status, setStatus] = useState('all');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [processingId, setProcessingId] = useState(null);

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

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return reviews;
        return reviews.filter((r) =>
            [r.title, r.content, r.author_name, r.company_name, r.author_email]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query))
        );
    }, [reviews, search]);

    const moderate = async (id, action) => {
        try {
            setProcessingId(id);
            setError('');
            await api.patch(`/admin/reviews/${id}/moderate`, { action });
            await fetchReviews(status);
        } catch (e) {
            setError(e.response?.data?.error || `Failed to ${action} review.`);
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

    return (
        <div className="review-page">
            <div className="review-page__header">
                <h1>Review Moderation</h1>
                <p>Manage real user reviews from the database and moderate what is shown publicly.</p>
            </div>

            <div className="review-toolbar">
                <label>
                    Status
                    <select value={status} onChange={(e) => setStatus(e.target.value)}>
                        <option value="all">All</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
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
                            <p className="review-card__content">{review.content || review.review_text || 'No review body provided.'}</p>
                            <div className="review-card__actions">
                                <button disabled={processingId === review.id} onClick={() => moderate(review.id, 'approve')}>
                                    <FaCheck /> Approve
                                </button>
                                <button disabled={processingId === review.id} onClick={() => moderate(review.id, 'reject')}>
                                    <FaTimes /> Reject
                                </button>
                                <button disabled={processingId === review.id} onClick={() => moderate(review.id, 'flag')}>
                                    <FaFlag /> Flag
                                </button>
                                <button disabled={processingId === review.id} className="danger" onClick={() => removeReview(review.id)}>
                                    <FaTrash /> Delete
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ReviewModeration;
