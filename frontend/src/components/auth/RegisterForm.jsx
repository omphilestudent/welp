// src/components/auth/RegisterForm.jsx
import React, { useState } from 'react';

const RegisterForm = ({ onSubmit, loading }) => {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        role: 'employee',
        isAnonymous: false,
        displayName: ''
    });
    const [errors, setErrors] = useState({});

    const validate = () => {
        const newErrors = {};

        if (!formData.isAnonymous) {
            if (!formData.email) {
                newErrors.email = 'Email is required';
            } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
                newErrors.email = 'Email is invalid';
            }

            if (!formData.password) {
                newErrors.password = 'Password is required';
            } else if (formData.password.length < 6) {
                newErrors.password = 'Password must be at least 6 characters';
            }

            if (formData.password !== formData.confirmPassword) {
                newErrors.confirmPassword = 'Passwords do not match';
            }
        }

        return newErrors;
    };

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({
            ...formData,
            [e.target.name]: value
        });
        if (errors[e.target.name]) {
            setErrors({
                ...errors,
                [e.target.name]: null
            });
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const newErrors = validate();
        if (Object.keys(newErrors).length === 0) {
            const { confirmPassword, ...submitData } = formData;
            onSubmit(submitData);
        } else {
            setErrors(newErrors);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
                <label className="form-label">I am a...</label>
                <div className="role-options">
                    {['employee', 'psychologist', 'business'].map(role => (
                        <label key={role} className="role-option">
                            <input
                                type="radio"
                                name="role"
                                value={role}
                                checked={formData.role === role}
                                onChange={handleChange}
                                disabled={loading}
                            />
                            <span>{role.charAt(0).toUpperCase() + role.slice(1)}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="form-group">
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        name="isAnonymous"
                        checked={formData.isAnonymous}
                        onChange={handleChange}
                        disabled={loading}
                    />
                    <span>Create anonymous account</span>
                </label>
                <p className="checkbox-help">
                    Your identity will be hidden when posting reviews
                </p>
            </div>

            <div className="form-group">
                <label htmlFor="displayName" className="form-label">
                    Display Name
                </label>
                <input
                    type="text"
                    id="displayName"
                    name="displayName"
                    value={formData.displayName}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="How should we call you?"
                    disabled={loading}
                />
            </div>

            {!formData.isAnonymous && (
                <>
                    <div className="form-group">
                        <label htmlFor="email" className="form-label">
                            Email
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className={`form-input ${errors.email ? 'error' : ''}`}
                            placeholder="Enter your email"
                            disabled={loading}
                        />
                        {errors.email && <span className="error-text">{errors.email}</span>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="password" className="form-label">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            className={`form-input ${errors.password ? 'error' : ''}`}
                            placeholder="Create a password"
                            disabled={loading}
                        />
                        {errors.password && <span className="error-text">{errors.password}</span>}
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword" className="form-label">
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                            placeholder="Confirm your password"
                            disabled={loading}
                        />
                        {errors.confirmPassword && (
                            <span className="error-text">{errors.confirmPassword}</span>
                        )}
                    </div>
                </>
            )}

            <div className="form-group">
                <button
                    type="submit"
                    className="btn btn-primary btn-block"
                    disabled={loading}
                >
                    {loading ? 'Creating Account...' : 'Sign Up'}
                </button>
            </div>
        </form>
    );
};

export default RegisterForm;