
import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import StarRating from './StarRating';

const ReviewCard = ({ review, onReplyAdded }) => {
    const { user } = useAuth();
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const canReply = () => {
        if (!user) return false;
        if (user.role === 'employee') return true;
        if (user.role === 'business') return true;
        if (user.role === 'psychologist') return true;
        return false;
    };

    const reviewCreatedAt = review.created_at || review.createdAt;
    const canEdit = user && user.id === review.author_id &&
        new Date() - new Date(reviewCreatedAt) < 24 * 60 * 60 * 1000;

    const handleSubmitReply = async (e) => {
        e.preventDefault();
        if (!replyContent.trim()) return;

        setSubmitting(true);
        setError('');
        try {
            await api.post(`/reviews/${review.id}/replies`, {
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

    return (
        <div className="review-card">
            <div className="review-header">
                <div className="review-author">
          <span className="review-author-name">
            {review.author?.isAnonymous || review.author?.is_anonymous
                ? 'Anonymous'
                : (review.author?.display_name || review.author?.displayName || 'Unknown')}
          </span>
                    <span className="review-date">
            {formatDistanceToNow(new Date(reviewCreatedAt))} ago
          </span>
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
