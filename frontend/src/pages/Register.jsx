import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { registerEmployee } from '../services/registrationService';
import './Register.css';

const ROLES = [
    {
        key: 'employee',
        label: 'Employee',
        icon: '👤',
        tagline: 'Review your workplace anonymously',
        description: 'Share honest reviews, track wellbeing, and connect with support resources.',
        color: '#4f46e5',
        accent: '#818cf8',
        bg: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
    },
    {
        key: 'psychologist',
        label: 'Psychologist',
        icon: '🧠',
        tagline: 'Support employees through certified care',
        description: 'Join our network of licensed professionals and provide mental health support.',
        color: '#0891b2',
        accent: '#22d3ee',
        bg: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)',
    },
    {
        key: 'business',
        label: 'Business',
        icon: '🏢',
        tagline: 'Unlock insights about your organisation',
        description: 'Claim your company profile, respond to reviews, and access workforce analytics.',
        color: '#d97706',
        accent: '#fbbf24',
        bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    },
];

const Register = () => {
    const [step, setStep]               = useState('choose'); // 'choose' | 'employee-form'
    const [selectedRole, setSelectedRole] = useState(null);
    const [searchParams] = useSearchParams();
    const socialProvider = searchParams.get('social');
    const socialToken = searchParams.get('token');
    const isSocial = Boolean(socialProvider && socialToken);
    const navigate                      = useNavigate();

    const handleRoleSelect = (role) => {
        if (role.key === 'employee') {
            setSelectedRole(role);
            setStep('employee-form');
        } else if (role.key === 'psychologist') {
            navigate(isSocial ? `/register/psychologist?social=${encodeURIComponent(socialProvider)}&token=${encodeURIComponent(socialToken)}` : '/register/psychologist');
        } else if (role.key === 'business') {
            navigate(isSocial ? `/register/business?social=${encodeURIComponent(socialProvider)}&token=${encodeURIComponent(socialToken)}` : '/register/business');
        }
    };

    return (
        <div className="reg-page">
            <div className="reg-bg-mesh" />

            <AnimatePresence mode="wait">
                {step === 'choose' && (
                    <motion.div
                        key="choose"
                        className="reg-container"
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -24 }}
                        transition={{ duration: 0.4 }}
                    >
                        <div className="reg-header">
                            <Link to="/" className="reg-logo">Welp</Link>
                            <h1>Join Welp</h1>
                            <p>{isSocial ? `Continue with ${socialProvider}` : "Choose how you'll use the platform"}</p>
                        </div>

                        <div className="reg-role-grid">
                            {ROLES.map((role, i) => (
                                <motion.button
                                    key={role.key}
                                    className={`reg-role-card reg-role-card--${role.key}`}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.08, duration: 0.35 }}
                                    whileHover={{ y: -6, transition: { duration: 0.2 } }}
                                    onClick={() => handleRoleSelect(role)}
                                >
                                    <span className="reg-role-icon">{role.icon}</span>
                                    <h3>{role.label}</h3>
                                    <p className="reg-role-tagline">{role.tagline}</p>
                                    <p className="reg-role-desc">{role.description}</p>
                                    <span className="reg-role-cta">
                                        {role.key === 'employee' ? 'Sign up free' : 'Apply now'} →
                                    </span>
                                </motion.button>
                            ))}
                        </div>

                        <p className="reg-signin-link">
                            Already have an account? <Link to="/login">Sign in</Link>
                        </p>
                    </motion.div>
                )}

                {step === 'employee-form' && (
                    <motion.div
                        key="employee-form"
                        className="reg-container reg-container--narrow"
                        initial={{ opacity: 0, x: 40 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -40 }}
                        transition={{ duration: 0.35 }}
                    >
                        <button className="reg-back-btn" onClick={() => setStep('choose')}>
                            ← Back
                        </button>
                        <EmployeeRegistrationForm
                            socialProvider={socialProvider}
                            socialToken={socialToken}
                            isSocial={isSocial}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ─── Employee registration (inline, stays on this page) ──────────────────────
const EmployeeRegistrationForm = ({ isSocial, socialToken, socialProvider }) => {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        displayName: '', email: '', password: '', confirmPassword: '',
        isAnonymous: false, agreeTerms: false,
    });
    const [loading, setLoading] = useState(false);
    const [showPw, setShowPw]   = useState(false);

    useEffect(() => {
        if (!isSocial || !socialToken) return;
        try {
            const tokenPayload = socialToken.split('.')[1];
            const normalized = tokenPayload.replace(/-/g, '+').replace(/_/g, '/');
            const decoded = JSON.parse(atob(normalized));
            setForm((prev) => ({
                ...prev,
                email: decoded?.email || prev.email,
                displayName: decoded?.name || prev.displayName
            }));
        } catch (error) {
            // ignore decode errors
        }
    }, [isSocial, socialToken]);

    const set = (field) => (e) =>
        setForm(f => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();        if (!form.agreeTerms) return toast.error('Please accept the terms of service');
        if (!isSocial) {
            if (form.password !== form.confirmPassword) return toast.error('Passwords do not match');
            if (form.password.length < 8) return toast.error('Password must be at least 8 characters');
        }

        setLoading(true);
        try {
            const data = await registerEmployee({
                email:       form.email,
                password:    isSocial ? undefined : form.password,
                displayName: form.displayName,
                role:        'employee',
                isAnonymous: form.isAnonymous,
                socialToken: isSocial ? socialToken : undefined
            });

            if (data.token) {
                localStorage.setItem('token', data.token);
            }

            toast.success('Welcome to Welp! 🎉');
            const inviteReturn = localStorage.getItem('welp_invite_return');
            if (inviteReturn) {
                localStorage.removeItem('welp_invite_return');
                navigate(inviteReturn);
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            const msg = err?.message || 'Registration failed';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const strength = (() => {
        if (isSocial) return 0;
        const p = form.password;
        if (!p) return 0;
        let s = 0;
        if (p.length >= 8)           s++;
        if (/[A-Z]/.test(p))         s++;
        if (/[0-9]/.test(p))         s++;
        if (/[^A-Za-z0-9]/.test(p))  s++;
        return s;
    })();

    return (
        <div className="reg-form-wrap">
            <div className="reg-header">
                <span className="reg-role-badge">👤 Employee</span>
                <h1>{isSocial ? `Continue with ${socialProvider}` : 'Create your account'}</h1>
                <p>Free forever · Anonymous option available</p>
            </div>

            <form className="reg-form" onSubmit={handleSubmit}>
                <div className="reg-field">
                    <label>Display name</label>
                    <input
                        type="text"
                        placeholder="How should we call you?"
                        value={form.displayName}
                        onChange={set('displayName')}
                        required
                        autoFocus
                    />
                </div>

                <div className="reg-field">
                    <label>Email address</label>
                    <input
                        type="email"
                        placeholder="you@example.com"
                        value={form.email}
                        onChange={set('email')}
                        required
                        readOnly={isSocial}
                    />
                </div>

                {!isSocial && (
                    <div className="reg-field">
                        <label>Password</label>
                        <div className="reg-pw-wrap">
                            <input
                                type={showPw ? 'text' : 'password'}
                                placeholder="Min 8 characters"
                                value={form.password}
                                onChange={set('password')}
                                required
                            />
                            <button type="button" className="reg-pw-toggle" onClick={() => setShowPw(s => !s)}>
                                {showPw ? '🙈' : '👁️'}
                            </button>
                        </div>
                        {form.password && (
                            <div className="reg-pw-strength">
                                {[1,2,3,4].map(i => (
                                    <span key={i} className={`reg-pw-bar ${strength >= i ? `strength-${strength}` : ''}`} />
                                ))}
                                <span className="reg-pw-label">
                                    {['', 'Weak', 'Fair', 'Good', 'Strong'][strength]}
                                </span>
                            </div>
                        )}
                    </div>
                )

                {!isSocial && (
                    <div className="reg-field">
                        <label>Confirm password</label>
                        <input
                            type={showPw ? 'text' : 'password'}
                            placeholder="Repeat password"
                            value={form.confirmPassword}
                            onChange={set('confirmPassword')}
                            required
                        />
                    </div>
                )}
                )})}

                <label className="reg-checkbox">
                    <input type="checkbox" checked={form.isAnonymous} onChange={set('isAnonymous')} />
                    <span>
                        <strong>Post anonymously</strong> — your name won't appear on reviews
                    </span>
                </label>

                <label className="reg-checkbox reg-checkbox--required">
                    <input type="checkbox" checked={form.agreeTerms} onChange={set('agreeTerms')} required />
                    <span>
                        I agree to the <Link to="/terms" target="_blank">Terms of Service</Link> and{' '}
                        <Link to="/privacy" target="_blank">Privacy Policy</Link>
                    </span>
                </label>

                <button className="reg-submit-btn" type="submit" disabled={loading}>
                    {loading ? <span className="reg-spinner" /> : 'Create account'}
                </button>
            </form>

            <p className="reg-signin-link">
                Already have an account? <Link to="/login">Sign in</Link>
            </p>
        </div>
    );
};

export default Register;
