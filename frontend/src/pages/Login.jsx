import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoginForm from '../components/auth/LoginForm';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import './Login.layout.css';
import './Login.card.css';

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { login, socialLogin } = useAuth();

    // State management
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        rememberMe: false
    });
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [loading, setLoading] = useState({
        email: false,
        google: false,
        microsoft: false,
        apple: false
    });
    const [loginMethod, setLoginMethod] = useState(null);
    const [loginAttempts, setLoginAttempts] = useState(0);
    const [isLocked, setIsLocked] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Refs for cleanup
    const mounted = useRef(true);
    const lockTimer = useRef(null);
    const verificationTimer = useRef(null);

    // Get redirect path from location state
    const inviteReturn = localStorage.getItem('welp_invite_return');
    const from = location.state?.from?.pathname || inviteReturn || '/';
    const message = location.state?.message;

    // Cleanup on unmount
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            if (lockTimer.current) {
                clearTimeout(lockTimer.current);
            }
            if (verificationTimer.current) {
                clearTimeout(verificationTimer.current);
            }
        };
    }, []);

    // Show message if redirected from protected route
    useEffect(() => {
        if (message) {
            toast.error(message, {
                duration: 4000,
                icon: '🔒'
            });
        }
    }, [message]);

    useEffect(() => {
        const raw = localStorage.getItem('welp_inactivity_logout');
        if (!raw) return;
        localStorage.removeItem('welp_inactivity_logout');
        toast.error('You have been logged out due to inactivity.');
    }, []);

    // Clear errors when switching login methods
    useEffect(() => {
        if (loginMethod) {
            setErrors({});
        }
    }, [loginMethod]);

    // Validation rules
    const validateField = useCallback((name, value) => {
        switch (name) {
            case 'email':
                if (!value) return 'Email is required';
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address';
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
    }, []);

    // Handle input changes
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;

        setFormData(prev => ({
            ...prev,
            [name]: newValue
        }));

        // Clear field error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }

        // Clear general error when user interacts
        if (errors.general) {
            setErrors(prev => ({
                ...prev,
                general: ''
            }));
        }
    };

    // Handle field blur for validation
    const handleBlur = (e) => {
        const { name } = e.target;
        setTouched(prev => ({
            ...prev,
            [name]: true
        }));

        const error = validateField(name, formData[name]);
        setErrors(prev => ({
            ...prev,
            [name]: error
        }));
    };

    // Toggle password visibility
    const togglePasswordVisibility = () => {
        setShowPassword(prev => !prev);
    };

    // Rate limiting check
    const checkRateLimit = useCallback(() => {
        const attempts = loginAttempts + 1;
        setLoginAttempts(attempts);

        if (attempts >= 5) {
            setIsLocked(true);
            toast.error('Too many login attempts. Please try again in 5 minutes.', {
                duration: 5000,
                icon: '⏳'
            });

            // Auto unlock after 5 minutes
            lockTimer.current = setTimeout(() => {
                if (mounted.current) {
                    setLoginAttempts(0);
                    setIsLocked(false);
                }
            }, 5 * 60 * 1000);

            return false;
        }
        return true;
    }, [loginAttempts]);

    // Validate entire form
    const validateForm = useCallback(() => {
        const newErrors = {
            email: validateField('email', formData.email),
            password: validateField('password', formData.password)
        };

        setErrors(prev => ({
            ...prev,
            ...newErrors
        }));

        setTouched({
            email: true,
            password: true
        });

        return !Object.values(newErrors).some(error => error);
    }, [formData.email, formData.password, validateField]);

    // Handle email login
    const handleSubmit = async (submitData) => {
        // Check if locked due to too many attempts
        if (isLocked) {
            toast.error('Account temporarily locked. Please try again later.');
            return;
        }

        // Validate form
        if (!validateForm()) {
            toast.error('Please fix the errors in the form');
            return;
        }

        // Check rate limit
        if (!checkRateLimit()) {
            return;
        }

        setLoading(prev => ({ ...prev, email: true }));
        setLoginMethod('email');
        setErrors({});

        console.log('=== Login Attempt ===');
        const payload = submitData && typeof submitData === 'object' ? submitData : formData;
        const payloadEmail = (payload.email || formData.email || '').trim();
        const payloadPassword = payload.password || formData.password;
        const payloadRemember = payload.rememberMe ?? formData.rememberMe ?? false;

        console.log('Email:', payloadEmail);
        console.log('Remember Me:', payloadRemember);

        try {
            const result = await login(
                payloadEmail,
                payloadPassword,
                payloadRemember
            );

            if (!mounted.current) return;

            if (result?.success) {
                // Reset login attempts on success
                setLoginAttempts(0);

                console.log('Login successful:', result.user);

                toast.success('Welcome back!', {
                    icon: '👋',
                    duration: 3000
                });

                // Navigate based on user role
                const userRole = result.user?.role;
                const adminRoles = ['admin', 'super_admin', 'superadmin', 'system_admin', 'hr_admin'];

                if (adminRoles.includes(userRole)) {
                    navigate('/admin/dashboard', { replace: true });
                } else {
                    navigate(from, { replace: true });
                }
                if (inviteReturn) {
                    localStorage.removeItem('welp_invite_return');
                }
            } else {
                console.log('Login failed:', result?.error);

                // Handle specific error messages
                const errorMsg = result?.error || 'Invalid email or password';

                if (errorMsg.toLowerCase().includes('invalid login method')) {
                    setErrors({
                        general: 'This account uses a different login method. Please try social login.'
                    });
                    toast.error('Please use the correct login method');
                } else if (errorMsg.toLowerCase().includes('not verified')) {
                    setErrors({
                        general: 'Please verify your email before logging in.'
                    });
                    toast.error('Email not verified');

                    // Offer to resend verification with cleanup
                    verificationTimer.current = setTimeout(() => {
                        if (mounted.current && window.confirm('Would you like us to resend the verification email?')) {
                            // Call resend verification function
                            console.log('Resend verification for:', submitData.email);
                            toast.success('Verification email sent!');
                        }
                    }, 500);
                } else {
                    setErrors({
                        general: errorMsg
                    });
                    toast.error(errorMsg);
                }
            }
        } catch (err) {
            console.error('Unexpected error:', err);

            if (!mounted.current) return;

            // Handle network errors
            const isNetworkError = err.message?.toLowerCase().includes('network') ||
                err.code === 'ERR_NETWORK' ||
                err.code === 'ECONNABORTED';

            if (isNetworkError) {
                setErrors({
                    general: 'Network error. Please check your connection.'
                });
                toast.error('Connection error');
            } else if (err.name === 'AbortError') {
                setErrors({
                    general: 'Request timeout. Please try again.'
                });
                toast.error('Request timeout');
            } else {
                setErrors({
                    general: 'An unexpected error occurred. Please try again.'
                });
                toast.error('Login failed');
            }
        } finally {
            if (mounted.current) {
                setLoading(prev => ({ ...prev, email: false }));
            }
        }
    };

    // Handle social login
    const handleSocialLogin = async (provider) => {
        // Check if locked
        if (isLocked) {
            toast.error('Too many attempts. Please try again later.');
            return;
        }

        // Prevent multiple social login attempts
        if (loading[provider]) return;

        setLoginMethod(provider);
        setLoading(prev => ({ ...prev, [provider]: true }));
        setErrors({});

        try {
            await socialLogin(provider);
            // Note: social login usually redirects, so we don't handle response here
        } catch (err) {
            console.error(`${provider} login error:`, err);

            if (mounted.current) {
                // Check if it's a popup blocked error
                if (err.message?.includes('popup') || err.code === 'ERR_BLOCKED_BY_CLIENT') {
                    setErrors({
                        general: 'Popup was blocked. Please allow popups for this site.'
                    });
                    toast.error('Please allow popups for social login');
                } else {
                    setErrors({
                        general: `${provider} login failed. Please try again.`
                    });
                    toast.error(`${provider} login failed`);
                }

                setLoading(prev => ({ ...prev, [provider]: false }));
            }
        }
    };

    // Get loading state for any social login
    const isSocialLoading = loading.google || loading.microsoft || loading.apple;

    // Prepare props for LoginForm
    const loginFormProps = {
        email: formData.email,
        password: formData.password,
        rememberMe: formData.rememberMe,
        errors,
        touched,
        loading: loading.email,
        showPassword,
        onInputChange: handleInputChange,
        onBlur: handleBlur,
        onTogglePassword: togglePasswordVisibility,
        onSubmit: handleSubmit
    };

    const heroHighlights = [
        { value: '2k+', caption: 'HR teams use Welp insights weekly' },
        { value: '24/7', caption: 'Moderation & wellbeing monitoring' },
        { value: '4.8 / 5', caption: 'Average platform satisfaction' }
    ];

    return (
        <div className="login-page">
            <div className="login-grid">
                <section className="login-hero">
                    <p className="login-hero__eyebrow">Welp for organisations</p>
                    <h1 className="login-hero__title">Clarity for every employee conversation</h1>
                    <p className="login-hero__copy">
                        Track sentiment in real time, respond to reviews faster, and keep your workforce supported with
                        in-product guidance.
                    </p>

                    <ul className="login-hero__stats">
                        {heroHighlights.map((item) => (
                            <li key={item.caption}>
                                <span>{item.value}</span>
                                <small>{item.caption}</small>
                            </li>
                        ))}
                    </ul>

                    <div className="login-hero__cta">
                        <Link to="/register" className="login-hero__link" state={{ from }}>
                            Create an account
                        </Link>
                        <p>Looking to claim a business profile? Start from the registration page.</p>
                    </div>
                </section>

                <motion.div
                    className="login-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45 }}
                >
                    <header className="login-card__header">
                        <span className="login-badge">Secure access</span>
                        <h2>Welcome back</h2>
                        <p>Sign in with your work email to continue.</p>
                    </header>

                    <AnimatePresence mode="wait">
                        {errors.general && (
                            <motion.div
                                className="login-alert login-alert--error"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                role="alert"
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    aria-hidden="true"
                                >
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                <span>{errors.general}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {loginMethod === 'email' && errors.general?.toLowerCase().includes('different login method') && (
                        <motion.div
                            className="login-alert login-alert--info"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden="true"
                            >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                            <div>
                                <strong>Different login method required</strong>
                                <p>
                                    This account was created with a social provider. Use Google, Microsoft, or Apple below to
                                    access it.
                                </p>
                            </div>
                        </motion.div>
                    )}

                    <LoginForm {...loginFormProps} />

                    <div className="login-divider">
                        <span>Or continue with</span>
                    </div>

                    <div className="login-social">
                        <button
                            onClick={() => handleSocialLogin('google')}
                            className="login-social__btn login-social__btn--google"
                            disabled={loading.email || loading.google || isLocked}
                            aria-label="Login with Google"
                            aria-busy={loading.google}
                        >
                            {loading.google ? (
                                <span>Loading?</span>
                            ) : (
                                <>
                                    <svg
                                        width="20"
                                        height="20"
                                        viewBox="0 0 24 24"
                                        aria-hidden="true"
                                    >
                                        <path
                                            fill="currentColor"
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        />
                                        <path
                                            fill="currentColor"
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        />
                                    </svg>
                                    Google
                                </>
                            )}
                        </button>

                        <button
                            onClick={() => handleSocialLogin('microsoft')}
                            className="login-social__btn login-social__btn--microsoft"
                            disabled={loading.email || loading.microsoft || isLocked}
                            aria-label="Login with Microsoft"
                            aria-busy={loading.microsoft}
                        >
                            {loading.microsoft ? (
                                <span>Loading?</span>
                            ) : (
                                <>
                                    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                                        <path fill="currentColor" d="M2 3h9v9H2zM13 3h9v9h-9zM2 13h9v9H2zM13 13h9v9h-9z" />
                                    </svg>
                                    Microsoft
                                </>
                            )}
                        </button>

                        <button
                            onClick={() => handleSocialLogin('apple')}
                            className="login-social__btn login-social__btn--apple"
                            disabled={loading.email || loading.apple || isLocked}
                            aria-label="Login with Apple"
                            aria-busy={loading.apple}
                        >
                            {loading.apple ? (
                                <span>Loading?</span>
                            ) : (
                                <>
                                    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                                        <path
                                            fill="currentColor"
                                            d="M16.4 13.2c0-2.1 1.7-3 1.8-3.1-1-.6-2.6-.7-3.2-.7-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.4 1.2 0 1.6-.8 3-.8 1.4 0 1.8.8 3 .8 1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.8-1.1-2.8-4.1zM14.9 5.3c.7-.8 1.2-1.9 1.1-3-1 .1-2.2.7-2.9 1.5-.6.7-1.2 1.8-1.1 2.9 1 .1 2.2-.5 2.9-1.4z"
                                        />
                                    </svg>
                                    Apple
                                </>
                            )}
                        </button>
                    </div>

                    <footer className="login-card__footer">
                        <p>
                            Don't have an account?{' '}
                            <Link to="/register" state={{ from }}>
                                Sign up
                            </Link>
                        </p>
                        <p>
                            <Link to="/forgot-password" state={{ email: formData.email }}>
                                Forgot password?
                            </Link>
                        </p>
                    </footer>
                </motion.div>
            </div>
        </div>
    );
};

export default Login;
