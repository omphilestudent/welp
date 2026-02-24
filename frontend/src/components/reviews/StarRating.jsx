// frontend/src/components/reviews/StarRating.jsx
import React from 'react';

const StarRating = ({ rating, onRatingChange, readonly = false }) => {
    const stars = [1, 2, 3, 4, 5];

    return (
        <div className="star-rating">
            {stars.map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={() => !readonly && onRatingChange?.(star)}
                    className={readonly ? 'star-readonly' : 'star-button'}
                    disabled={readonly}
                >
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill={star <= rating ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        className={star <= rating ? 'star-filled' : 'star-empty'}
                    >
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                </button>
            ))}
        </div>
    );
};

export default StarRating;