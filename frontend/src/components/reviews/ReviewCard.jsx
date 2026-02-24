// frontend/src/components/reviews/ReviewCard.jsx
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

    const canReply = () => {
        if (!user) return false;
        if (user.role === 'employee') return true;
        if (user.role === 'business') {
            // Check if this is their company (you'd need company context)
            return true;
        }
        return false;
    };

    const handleSubmitReply = async (e) => {
        e.preventDefault();
        if (!replyContent.trim()) return;

        setSubmitting(true);
        try {
            await api.post(`/reviews/${review.id}/replies`, {
                content: replyContent
            });
            setReplyContent('');
            setShowReplyForm(false);
            onReplyAdded?.();
        } catch (error) {
            console.error('Failed to add reply:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const canEdit = user && user.id === review.author_id &&
        new Date() - new Date(review.created_at) < 24 * 60 * 60 * 1000;

    return (
        <div className="review-card">
            <div className="review-header">
                <div className="review-author">
          <span className="review-author-name">
            {review.author.isanonymous ? 'Anonymous' : review.author.displayname}
          </span>
                    <span className="review-date">
            {formatDistanceToNow(new Date(review.created_at))} ago
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
                    <button className="btn btn-secondary btn-small">Delete</button>
                </div>
            )}

            {/* Replies */}
            {review.replies && review.replies.length > 0 && (
                <div className="replies-section">
                    {review.replies.map((reply) => (
                        <div key={reply.id} className="reply">
                            <div className="reply-header">
                <span className="reply-author">
                  {reply.author.role === 'business' ? reply.author.displayname : 'Employee'}
                </span>
                                <span className="reply-role">
                  {reply.author_role === 'business' ? 'Business' :
                      reply.author_role === 'psychologist' ? 'Psychologist' : 'Employee'}
                </span>
                                <span className="reply-date">
                  {formatDistanceToNow(new Date(reply.created_at))} ago
                </span>
                            </div>
                            <p className="reply-content">{reply.content}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Reply Form */}
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