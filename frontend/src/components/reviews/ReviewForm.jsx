
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import StarRating from './StarRating';
import { FaBuilding, FaBriefcase, FaUser } from 'react-icons/fa';

const ReviewForm = ({ onSubmit, onCancel, initialData = {}, companyId }) => {
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        rating: initialData.rating || 0,
        content: initialData.content || '',
        isPublic: initialData.isPublic !== undefined ? initialData.isPublic : true,
        isAnonymous: initialData.isAnonymous !== undefined ? initialData.isAnonymous : false,
        occupation: user?.occupation || '',
        workplaceId: user?.workplace_id || null
    });

    const [userProfile, setUserProfile] = useState(null);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        fetchUserProfile();
    }, []);

    const fetchUserProfile = async () => {
        try {
            const { data } = await api.get('/users/profile');
            setUserProfile(data);
            setFormData(prev => ({
                ...prev,
                occupation: data.occupation || '',
                workplaceId: data.workplace_id
            }));
        } catch (error) {
            console.error('Failed to fetch profile:', error);
        }
    };

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
        if (!formData.occupation) {
            newErrors.occupation = 'Please add your occupation in your profile';
        }
        if (!formData.workplaceId) {
            newErrors.workplace = 'Please add your workplace in your profile';
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

    if (!userProfile?.occupation || !userProfile?.workplace_id) {
        return (
            <div className="review-form warning">
                <div className="alert alert-warning">
                    <h3>Complete Your Profile First</h3>
                    <p>Before writing a review, please add your occupation and workplace in your profile settings.</p>
                    <button
                        onClick={() => window.location.href = '/settings'}
                        className="btn btn-primary"
                    >
                        Go to Profile Settings
                    </button>
                    {onCancel && (
                        <button onClick={onCancel} className="btn btn-secondary">
                            Cancel
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="review-form">
            <div className="reviewer-info">
                <div className="info-item">
                    <FaBriefcase /> <strong>Occupation:</strong> {userProfile.occupation}
                </div>
                <div className="info-item">
                    <FaBuilding /> <strong>Workplace:</strong> {userProfile.workplace?.name || 'Not set'}
                </div>
            </div>

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
                    Public reviews can be seen by everyone.
                </p>
            </div>

            <div className="form-group">
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={formData.isAnonymous}
                        onChange={(e) => setFormData({ ...formData, isAnonymous: e.target.checked })}
                    />
                    <span>Post this review anonymously</span>
                </label>
                <p className="checkbox-help">
                    When checked, your name will be hidden from the company and psychologists reviewing this post.
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
