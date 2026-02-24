// frontend/src/pages/Register.jsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Register = () => {
    const navigate = useNavigate();
    const { register } = useAuth();
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        role: 'employee',
        isAnonymous: false,
        displayName: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({
            ...formData,
            [e.target.name]: value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // For anonymous users, don't send email/password
        const registrationData = formData.isAnonymous
            ? {
                role: formData.role,
                isAnonymous: true,
                displayName: formData.displayName || `Anonymous${Date.now()}`
            }
            : {
                email: formData.email,
                password: formData.password,
                role: formData.role,
                isAnonymous: false,
                displayName: formData.displayName || formData.email.split('@')[0]
            };

        const result = await register(registrationData);

        if (result.success) {
            navigate('/');
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    return (
        <div className="auth-page">
            <div className="auth-container">
                <div className="auth-card">
                    <h1 className="auth-title">Create Account</h1>
                    <p className="auth-subtitle">Join Welp today</p>

                    {error && (
                        <div className="alert alert-error">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="auth-form">
                        {/* Role Selection */}
                        <div className="form-group">
                            <label className="form-label">I am a...</label>
                            <div className="role-options">
                                <label className="role-option">
                                    <input
                                        type="radio"
                                        name="role"
                                        value="employee"
                                        checked={formData.role === 'employee'}
                                        onChange={handleChange}
                                    />
                                    <span>Employee</span>
                                </label>
                                <label className="role-option">
                                    <input
                                        type="radio"
                                        name="role"
                                        value="psychologist"
                                        checked={formData.role === 'psychologist'}
                                        onChange={handleChange}
                                    />
                                    <span>Psychologist</span>
                                </label>
                                <label className="role-option">
                                    <input
                                        type="radio"
                                        name="role"
                                        value="business"
                                        checked={formData.role === 'business'}
                                        onChange={handleChange}
                                    />
                                    <span>Business</span>
                                </label>
                            </div>
                        </div>

                        {/* Anonymous Option */}
                        <div className="form-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    name="isAnonymous"
                                    checked={formData.isAnonymous}
                                    onChange={handleChange}
                                />
                                <span>Create anonymous account</span>
                            </label>
                            <p className="checkbox-help">
                                Your identity will be hidden when posting reviews
                            </p>
                        </div>

                        {/* Display Name */}
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
                            />
                        </div>

                        {/* Email (not for anonymous) */}
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
                                        required
                                        className="form-input"
                                        placeholder="Enter your email"
                                    />
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
                                        required
                                        className="form-input"
                                        placeholder="Create a password"
                                    />
                                    <p className="input-help">Must be at least 6 characters</p>
                                </div>
                            </>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary btn-block"
                        >
                            {loading ? 'Creating Account...' : 'Sign Up'}
                        </button>
                    </form>

                    <div className="auth-footer">
                        <p>
                            Already have an account?{' '}
                            <Link to="/login" className="auth-link">
                                Log in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;