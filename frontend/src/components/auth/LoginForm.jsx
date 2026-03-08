import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './LoginForm.css';

const LoginForm = ({
                       email: propEmail = '',
                       password: propPassword = '',
                       rememberMe: propRememberMe = false,
                       errors: propErrors = {},
                       touched: propTouched = {},
                       loading = false,
                       showPassword = false,
                       onInputChange,
                       onBlur,
                       onTogglePassword,
                       onSubmit
                   }) => {
    const [formData, setFormData] = useState({
        email: propEmail,
        password: propPassword,
        rememberMe: propRememberMe
    });
    const [localErrors, setLocalErrors] = useState({});
    const [localTouched, setLocalTouched] = useState({});
    const [localShowPassword, setLocalShowPassword] = useState(false);
    const [submitAttempted, setSubmitAttempted] = useState(false);

    // Use props if provided, otherwise use local state
    const errors = Object.keys(propErrors).length > 0 ? propErrors : localErrors;
    const touched = Object.keys(propTouched).length > 0 ? propTouched : localTouched;
    const isPasswordVisible = showPassword !== undefined ? showPassword : localShowPassword;

    // Refs for focus management
    const emailInputRef = useRef(null);
    const passwordInputRef = useRef(null);
    const formRef = useRef(null);

    // Update local state when props change
    useEffect(() => {
        setFormData({
            email: propEmail,
            password: propPassword,
            rememberMe: propRememberMe
        });
    }, [propEmail, propPassword, propRememberMe]);

    // Focus email input on mount
    useEffect(() => {
        if (emailInputRef.current && !propEmail) {
            emailInputRef.current.focus();
        }
    }, [propEmail]);

    // Reset form when loading changes from true to false (submission complete)
    useEffect(() => {
        if (!loading && submitAttempted) {
            setSubmitAttempted(false);
        }
    }, [loading, submitAttempted]);

    // Validation rules
    const validateField = (name, value) => {
        switch (name) {
            case 'email':
                if (!value) return 'Email is required';
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    return 'Please enter a valid email address';
                }
                if (value.length > 255) return 'Email is too long';
                return '';

            case 'password':
                if (!value) return 'Password is required';
                if (value.length < 6) return 'Password must be at least 6 characters';
                if (value.length > 128) return 'Password is too long';
                return '';

            default:
                return '';
        }
    };

    // Validate entire form
    const validateForm = () => {
        const newErrors = {
            email: validateField('email', formData.email),
            password: validateField('password', formData.password)
        };

        if (Object.keys(propErrors).length === 0) {
            setLocalErrors(newErrors);
        }

        setLocalTouched({
            email: true,
            password: true
        });

        return !Object.values(newErrors).some(error => error);
    };

    // Handle input changes
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;

        // Update local state
        setFormData(prev => ({
            ...prev,
            [name]: newValue
        }));

        // Call parent handler if provided
        if (onInputChange) {
            onInputChange(e);
        } else {
            // Local validation
            if (localErrors[name]) {
                setLocalErrors(prev => ({
                    ...prev,
                    [name]: ''
                }));
            }
        }
    };

    // Handle field blur for validation
    const handleBlur = (e) => {
        const { name, value } = e.target;

        if (onBlur) {
            onBlur(e);
        } else {
            setLocalTouched(prev => ({
                ...prev,
                [name]: true
            }));

            const error = validateField(name, value);
            setLocalErrors(prev => ({
                ...prev,
                [name]: error
            }));
        }
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Prevent double submission
        if (loading) return;

        setSubmitAttempted(true);

        // Validate all fields
        const isValid = validateForm();

        if (isValid) {
            try {
                // Pass form data to parent
                await onSubmit(formData);
            } catch (error) {
                console.error('Form submission error:', error);
            }
        } else {
            // Focus the first field with error
            const currentErrors = Object.keys(propErrors).length > 0 ? propErrors : localErrors;
            if (currentErrors.email) {
                emailInputRef.current?.focus();
            } else if (currentErrors.password) {
                passwordInputRef.current?.focus();
            }
        }
    };

    // Toggle password visibility
    const togglePasswordVisibility = () => {
        if (onTogglePassword) {
            onTogglePassword();
        } else {
            setLocalShowPassword(prev => !prev);
        }
    };

    // Handle Enter key for form submission
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    // Get password strength indicator
    const getPasswordStrength = (password) => {
        if (!password) return { strength: 0, label: '' };

        let strength = 0;
        if (password.length >= 8) strength++;
        if (/(?=.*[A-Z])/.test(password)) strength++;
        if (/(?=.*[a-z])/.test(password)) strength++;
        if (/(?=.*\d)/.test(password)) strength++;
        if (/(?=.*[!@#$%^&*])/.test(password)) strength++;

        const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
        const colors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#059669'];

        return {
            strength: Math.min(strength, 5),
            label: labels[Math.min(strength, 5)],
            color: colors[Math.min(strength, 5)]
        };
    };

    const passwordStrength = getPasswordStrength(formData.password);

    // Determine which errors to display
    const displayErrors = Object.keys(propErrors).length > 0 ? propErrors : localErrors;
    const displayTouched = Object.keys(propTouched).length > 0 ? propTouched : localTouched;

    return (
        <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="auth-form"
            noValidate
            aria-label="Login form"
        >
            {/* Email Field */}
            <div className="form-group">
                <label htmlFor="email" className="form-label">
                    Email Address
                    <span className="required-indicator" aria-hidden="true">*</span>
                </label>
                <div className="input-wrapper">
                    <svg
                        className="input-icon"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                    >
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                    </svg>
                    <input
                        ref={emailInputRef}
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        className={`form-input ${displayTouched.email && displayErrors.email ? 'error' : ''} ${loading ? 'loading' : ''}`}
                        placeholder="Enter your email"
                        disabled={loading}
                        autoComplete="email"
                        autoFocus={!propEmail}
                        required
                        aria-required="true"
                        aria-invalid={displayTouched.email && !!displayErrors.email}
                        aria-describedby={displayErrors.email ? 'email-error' : undefined}
                        inputMode="email"
                    />
                </div>
                {displayTouched.email && displayErrors.email && (
                    <div id="email-error" className="error-text" role="alert">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>{displayErrors.email}</span>
                    </div>
                )}
            </div>

            {/* Password Field */}
            <div className="form-group">
                <label htmlFor="password" className="form-label">
                    Password
                    <span className="required-indicator" aria-hidden="true">*</span>
                </label>
                <div className="input-wrapper">
                    <svg
                        className="input-icon"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        aria-hidden="true"
                    >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <input
                        ref={passwordInputRef}
                        type={isPasswordVisible ? 'text' : 'password'}
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        className={`form-input ${displayTouched.password && displayErrors.password ? 'error' : ''} ${loading ? 'loading' : ''}`}
                        placeholder="Enter your password"
                        disabled={loading}
                        autoComplete="current-password"
                        required
                        aria-required="true"
                        aria-invalid={displayTouched.password && !!displayErrors.password}
                        aria-describedby={displayErrors.password ? 'password-error' : 'password-strength'}
                    />
                    <button
                        type="button"
                        className="password-toggle"
                        onClick={togglePasswordVisibility}
                        disabled={loading}
                        aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                        title={isPasswordVisible ? 'Hide password' : 'Show password'}
                    >
                        {isPasswordVisible ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                        )}
                    </button>
                </div>

                {/* Password Strength Indicator */}
                {formData.password && !displayErrors.password && (
                    <div className="password-strength" id="password-strength">
                        <div className="strength-bar">
                            <div
                                className="strength-fill"
                                style={{
                                    width: `${(passwordStrength.strength / 5) * 100}%`,
                                    backgroundColor: passwordStrength.color
                                }}
                            />
                        </div>
                        <span className="strength-text" style={{ color: passwordStrength.color }}>
                            {passwordStrength.label}
                        </span>
                    </div>
                )}

                {displayTouched.password && displayErrors.password && (
                    <div id="password-error" className="error-text" role="alert">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>{displayErrors.password}</span>
                    </div>
                )}
            </div>

            {/* Form Options */}
            <div className="form-options">
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        name="rememberMe"
                        className="checkbox-input"
                        checked={formData.rememberMe}
                        onChange={handleChange}
                        disabled={loading}
                    />
                    <span className="checkbox-text">Remember me</span>
                </label>
            </div>

            {/* Submit Button */}
            <div className="form-group">
                <button
                    type="submit"
                    className={`btn btn-primary btn-block ${loading ? 'loading' : ''}`}
                    disabled={loading}
                    aria-busy={loading}
                    aria-label={loading ? 'Logging in...' : 'Log in'}
                >
                    {loading ? (
                        <>
                            <span className="spinner" aria-hidden="true"></span>
                            <span className="loading-text">Logging in...</span>
                        </>
                    ) : (
                        'Log In'
                    )}
                </button>
            </div>

            {/* Links */}
            <div className="form-links">
                <Link
                    to="/forgot-password"
                    className="form-link"
                    state={{ email: formData.email }}
                    tabIndex={loading ? -1 : 0}
                >
                    Forgot password?
                </Link>
            </div>

            {/* CSRF token field - REMOVED COMPLETELY */}
        </form>
    );
};

export default LoginForm;