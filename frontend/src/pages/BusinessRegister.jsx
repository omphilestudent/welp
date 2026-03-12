import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../services/api';
import './Register.css';

const STEPS = ['Account', 'Company', 'Details', 'Review'];

const INDUSTRIES = [
    'Technology', 'Finance & Banking', 'Healthcare', 'Retail & E-commerce',
    'Manufacturing', 'Education', 'Media & Entertainment', 'Consulting',
    'Legal', 'Real Estate', 'Hospitality', 'Logistics & Transport',
    'Non-profit', 'Government', 'Agriculture', 'Energy', 'Other',
];

const COMPANY_SIZES = [
    '1–10', '11–50', '51–200', '201–500', '501–1000', '1000+',
];

const empty = {
    // Step 1 — account
    displayName: '', email: '', password: '', confirmPassword: '', jobTitle: '',
    // Step 2 — company basics
    companyName: '', companyWebsite: '', industry: '', companySize: '', country: '',
    // Step 3 — additional details
    companyDescription: '', linkedinUrl: '', registrationNumber: '', claimExistingProfile: false, claimCompanyId: '',
    howDidYouHear: '', agreeTerms: false,
};

const BusinessRegister = () => {
    const navigate        = useNavigate();
    const [step, setStep]  = useState(0);
    const [form, setForm]  = useState(empty);
    const [loading, setLoading]   = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [showPw, setShowPw]       = useState(false);
    const [claimSearchTerm, setClaimSearchTerm] = useState('');
    const [claimResults, setClaimResults] = useState([]);
    const [claimLoading, setClaimLoading] = useState(false);
    const [claimError, setClaimError] = useState('');
    const [emailConflict, setEmailConflict] = useState('');
    const claimSectionRef = useRef(null);
    const claimSearchInputRef = useRef(null);

    const set = (field) => (e) => {
        const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setForm(f => {
            const updated = { ...f, [field]: val };
            if (field === 'claimExistingProfile' && !val) {
                updated.claimCompanyId = '';
                setClaimResults([]);
                setClaimSearchTerm('');
                setClaimError('');
            }
            return updated;
        });
        if (field === 'email') {
            setEmailConflict('');
        }
    };

    const getStepError = (currentStep) => {
        if (currentStep === 0) {
            if (!form.displayName) return 'Full name is required';
            if (!form.email)       return 'Email is required';
            if (!form.jobTitle)    return 'Job title is required';
            if (!form.password || form.password.length < 8) return 'Password must be at least 8 characters';
            if (form.password !== form.confirmPassword) return 'Passwords do not match';
        }
        if (currentStep === 1) {
            if (!form.companyName) return 'Company name is required';
            if (!form.industry)    return 'Industry is required';
            if (!form.companySize) return 'Company size is required';
            if (!form.country)     return 'Country is required';
            if (form.claimExistingProfile && !form.claimCompanyId) return 'Select the company you want to claim';
        }
        if (currentStep === 2) {
            if (!form.agreeTerms) return 'Please accept the terms';
        }
        return null;
    };

    const validateStep = () => getStepError(step);

    const next = () => {
        const err = validateStep();
        if (err) return toast.error(err);
        setStep(s => s + 1);
    };

    const back = () => setStep(s => s - 1);

    const searchUnclaimedCompanies = async () => {
        if (!claimSearchTerm.trim()) {
            setClaimError('Enter a company name or keyword');
            return;
        }
        setClaimError('');
        setClaimLoading(true);
        try {
            const { data } = await api.get('/companies/search', {
                params: {
                    q: claimSearchTerm.trim(),
                    unclaimed: true,
                    limit: 8
                }
            });
            setClaimResults(data.companies || []);
        } catch (err) {
            setClaimError(err?.response?.data?.error || 'Search failed');
            setClaimResults([]);
        } finally {
            setClaimLoading(false);
        }
    };

    const clearClaimSelection = () => {
        setForm(f => ({ ...f, claimCompanyId: '' }));
        setClaimResults([]);
        setClaimSearchTerm('');
        setClaimError('');
    };

    const jumpToClaimSection = () => {
        if (step === 0) {
            const err = getStepError(0);
            if (err) {
                toast.error(err);
                return;
            }
            setStep(1);
        } else if (step > 1) {
            setStep(1);
        }
        setForm(f => ({ ...f, claimExistingProfile: true }));
        setTimeout(() => {
            claimSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            claimSearchInputRef.current?.focus();
        }, 350);
    };

    const handleSubmit = async () => {
        const err = validateStep();
        if (err) return toast.error(err);

        setLoading(true);
        try {
            await api.post('/auth/register/business', {
                email:               form.email,
                password:            form.password,
                displayName:         form.displayName,
                role:                'business',
                jobTitle:            form.jobTitle,
                companyName:         form.companyName,
                companyWebsite:      form.companyWebsite,
                industry:            form.industry,
                companySize:         form.companySize,
                country:             form.country,
                companyDescription:  form.companyDescription,
                linkedinUrl:         form.linkedinUrl,
                registrationNumber:  form.registrationNumber,
                claimExistingProfile: form.claimExistingProfile,
                claimCompanyId: form.claimExistingProfile ? form.claimCompanyId || undefined : undefined,
                howDidYouHear:       form.howDidYouHear,
            });

            setSubmitted(true);
            window.scrollTo(0, 0);
        } catch (err) {
            const status = err?.response?.status;
            const msg = err?.response?.data?.error || err?.response?.data?.message || 'Submission failed';
            toast.error(msg);
            if (status === 409) {
                setEmailConflict('This work email is already linked to a Welp account. Please sign in or claim your existing profile to continue.');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="reg-page">
                <div className="reg-bg-mesh" />
                <motion.div
                    className="reg-container reg-container--narrow"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    <div className="reg-success">
                        <span className="reg-success-icon">🏢</span>
                        <h2>Application received!</h2>
                        <p>
                            Thanks for applying to list <strong>{form.companyName}</strong> on Welp.
                            Our team will review your information and reach out to <strong>{form.email}</strong>{' '}
                            within <strong>1–2 business days</strong>.
                        </p>
                        <button className="reg-submit-btn" style={{ background: '#d97706' }} onClick={() => navigate('/')}>
                            Back to homepage
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="reg-page">
            <div className="reg-bg-mesh" />
            <motion.div
                className="reg-container reg-container--narrow"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
            >
                <Link to="/register" className="reg-back-btn">← Back to role selection</Link>

                <div className="reg-header">
                    <span className="reg-role-badge" style={{ background: '#fffbeb', color: '#d97706' }}>
                        🏢 Business application
                    </span>
                    <h1>Register your company</h1>
                    <p>Gain insights · Respond to reviews · Build trust</p>
                </div>

                {emailConflict && (
                    <div className="reg-inline-alert" role="alert">
                        <div className="reg-inline-alert__text">
                            <strong>Account already exists</strong>
                            <p>{emailConflict}</p>
                        </div>
                        <div className="reg-inline-alert__actions">
                            <Link to="/login">Sign in</Link>
                            <button type="button" onClick={jumpToClaimSection}>
                                Claim with this email
                            </button>
                        </div>
                    </div>
                )}

                <div className="reg-claim-callout">
                    <div>
                        <p className="reg-callout-eyebrow">Already listed on Welp?</p>
                        <strong>Claim your existing business profile.</strong>
                        <p className="reg-callout-copy">We'll help you search for an unclaimed company page before you apply.</p>
                    </div>
                    <button type="button" className="reg-claim-callout__btn" onClick={jumpToClaimSection}>
                        Find my company
                    </button>
                </div>

                {/* Step indicator */}
                <div className="reg-steps">
                    {STEPS.map((label, i) => (
                        <React.Fragment key={i}>
                            <div className={`reg-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
                                 style={{ '--active-color': '#d97706' }}>
                                <div className="reg-step-dot" style={i === step ? { background: '#d97706', borderColor: '#d97706', boxShadow: '0 0 0 4px rgba(217,119,6,0.15)' } : {}}>
                                    {i < step ? '✓' : i + 1}
                                </div>
                                <span className="reg-step-label" style={i === step ? { color: '#d97706' } : {}}>{label}</span>
                            </div>
                            {i < STEPS.length - 1 && (
                                <div className={`reg-step-line ${i < step ? 'done' : ''}`}
                                     style={i < step ? { background: '#22c55e' } : {}} />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                <div className="reg-form-wrap">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.25 }}
                        >
                            {/* ── Step 0: Account ── */}
                            {step === 0 && (
                                <div className="reg-form">
                                    <div className="reg-info-box reg-info-box--amber">
                                        This is your personal account for managing your company's Welp presence.
                                    </div>
                                    <div className="reg-row-2">
                                        <div className="reg-field">
                                            <label>Full name *</label>
                                            <input type="text" value={form.displayName} onChange={set('displayName')} placeholder="Jane Smith" autoFocus />
                                        </div>
                                        <div className="reg-field">
                                            <label>Job title *</label>
                                            <input type="text" value={form.jobTitle} onChange={set('jobTitle')} placeholder="HR Manager" />
                                        </div>
                                    </div>
                                    <div className="reg-field">
                                        <label>Work email address *</label>
                                        <input type="email" value={form.email} onChange={set('email')} placeholder="jane@company.com" />
                                    </div>
                                    <div className="reg-field">
                                        <label>Password *</label>
                                        <div className="reg-pw-wrap">
                                            <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="Min 8 characters" />
                                            <button type="button" className="reg-pw-toggle" onClick={() => setShowPw(s => !s)}>
                                                {showPw ? '🙈' : '👁️'}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="reg-field">
                                        <label>Confirm password *</label>
                                        <input type={showPw ? 'text' : 'password'} value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="Repeat password" />
                                    </div>
                                </div>
                            )}

                            {/* ── Step 1: Company basics ── */}
                            {step === 1 && (
                                <div className="reg-form">
                                    <div className="reg-field">
                                        <label>Company name *</label>
                                        <input type="text" value={form.companyName} onChange={set('companyName')} placeholder="Acme Corp" />
                                    </div>
                                    <div className="reg-field">
                                        <label>Company website</label>
                                        <input type="url" value={form.companyWebsite} onChange={set('companyWebsite')} placeholder="https://acme.com" />
                                    </div>
                                    <div className="reg-row-2">
                                        <div className="reg-field">
                                            <label>Industry *</label>
                                            <select value={form.industry} onChange={set('industry')}>
                                                <option value="">Select…</option>
                                                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                                            </select>
                                        </div>
                                        <div className="reg-field">
                                            <label>Company size *</label>
                                            <select value={form.companySize} onChange={set('companySize')}>
                                                <option value="">Select…</option>
                                                {COMPANY_SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="reg-field">
                                        <label>Country / Region *</label>
                                        <input type="text" value={form.country} onChange={set('country')} placeholder="South Africa" />
                                    </div>
                                    <div ref={claimSectionRef}>
                                        <label className="reg-checkbox">
                                            <input type="checkbox" checked={form.claimExistingProfile} onChange={set('claimExistingProfile')} />
                                            <span>
                                                <strong>Claim an existing Welp profile</strong> — our team will match your application to an existing company page
                                            </span>
                                        </label>
                                        {form.claimExistingProfile && (
                                            <div className="reg-claim-section">
                                                <p style={{ marginBottom: '0.75rem', color: '#475569' }}>
                                                    We’ll match your account with an unclaimed company. Search by name or keyword and select the correct result before you submit.
                                                </p>
                                                <div className="reg-row-2" style={{ gap: '0.5rem', alignItems: 'flex-end' }}>
                                                    <div className="reg-field" style={{ flex: 1, marginBottom: 0 }}>
                                                        <label>Company search</label>
                                                        <input
                                                            type="text"
                                                            value={claimSearchTerm}
                                                            onChange={(e) => setClaimSearchTerm(e.target.value)}
                                                            placeholder="Search for Acme Corp"
                                                            ref={claimSearchInputRef}
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="reg-btn-ghost"
                                                        style={{ flexShrink: 0 }}
                                                        onClick={searchUnclaimedCompanies}
                                                        disabled={claimLoading}
                                                    >
                                                        {claimLoading ? 'Searching…' : 'Search'}
                                                    </button>
                                                </div>
                                                {claimError && <p className="reg-field-hint" style={{ color: '#ef4444' }}>{claimError}</p>}
                                                {claimResults.length > 0 && (
                                                    <div className="reg-claim-results" style={{ marginTop: '0.5rem' }}>
                                                        {claimResults.map(company => (
                                                            <button
                                                                type="button"
                                                                key={company.id}
                                                                className={`reg-claim-item ${form.claimCompanyId === company.id ? 'selected' : ''}`}
                                                                onClick={() => {
                                                                    setForm(f => ({
                                                                        ...f,
                                                                        companyName: company.name,
                                                                        companyWebsite: company.website || f.companyWebsite,
                                                                        country: company.country || f.country,
                                                                        claimCompanyId: company.id
                                                                    }));
                                                                    setClaimResults([]);
                                                                    setClaimSearchTerm(company.name);
                                                                }}
                                                            >
                                                                <strong>{company.name}</strong>
                                                                <span style={{ fontSize: '0.75rem', color: '#475569' }}>{company.industry || 'General'} · {company.country || 'Unknown region'}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                {form.claimCompanyId && (
                                                    <div className="reg-field-hint" style={{ marginTop: '0.75rem' }}>
                                                        Selected profile: <strong>{form.companyName}</strong>
                                                        <button
                                                            type="button"
                                                            className="reg-claim-clear"
                                                            onClick={clearClaimSelection}
                                                            style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#d97706', cursor: 'pointer' }}
                                                        >
                                                            Change
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ── Step 2: Details ── */}
                            {step === 2 && (
                                <div className="reg-form">
                                    <div className="reg-field">
                                        <label>Short company description</label>
                                        <textarea
                                            value={form.companyDescription}
                                            onChange={set('companyDescription')}
                                            placeholder="What does your company do? What's your mission?"
                                            rows={3}
                                        />
                                    </div>
                                    <div className="reg-row-2">
                                        <div className="reg-field">
                                            <label>LinkedIn company page</label>
                                            <input type="url" value={form.linkedinUrl} onChange={set('linkedinUrl')} placeholder="https://linkedin.com/company/…" />
                                        </div>
                                        <div className="reg-field">
                                            <label>Company registration number</label>
                                            <input type="text" value={form.registrationNumber} onChange={set('registrationNumber')} placeholder="Optional" />
                                        </div>
                                    </div>
                                    <div className="reg-field">
                                        <label>How did you hear about Welp?</label>
                                        <select value={form.howDidYouHear} onChange={set('howDidYouHear')}>
                                            <option value="">Select…</option>
                                            <option value="google">Google / Search</option>
                                            <option value="linkedin">LinkedIn</option>
                                            <option value="referral">Referral from colleague</option>
                                            <option value="press">Press / Media</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>

                                    <label className="reg-checkbox reg-checkbox--required">
                                        <input type="checkbox" checked={form.agreeTerms} onChange={set('agreeTerms')} />
                                        <span>
                                            I am authorised to represent <strong>{form.companyName || 'this company'}</strong> and agree to the{' '}
                                            <Link to="/terms" target="_blank">Terms of Service</Link>,{' '}
                                            <Link to="/privacy" target="_blank">Privacy Policy</Link>, and{' '}
                                            <Link to="/business-guidelines" target="_blank">Business Guidelines</Link>.
                                        </span>
                                    </label>
                                </div>
                            )}

                            {/* ── Step 3: Review ── */}
                            {step === 3 && (
                                <div className="reg-form">
                                    <div className="reg-info-box">
                                        Review your details before submitting. Our team will be in touch within 1–2 business days.
                                    </div>
                                    <ReviewRow label="Contact name"  value={form.displayName} />
                                    <ReviewRow label="Job title"     value={form.jobTitle} />
                                    <ReviewRow label="Email"         value={form.email} />
                                    <ReviewRow label="Company"       value={form.companyName} />
                                    <ReviewRow label="Website"       value={form.companyWebsite || '—'} />
                                    <ReviewRow label="Industry"      value={form.industry} />
                                    <ReviewRow label="Company size"  value={`${form.companySize} employees`} />
                                    <ReviewRow label="Country"       value={form.country} />
                                    <ReviewRow label="Claiming profile" value={form.claimExistingProfile ? 'Yes' : 'No'} />
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Navigation */}
                    <div className="reg-nav-btns">
                        {step > 0 && (
                            <button className="reg-btn-ghost" onClick={back} disabled={loading}>
                                ← Back
                            </button>
                        )}
                        {step < STEPS.length - 1 ? (
                            <button className="reg-submit-btn" style={{ flex: 1, background: '#d97706' }} onClick={next}>
                                Continue →
                            </button>
                        ) : (
                            <button className="reg-submit-btn" style={{ flex: 1, background: '#d97706' }} onClick={handleSubmit} disabled={loading}>
                                {loading ? <span className="reg-spinner" /> : 'Submit Application'}
                            </button>
                        )}
                    </div>
                </div>

                <p className="reg-signin-link">
                    Already have an account? <Link to="/login">Sign in</Link>
                </p>
            </motion.div>
        </div>
    );
};

const ReviewRow = ({ label, value }) => (
    <div style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem' }}>
        <span style={{ width: 130, color: '#9ca3af', fontWeight: 600, flexShrink: 0 }}>{label}</span>
        <span style={{ color: '#111827' }}>{value}</span>
    </div>
);

export default BusinessRegister;
