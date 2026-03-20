import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    FiAlertCircle,
    FiArrowLeft,
    FiEye,
    FiEyeOff,
    FiKey,
    FiLock,
    FiLogIn,
    FiMail,
    FiShield
} from 'react-icons/fi';

import { kodiPageLogin, setKodiPageToken } from '../../services/kodiPageService';

import './KodiLogin.layout.css';
import './KodiLogin.form.css';

const KodiLogin = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const pageSlug = useMemo(() => String(slug || '').trim(), [slug]);

    const [form, setForm] = useState({ username: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [pageInfo, setPageInfo] = useState(null);

    useEffect(() => {
        const remembered = localStorage.getItem('kodi_remember_username') || '';
        if (remembered) {
            setForm((p) => ({ ...p, username: remembered }));
            setRememberMe(true);
        }
    }, []);

    useEffect(() => {
        if (!pageSlug) return;
        setPageInfo({
            name: pageSlug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            description: 'Secure access to Kodi page content'
        });
    }, [pageSlug]);

    const validateField = (name, value) => {
        if (name === 'username') {
            if (!value) return 'Username is required';
            if (value.length < 3) return 'Username must be at least 3 characters';
            return '';
        }
        if (name === 'password') {
            if (!value) return 'Password is required';
            if (value.length < 6) return 'Password must be at least 6 characters';
            return '';
        }
        return '';
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
    };

    const handleBlur = (e) => {
        const { name } = e.target;
        setTouched((prev) => ({ ...prev, [name]: true }));
        setErrors((prev) => ({ ...prev, [name]: validateField(name, form[name]) }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!pageSlug) return toast.error('Invalid page link');

        const nextErrors = {
            username: validateField('username', form.username),
            password: validateField('password', form.password)
        };
        setErrors(nextErrors);
        setTouched({ username: true, password: true });
        if (nextErrors.username || nextErrors.password) {
            toast.error('Please fix the errors before submitting');
            return;
        }

        setLoading(true);
        try {
            // Backend expects only { pageSlug, username, password }.
            const res = await kodiPageLogin({ pageSlug, username: form.username, password: form.password });
            const token = res?.data?.token;
            if (!token) throw new Error('Missing session token');

            setKodiPageToken(token);

            if (rememberMe) {
                localStorage.setItem('kodi_remember_username', form.username);
            } else {
                localStorage.removeItem('kodi_remember_username');
            }

            toast.success('Login successful');
            navigate(`/kodi/page/${pageSlug}`, { replace: true });
        } catch (error) {
            const msg = error?.response?.data?.error || 'Login failed';
            setErrors({ submit: msg });
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const isValid = !errors.username && !errors.password && form.username && form.password;

    return (
        <div className="kodi-login-container">
            <div className="login-bg-pattern" />

            <Link to="/" className="login-back-link">
                <FiArrowLeft /> Back to Home
            </Link>

            <div className="login-card">
                <div className="login-header">
                    <div className="login-logo">
                        <FiShield className="logo-icon" />
                        <span className="logo-text">Kodi</span>
                    </div>
                    <h1 className="login-title">Welcome Back</h1>
                    <p className="login-subtitle">
                        Sign in to access <strong>{pageInfo?.name || pageSlug}</strong>
                    </p>
                </div>

                <div className="page-info-banner">
                    <FiKey className="banner-icon" />
                    <div className="banner-content">
                        <span className="banner-title">{pageInfo?.name || pageSlug}</span>
                        <span className="banner-description">{pageInfo?.description}</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    <div className={`form-group ${touched.username && errors.username ? 'error' : ''}`}>
                        <label htmlFor="username">
                            <FiMail className="field-icon" />
                            Username or Email
                        </label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            value={form.username}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            placeholder="Enter your username"
                            autoComplete="username"
                            disabled={loading}
                        />
                        {touched.username && errors.username ? (
                            <span className="error-message">
                                <FiAlertCircle /> {errors.username}
                            </span>
                        ) : null}
                    </div>

                    <div className={`form-group ${touched.password && errors.password ? 'error' : ''}`}>
                        <label htmlFor="password">
                            <FiLock className="field-icon" />
                            Password
                        </label>
                        <div className="password-input-wrapper">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id="password"
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                placeholder="Enter your password"
                                autoComplete="current-password"
                                disabled={loading}
                            />
                            <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword((p) => !p)}
                                tabIndex={-1}
                            >
                                {showPassword ? <FiEyeOff /> : <FiEye />}
                            </button>
                        </div>
                        {touched.password && errors.password ? (
                            <span className="error-message">
                                <FiAlertCircle /> {errors.password}
                            </span>
                        ) : null}
                    </div>

                    <div className="form-options">
                        <label className="remember-me">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                disabled={loading}
                            />
                            <span>Remember me</span>
                        </label>
                    </div>

                    {errors.submit ? (
                        <div className="submit-error">
                            <FiAlertCircle /> {errors.submit}
                        </div>
                    ) : null}

                    <button
                        type="submit"
                        className={`login-button ${!isValid ? 'disabled' : ''}`}
                        disabled={loading || !isValid}
                    >
                        {loading ? (
                            <>
                                <span className="spinner" />
                                Signing in...
                            </>
                        ) : (
                            <>
                                <FiLogIn /> Sign In
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default KodiLogin;
