
import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import StarRating from './StarRating';
import toast from 'react-hot-toast';
import { REVIEW_TYPES, REVIEW_TYPE_LABELS } from '../../utils/reviewTypes';

const ReviewCard = ({ review, onReplyAdded, replyEndpoint }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [messaging, setMessaging] = useState(false);

    const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

    const canReply = () => {
        if (!user) return false;
        if (user.role === 'employee') return true;
        if (user.role === 'business') return true;
        if (user.role === 'psychologist') return true;
        return false;
    };

    const reviewCreatedAt = review.created_at || review.createdAt;
    const isAuthorAnonymous = Boolean(
        review.is_anonymous ||
        review.author?.isAnonymous ||
        review.author?.is_anonymous
    );
    const reviewerRoleRaw = review.author?.role || review.author_role || '';
    const reviewerRole = !isAuthorAnonymous && reviewerRoleRaw
        ? reviewerRoleRaw.replace(/_/g, ' ')
        : null;
    const reviewType = review.review_type || review.reviewType || REVIEW_TYPES.COMPANY;
    const reviewStage = review.review_stage || review.reviewStage;
    const reviewDate = review.review_date || review.reviewDate;
    const canEdit = user && user.id === review.author_id &&
        new Date() - new Date(reviewCreatedAt) < 24 * 60 * 60 * 1000;

    const handleSubmitReply = async (e) => {
        e.preventDefault();
        if (!replyContent.trim()) return;

        setSubmitting(true);
        setError('');
        try {
            const endpoint = replyEndpoint || `/reviews/${review.id}/replies`;
            await api.post(endpoint, {
                content: replyContent
            });
            setReplyContent('');
            setShowReplyForm(false);
            onReplyAdded?.();
        } catch (error) {
            setError(error.response?.data?.error || 'Failed to add reply');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this review?')) return;

        try {
            await api.delete(`/reviews/${review.id}`);
            onReplyAdded?.();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to delete review');
        }
    };

    const handlePrivateMessage = async () => {
        const authorId = review.author?.id || review.author_id;
        const authorRole = String(review.author?.role || review.author_role || '').toLowerCase();
        if (!authorId) {
            toast.error('This reviewer cannot be messaged.');
            return;
        }
        if (authorRole && authorRole !== 'employee') {
            toast.error('This reviewer cannot be messaged.');
            return;
        }
        if (!isUuid(authorId)) {
            toast.error('This reviewer cannot be messaged yet.');
            return;
        }
        if (isAuthorAnonymous) {
            toast.error('Anonymous reviewers cannot be messaged.');
            return;
        }
        if (messaging) return;
        try {
            setMessaging(true);
            const { data } = await api.post('/messages/conversations/request', {
                employeeId: authorId,
                initialMessage: 'Hello, I read your review and wanted to offer private support.'
            });
            toast.success('Private message request sent');
            const conversationId = data?.id || data?.conversation?.id;
            if (conversationId) {
                navigate(`/messages?conversation=${conversationId}`);
            } else {
                navigate(`/messages?employee=${authorId}`);
            }
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to send private message');
        } finally {
            setMessaging(false);
        }
    };

    return (
        <div className="review-card">
            <div className="review-header">
                <div className="review-author">
                    <span className="review-author-name">
                        {isAuthorAnonymous
                            ? 'Anonymous'
                            : (review.author?.display_name || review.author?.displayName || 'Unknown')}
                    </span>
                    {reviewerRole && (
                        <span className="review-author-role">
                            {reviewerRole}
                        </span>
                    )}
                    <span className="review-date">
            {formatDistanceToNow(new Date(reviewCreatedAt))} ago
          </span>
                    {reviewType && reviewType !== REVIEW_TYPES.COMPANY && (
                        <span className="review-badge review-badge--type">
                            {REVIEW_TYPE_LABELS[reviewType] || 'Review'}
                        </span>
                    )}
                    {reviewStage && (
                        <span className="review-badge review-badge--stage">
                            {String(reviewStage).replace(/^\w/, (c) => c.toUpperCase())}
                        </span>
                    )}
                    {reviewType === REVIEW_TYPES.DAILY && reviewDate && (
                        <span className="review-badge review-badge--date">
                            {new Date(reviewDate).toLocaleDateString()}
                        </span>
                    )}
                    {review.isNew && (
                        <span className="review-badge">New</span>
                    )}
                </div>
                <div className="review-rating">
                    <StarRating rating={review.rating} readonly />
                </div>
            </div>

            <div className="review-content">
                <p>{review.content}</p>
            </div>

            {canEdit && (
                <div className="review-actions">
                    <button className="btn btn-secondary btn-small">Edit</button>
                    <button onClick={handleDelete} className="btn btn-secondary btn-small">Delete</button>
                </div>
            )}

            {user?.role === 'psychologist' && (
                <div className="review-actions">
                    <button
                        onClick={handlePrivateMessage}
                        className="btn btn-primary btn-small"
                        disabled={messaging}
                    >
                        {messaging ? 'Sending...' : 'Private encrypted message'}
                    </button>
                </div>
            )}

            {review.replies && review.replies.length > 0 && (
                <div className="replies-section">
                    {review.replies.map((reply) => (
                        <div key={reply.id} className="reply">
                            <div className="reply-header">
                <span className="reply-author">
                  {reply.author?.display_name || reply.author?.displayName || 'Unknown'}
                </span>
                                <span className="reply-role">
                  {(reply.authorRole || reply.author_role) === 'business' ? 'Business' :
                      (reply.authorRole || reply.author_role) === 'psychologist' ? 'Psychologist' : 'Employee'}
                </span>
                                <span className="reply-date">
                  {formatDistanceToNow(new Date(reply.createdAt || reply.created_at))} ago
                </span>
                            </div>
                            <p className="reply-content">{reply.content}</p>
                        </div>
                    ))}
                </div>
            )}

            {canReply() && !showReplyForm && (
                <button
                    onClick={() => setShowReplyForm(true)}
                    className="btn btn-secondary btn-small"
                >
                    Reply
                </button>
            )}

            {showReplyForm && (
                <form onSubmit={handleSubmitReply} className="reply-form">
                    {error && <div className="alert alert-error">{error}</div>}
                    <textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Write your reply..."
                        className="form-textarea"
                        rows="3"
                    />
                    <div className="reply-form-actions">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="btn btn-primary"
                        >
                            {submitting ? 'Posting...' : 'Post Reply'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowReplyForm(false)}
                            className="btn btn-secondary"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default ReviewCard;
