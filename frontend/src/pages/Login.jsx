import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoginForm from '../components/auth/LoginForm';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

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
        github: false
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
    const from = location.state?.from?.pathname || '/';
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
    const isSocialLoading = loading.google || loading.github;

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

    // Inline styles as fallback
    const styles = {
        authPage: {
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '20px'
        },
        container: {
            width: '100%',
            maxWidth: '450px',
            margin: '0 auto'
        },
        authCard: {
            background: 'white',
            borderRadius: '20px',
            padding: '40px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
        },
        authTitle: {
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#333',
            marginBottom: '10px',
            textAlign: 'center'
        },
        authSubtitle: {
            fontSize: '1rem',
            color: '#666',
            marginBottom: '30px',
            textAlign: 'center'
        },
        alert: {
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
        },
        alertError: {
            background: '#fee',
            color: '#c00',
            border: '1px solid #fcc'
        },
        alertInfo: {
            background: '#e6f3ff',
            color: '#0066cc',
            border: '1px solid #b8daff'
        },
        socialLogin: {
            marginTop: '30px'
        },
        divider: {
            textAlign: 'center',
            position: 'relative',
            margin: '20px 0'
        },
        dividerText: {
            background: 'white',
            padding: '0 10px',
            color: '#999',
            fontSize: '0.9rem',
            position: 'relative',
            zIndex: 1
        },
        dividerLine: {
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: '1px',
            background: '#ddd',
            zIndex: 0
        },
        socialButtons: {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '15px'
        },
        socialBtn: {
            padding: '12px',
            border: 'none',
            borderRadius: '10px',
            fontSize: '0.95rem',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            transition: 'all 0.3s ease'
        },
        googleBtn: {
            background: '#fff',
            color: '#333',
            border: '1px solid #ddd'
        },
        githubBtn: {
            background: '#333',
            color: '#fff',
            border: '1px solid #333'
        },
        authFooter: {
            marginTop: '30px',
            textAlign: 'center'
        },
        authLink: {
            color: '#667eea',
            textDecoration: 'none',
            fontWeight: '500'
        }
    };

    return (
        <div style={styles.authPage}>
            <div style={styles.container}>
                <motion.div
                    style={styles.authCard}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h1 style={styles.authTitle}>Welcome Back</h1>
                    <p style={styles.authSubtitle}>Log in to your Welp account</p>

                    {/* General Error Display */}
                    <AnimatePresence mode="wait">
                        {errors.general && (
                            <motion.div
                                style={{...styles.alert, ...styles.alertError}}
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

                    {/* Login Method Suggestion */}
                    {loginMethod === 'email' && errors.general?.toLowerCase().includes('different login method') && (
                        <motion.div
                            style={{...styles.alert, ...styles.alertInfo}}
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
                                <p style={{ marginTop: '4px', fontSize: '0.9rem' }}>
                                    This account was created using social login.
                                    Please try signing in with Google or GitHub below.
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* Login Form */}
                    <LoginForm {...loginFormProps} />

                    {/* Social Login */}
                    <div style={styles.socialLogin}>
                        <div style={styles.divider}>
                            <div style={styles.dividerLine}></div>
                            <span style={styles.dividerText}>Or continue with</span>
                        </div>

                        <div style={styles.socialButtons}>
                            <button
                                onClick={() => handleSocialLogin('google')}
                                style={{...styles.socialBtn, ...styles.googleBtn}}
                                disabled={loading.email || loading.google || isLocked}
                                aria-label="Login with Google"
                                aria-busy={loading.google}
                            >
                                {loading.google ? (
                                    <span>Loading...</span>
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
                                onClick={() => handleSocialLogin('github')}
                                style={{...styles.socialBtn, ...styles.githubBtn}}
                                disabled={loading.email || loading.github || isLocked}
                                aria-label="Login with GitHub"
                                aria-busy={loading.github}
                            >
                                {loading.github ? (
                                    <span>Loading...</span>
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
                                                d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12c0-5.52-4.48-10-10-10z"
                                            />
                                        </svg>
                                        GitHub
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Footer Links */}
                    <div style={styles.authFooter}>
                        <p>
                            Don't have an account?{' '}
                            <Link
                                to="/register"
                                style={styles.authLink}
                                state={{ from }}
                            >
                                Sign up
                            </Link>
                        </p>
                        <p style={{ marginTop: '10px' }}>
                            <Link
                                to="/forgot-password"
                                style={styles.authLink}
                                state={{ email: formData.email }}
                            >
                                Forgot password?
                            </Link>
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default Login;
