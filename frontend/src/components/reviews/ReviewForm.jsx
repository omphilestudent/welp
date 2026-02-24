// frontend/src/components/reviews/ReviewForm.jsx
import React, { useState } from 'react';
import StarRating from './StarRating';

const ReviewForm = ({ onSubmit, onCancel, initialData = {} }) => {
    const [formData, setFormData] = useState({
        rating: initialData.rating || 0,
        content: initialData.content || '',
        isPublic: initialData.isPublic !== undefined ? initialData.isPublic : true
    });
    const [errors, setErrors] = useState({});

    const validate = () => {
        const newErrors = {};
        if (formData.rating === 0) {
            newErrors.rating = 'Please select a rating';
        }
        if (formData.content.length < 10) {
            newErrors.content = 'Review must be at least 10 characters';
        }
        if (formData.content.length > 2000) {
            newErrors.content = 'Review cannot exceed 2000 characters';
        }
        return newErrors;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const newErrors = validate();
        if (Object.keys(newErrors).length === 0) {
            onSubmit(formData);
        } else {
            setErrors(newErrors);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="review-form">
            <div className="form-group">
                <label className="form-label">Rating *</label>
                <StarRating
                    rating={formData.rating}
                    onRatingChange={(rating) => setFormData({ ...formData, rating })}
                />
                {errors.rating && <span className="error-text">{errors.rating}</span>}
            </div>

            <div className="form-group">
                <label htmlFor="content" className="form-label">
                    Your Review *
                </label>
                <textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Share your experience working here..."
                    className="form-textarea"
                    rows="6"
                />
                <div className="character-count">
                    {formData.content.length}/2000
                </div>
                {errors.content && <span className="error-text">{errors.content}</span>}
            </div>

            <div className="form-group">
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={formData.isPublic}
                        onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                    />
                    <span>Make this review public</span>
                </label>
                <p className="checkbox-help">
                    Public reviews can be seen by everyone. Private reviews are only visible to you.
                </p>
            </div>

            <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                    Submit Review
                </button>
                {onCancel && (
                    <button type="button" onClick={onCancel} className="btn btn-secondary">
                        Cancel
                    </button>
                )}
            </div>
        </form>
    );
};

export default ReviewForm;