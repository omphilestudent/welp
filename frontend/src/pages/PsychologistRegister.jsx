import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../services/api';
import 'Register.css';

const STEPS = ['Account', 'Credentials', 'Practice', 'Review'];

const SPECIALISATIONS = [
    'Anxiety & Stress', 'Depression', 'Workplace Burnout', 'Trauma & PTSD',
    'Relationships', 'Grief & Loss', 'Substance Use', 'ADHD', 'OCD',
    'Eating Disorders', 'Career & Life Transitions', 'Child & Adolescent',
];

const THERAPY_TYPES = [
    'Cognitive Behavioural Therapy (CBT)', 'Psychodynamic', 'EMDR',
    'Mindfulness-Based', 'Acceptance & Commitment (ACT)', 'Solution-Focused',
    'Dialectical Behaviour (DBT)', 'Humanistic / Person-Centred',
];

const empty = {
    // Step 1 — account
    displayName: '', email: '', password: '', confirmPassword: '',
    // Step 2 — credentials
    licenseNumber: '', licenseBody: '', yearsExperience: '',
    qualifications: '', licenseExpiry: '',
    // Step 3 — practice
    specialisations: [], therapyTypes: [],
    languages: 'English', sessionFormats: [],
    practiceLocation: '', bio: '', website: '',
    agreeTerms: false,
};

const PsychologistRegister = () => {
    const navigate       = useNavigate();
    const [step, setStep] = useState(0);
    const [form, setForm] = useState(empty);
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [showPw, setShowPw]       = useState(false);

    const set = (field) => (e) => {
        const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setForm(f => ({ ...f, [field]: val }));
    };

    const toggleArr = (field, val) => {
        setForm(f => ({
            ...f,
            [field]: f[field].includes(val)
                ? f[field].filter(x => x !== val)
                : [...f[field], val],
        }));
    };

    // ── Validation per step ───────────────────────────────────────────────
    const validateStep = () => {
        if (step === 0) {
            if (!form.displayName) return 'Full name is required';
            if (!form.email)       return 'Email is required';
            if (!form.password || form.password.length < 8) return 'Password must be at least 8 characters';
            if (form.password !== form.confirmPassword) return 'Passwords do not match';
        }
        if (step === 1) {
            if (!form.licenseNumber) return 'License / registration number is required';
            if (!form.licenseBody)   return 'Licensing body is required';
            if (!form.yearsExperience) return 'Years of experience is required';
        }
        if (step === 2) {
            if (form.specialisations.length === 0) return 'Select at least one specialisation';
            if (!form.bio)            return 'A brief bio is required';
            if (!form.agreeTerms)     return 'Please accept the terms';
        }
        return null;
    };

    const next = () => {
        const err = validateStep();
        if (err) return toast.error(err);
        setStep(s => s + 1);
    };

    const back = () => setStep(s => s - 1);

    const handleSubmit = async () => {
        const err = validateStep();
        if (err) return toast.error(err);

        setLoading(true);
        try {
            await api.post('/auth/register/psychologist', {
                email:           form.email,
                password:        form.password,
                displayName:     form.displayName,
                role:            'psychologist',
                // Application fields
                licenseNumber:   form.licenseNumber,
                licenseBody:     form.licenseBody,
                licenseExpiry:   form.licenseExpiry,
                yearsExperience: parseInt(form.yearsExperience),
                qualifications:  form.qualifications,
                specialisations: form.specialisations,
                therapyTypes:    form.therapyTypes,
                languages:       form.languages,
                sessionFormats:  form.sessionFormats,
                practiceLocation: form.practiceLocation,
                bio:             form.bio,
                website:         form.website,
            });

            setSubmitted(true);
            window.scrollTo(0, 0);
        } catch (err) {
            const msg = err?.response?.data?.error || err?.response?.data?.message || 'Submission failed';
            toast.error(msg);
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
                        <span className="reg-success-icon">🎉</span>
                        <h2>Application submitted!</h2>
                        <p>
                            Thank you for applying as a psychologist on Welp. Our team will review your
                            credentials and get back to you within <strong>2–3 business days</strong>.
                            You'll receive a confirmation at <strong>{form.email}</strong>.
                        </p>
                        <button className="reg-submit-btn" onClick={() => navigate('/')}>
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
                    <span className="reg-role-badge" style={{ background: '#ecfeff', color: '#0891b2' }}>
                        🧠 Psychologist application
                    </span>
                    <h1>Join our network</h1>
                    <p>Licensed professionals only · Review within 2–3 days</p>
                </div>

                {/* Step indicator */}
                <div className="reg-steps">
                    {STEPS.map((label, i) => (
                        <React.Fragment key={i}>
                            <div className={`reg-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
                                <div className="reg-step-dot">
                                    {i < step ? '✓' : i + 1}
                                </div>
                                <span className="reg-step-label">{label}</span>
                            </div>
                            {i < STEPS.length - 1 && (
                                <div className={`reg-step-line ${i < step ? 'done' : ''}`} />
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
                                    <div className="reg-info-box reg-info-box--blue">
                                        We'll create your account now. It won't be publicly visible until your application is approved.
                                    </div>
                                    <div className="reg-field">
                                        <label>Full legal name *</label>
                                        <input type="text" value={form.displayName} onChange={set('displayName')} placeholder="Dr. Jane Smith" required />
                                    </div>
                                    <div className="reg-field">
                                        <label>Email address *</label>
                                        <input type="email" value={form.email} onChange={set('email')} placeholder="you@clinic.com" required />
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

                            {/* ── Step 1: Credentials ── */}
                            {step === 1 && (
                                <div className="reg-form">
                                    <div className="reg-info-box reg-info-box--amber">
                                        Your credentials will be manually verified by our team before your profile is activated.
                                    </div>
                                    <div className="reg-field">
                                        <label>Professional registration / license number *</label>
                                        <input type="text" value={form.licenseNumber} onChange={set('licenseNumber')} placeholder="e.g. PSY12345" />
                                    </div>
                                    <div className="reg-row-2">
                                        <div className="reg-field">
                                            <label>Licensing / regulatory body *</label>
                                            <input type="text" value={form.licenseBody} onChange={set('licenseBody')} placeholder="e.g. HPCSA, BPS" />
                                        </div>
                                        <div className="reg-field">
                                            <label>License expiry date</label>
                                            <input type="date" value={form.licenseExpiry} onChange={set('licenseExpiry')} />
                                        </div>
                                    </div>
                                    <div className="reg-field">
                                        <label>Years of clinical experience *</label>
                                        <select value={form.yearsExperience} onChange={set('yearsExperience')}>
                                            <option value="">Select…</option>
                                            {['1–2','3–5','6–10','11–15','15+'].map(v => (
                                                <option key={v} value={v}>{v} years</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="reg-field">
                                        <label>Highest qualification & institution</label>
                                        <input type="text" value={form.qualifications} onChange={set('qualifications')} placeholder="e.g. PhD Clinical Psychology, UCT" />
                                    </div>
                                </div>
                            )}

                            {/* ── Step 2: Practice ── */}
                            {step === 2 && (
                                <div className="reg-form">
                                    <div className="reg-field">
                                        <label>Areas of specialisation * (select all that apply)</label>
                                        <div className="reg-tag-grid">
                                            {SPECIALISATIONS.map(s => (
                                                <button
                                                    key={s} type="button"
                                                    className={`reg-tag ${form.specialisations.includes(s) ? 'selected' : ''}`}
                                                    onClick={() => toggleArr('specialisations', s)}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="reg-field">
                                        <label>Therapy modalities (optional)</label>
                                        <div className="reg-tag-grid">
                                            {THERAPY_TYPES.map(t => (
                                                <button
                                                    key={t} type="button"
                                                    className={`reg-tag ${form.therapyTypes.includes(t) ? 'selected' : ''}`}
                                                    onClick={() => toggleArr('therapyTypes', t)}
                                                >
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="reg-row-2">
                                        <div className="reg-field">
                                            <label>Session formats</label>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.2rem' }}>
                                                {['In-person','Video','Phone'].map(f => (
                                                    <label key={f} className="reg-checkbox" style={{ fontSize: '0.875rem' }}>
                                                        <input type="checkbox" checked={form.sessionFormats.includes(f)} onChange={() => toggleArr('sessionFormats', f)} />
                                                        <span>{f}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="reg-field">
                                            <label>Languages spoken</label>
                                            <input type="text" value={form.languages} onChange={set('languages')} placeholder="English, Zulu…" />
                                        </div>
                                    </div>

                                    <div className="reg-field">
                                        <label>Practice location / city</label>
                                        <input type="text" value={form.practiceLocation} onChange={set('practiceLocation')} placeholder="e.g. Johannesburg, Sandton" />
                                    </div>

                                    <div className="reg-field">
                                        <label>Professional bio * (shown on your public profile)</label>
                                        <textarea value={form.bio} onChange={set('bio')} placeholder="Describe your approach, experience, and what clients can expect…" rows={4} />
                                    </div>

                                    <div className="reg-field">
                                        <label>Website / LinkedIn (optional)</label>
                                        <input type="url" value={form.website} onChange={set('website')} placeholder="https://" />
                                    </div>

                                    <label className="reg-checkbox reg-checkbox--required">
                                        <input type="checkbox" checked={form.agreeTerms} onChange={set('agreeTerms')} />
                                        <span>
                                            I confirm I am a licensed mental health professional and agree to the{' '}
                                            <Link to="/terms" target="_blank">Terms of Service</Link>,{' '}
                                            <Link to="/privacy" target="_blank">Privacy Policy</Link>, and{' '}
                                            <Link to="/psychologist-code" target="_blank">Psychologist Code of Conduct</Link>.
                                        </span>
                                    </label>
                                </div>
                            )}

                            {/* ── Step 3: Review ── */}
                            {step === 3 && (
                                <div className="reg-form">
                                    <div className="reg-info-box">
                                        Please review your application before submitting. Our team will verify your details within 2–3 business days.
                                    </div>

                                    <ReviewRow label="Name"          value={form.displayName} />
                                    <ReviewRow label="Email"         value={form.email} />
                                    <ReviewRow label="License"       value={`${form.licenseNumber} (${form.licenseBody})`} />
                                    <ReviewRow label="Experience"    value={`${form.yearsExperience} years`} />
                                    <ReviewRow label="Qualifications" value={form.qualifications || '—'} />
                                    <ReviewRow label="Specialisations" value={form.specialisations.join(', ') || '—'} />
                                    <ReviewRow label="Modalities"    value={form.therapyTypes.join(', ') || '—'} />
                                    <ReviewRow label="Session formats" value={form.sessionFormats.join(', ') || '—'} />
                                    <ReviewRow label="Languages"     value={form.languages} />
                                    <ReviewRow label="Location"      value={form.practiceLocation || '—'} />
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
                            <button className="reg-submit-btn" style={{ flex: 1 }} onClick={next}>
                                Continue →
                            </button>
                        ) : (
                            <button className="reg-submit-btn" style={{ flex: 1 }} onClick={handleSubmit} disabled={loading}>
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

export default PsychologistRegister;