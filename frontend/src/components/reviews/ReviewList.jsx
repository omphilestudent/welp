
import React from 'react';
import ReviewCard from './ReviewCard';

const ReviewList = ({ reviews, onReplyAdded }) => {
    if (!reviews || reviews.length === 0) {
        return (
            <div className="empty-state">
                <p>No reviews yet. Be the first to share your experience!</p>
            </div>
        );
    }

    return (
        <div className="review-list">
            {reviews.map(review => (
                <ReviewCard
                    key={review.id}
                    review={review}
                    onReplyAdded={onReplyAdded}
                />
            ))}
        </div>
    );
};

export default ReviewList;