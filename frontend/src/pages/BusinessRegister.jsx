import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { registerBusiness } from '../services/registrationService';
import { resolveMediaUrl } from '../utils/media';
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

const BUSINESS_REQUIRED_DOCUMENTS = [
    { type: 'registration_certificate', label: 'Business registration certificate' },
    { type: 'ownership_proof', label: 'Proof of ownership or authorization' }
];

const BUSINESS_DOCUMENT_LABELS = BUSINESS_REQUIRED_DOCUMENTS.reduce((acc, doc) => {
    acc[doc.type] = doc.label;
    return acc;
}, {});

const empty = {
    // Step 1 — account
    displayName: '', email: '', password: '', confirmPassword: '', jobTitle: '', contactPhone: '',
    // Step 2 — company basics
    companyName: '', companyWebsite: '', industry: '', companySize: '', country: '',
    // Step 3 — additional details
    companyDescription: '', linkedinUrl: '', registrationNumber: '', claimExistingProfile: false, claimCompanyId: '',
    howDidYouHear: '', agreeTerms: false,
};

const BusinessRegister = () => {
    const navigate        = useNavigate();
    const [searchParams]  = useSearchParams();
    const socialProvider  = searchParams.get('social');
    const socialToken     = searchParams.get('token');
    const isSocial        = Boolean(socialProvider && socialToken);
    const [step, setStep]  = useState(0);
    const [form, setForm]  = useState(empty);

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
    const [loading, setLoading]   = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [showPw, setShowPw]       = useState(false);
    const [claimSearchTerm, setClaimSearchTerm] = useState('');
    const [claimResults, setClaimResults] = useState([]);
    const [claimLoading, setClaimLoading] = useState(false);
    const [claimError, setClaimError] = useState('');
    const [emailConflict, setEmailConflict] = useState('');
    const [selectedClaimCompany, setSelectedClaimCompany] = useState(null);
    const claimSectionRef = useRef(null);
    const claimSearchInputRef = useRef(null);
    const [documents, setDocuments] = useState({});
    const [docUploading, setDocUploading] = useState({});

    const set = (field) => (e) => {
        const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setForm(f => {
            const updated = { ...f, [field]: val };
            if (field === 'claimExistingProfile' && !val) {
                updated.claimCompanyId = '';
                setClaimResults([]);
                setClaimSearchTerm('');
                setClaimError('');
                setSelectedClaimCompany(null);
            }
            return updated;
        });
        if (field === 'email') {
            setEmailConflict('');
        }
    };

    const handleDocumentUpload = async (type, file) => {
        if (!file) return;
        setDocUploading((prev) => ({ ...prev, [type]: true }));
        try {
            const formData = new FormData();
            formData.append('document', file);
            const { data } = await api.post('/applications/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setDocuments((prev) => ({
                ...prev,
                [type]: {
                    type,
                    label: BUSINESS_DOCUMENT_LABELS[type],
                    url: data.url,
                    filename: file.name,
                    uploadedAt: new Date().toISOString()
                }
            }));
            toast.success(`${BUSINESS_DOCUMENT_LABELS[type]} uploaded`);
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to upload document');
        } finally {
            setDocUploading((prev) => ({ ...prev, [type]: false }));
        }
    };

    const onDocumentInputChange = (type) => async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        await handleDocumentUpload(type, file);
        event.target.value = '';
    };

    const removeDocument = (type) => {
        setDocuments((prev) => {
            const next = { ...prev };
            delete next[type];
            return next;
        });
    };

    const getStepError = (currentStep) => {
        if (currentStep === 0) {
            if (!form.displayName) return 'Full name is required';
            if (!form.email)       return 'Email is required';
            if (!form.jobTitle)    return 'Job title is required';
            if (!form.contactPhone) return 'Work phone number is required';
            if (!isSocial) {
                if (!form.password || form.password.length < 8) return 'Password must be at least 8 characters';
                if (form.password !== form.confirmPassword) return 'Passwords do not match';
            }
        }
        if (currentStep === 1) {
            if (!form.companyName) return 'Company name is required';
            if (!form.industry)    return 'Industry is required';
            if (!form.companySize) return 'Company size is required';
            if (!form.country)     return 'Country is required';
            if (form.claimExistingProfile && !form.claimCompanyId) return 'Select the company you want to claim';
        }
        if (currentStep === 2) {
            if (!form.registrationNumber) return 'Company registration number is required';
            const missingDoc = BUSINESS_REQUIRED_DOCUMENTS.find((doc) => !documents[doc.type]);
            if (missingDoc) return `Please upload ${missingDoc.label}`;
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

    const searchUnclaimedCompanies = async (termOrEvent) => {
        if (termOrEvent?.preventDefault) {
            termOrEvent.preventDefault();
        }
        const resolvedTerm = typeof termOrEvent === 'string' ? termOrEvent : claimSearchTerm;
        const safeTerm = (resolvedTerm ?? '').trim();
        if (!safeTerm) {
            setClaimError('Enter a company name or keyword');
            return;
        }
        if (typeof termOrEvent === 'string') {
            setClaimSearchTerm(safeTerm);
        }
        setClaimError('');
        setSelectedClaimCompany(null);
        setClaimLoading(true);
        try {
            const { data } = await api.get('/companies/search', {
                params: {
                    search: safeTerm,
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
        setSelectedClaimCompany(null);
    };

    const jumpToClaimSection = (opts = {}) => {
        const { autoSearch = true } = opts;
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
        const prefill = form.companyName?.trim() || claimSearchTerm.trim();
        setForm(f => ({ ...f, claimExistingProfile: true }));
        setTimeout(() => {
            claimSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            claimSearchInputRef.current?.focus();
            if (autoSearch && prefill && prefill.length >= 2) {
                searchUnclaimedCompanies(prefill);
            }
        }, 350);
    };

    const handleSubmit = async () => {
        const err = validateStep();
        if (err) return toast.error(err);

        setLoading(true);
        try {
            await registerBusiness({
                email:               form.email,
                password:            isSocial ? undefined : form.password,
                displayName:         form.displayName,
                role:                'business',
                jobTitle:            form.jobTitle,
                contactPhone:        form.contactPhone,
                socialToken:         isSocial ? socialToken : undefined,
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
                documents:           Object.values(documents)
            });

            setSubmitted(true);
            window.scrollTo(0, 0);
        } catch (err) {
            const msg = err?.message || 'Submission failed';
            toast.error(msg);
            if (msg.toLowerCase().includes('already exists')) {
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
                        <button className="reg-submit-btn reg-submit-btn--amber" onClick={() => navigate('/')}>
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
                    <span className="reg-role-badge reg-role-badge--business">
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
                <div className="reg-steps reg-steps--amber">
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
                                        <input
                                            type="email"
                                            value={form.email}
                                            onChange={set('email')}
                                            placeholder="jane@company.com"
                                            readOnly={isSocial}
                                        />
                                    </div>
                                    <div className="reg-field">
                                        <label>Work phone number *</label>
                                        <input type="tel" value={form.contactPhone} onChange={set('contactPhone')} placeholder="+27 11 555 1234" />
                                    </div>
                                    {!isSocial && (
                                        <div className="reg-field">
                                            <label>Password *</label>
                                            <div className="reg-pw-wrap">
                                                <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder="Min 8 characters" />
                                                <button type="button" className="reg-pw-toggle" onClick={() => setShowPw(s => !s)}>
                                                    {showPw ? '🙈' : '👁️'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {!isSocial && (
                                        <div className="reg-field">
                                            <label>Confirm password *</label>
                                            <input type={showPw ? 'text' : 'password'} value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="Repeat password" />
                                        </div>
                                    )}
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
                                                <p className="reg-claim-helper">
                                                    We’ll match your account with an unclaimed company. Search by name or keyword and select the correct result before you submit.
                                                </p>
                                                <div className="reg-row-2 reg-row-compact">
                                                    <div className="reg-field reg-field-inline">
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
                                                        onClick={searchUnclaimedCompanies}
                                                        disabled={claimLoading}
                                                    >
                                                        {claimLoading ? 'Searching…' : 'Search'}
                                                    </button>
                                                </div>
                                                {claimError && <p className="reg-field-hint reg-claim-error">{claimError}</p>}
                                                {claimResults.length > 0 && (
                                                    <div className="reg-claim-results reg-claim-results--spaced">
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
                                                                        companyDescription: company.description || f.companyDescription,
                                                                        claimCompanyId: company.id
                                                                    }));
                                                                    setClaimSearchTerm(company.name);
                                                                    setSelectedClaimCompany(company);
                                                                }}
                                                            >
                                                                <strong>{company.name}</strong>
                                                                <span className="reg-claim-item-subtitle">
                                                                    {company.industry || 'General'} · {company.country || 'Unknown region'}
                                                                </span>
                                                                <div className="reg-claim-item__meta">
                                                                    {company.address && (
                                                                        <span>📍 {company.address}</span>
                                                                    )}
                                                                    {company.phone && (
                                                                        <span>☎ {company.phone}</span>
                                                                    )}
                                                                    {company.email && (
                                                                        <span>✉ {company.email}</span>
                                                                    )}
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                {form.claimCompanyId && (
                                                    <div className="reg-field-hint">
                                                        Selected profile: <strong>{form.companyName}</strong>
                                                        <button
                                                            type="button"
                                                            className="reg-claim-change"
                                                            onClick={clearClaimSelection}
                                                        >
                                                            Change
                                                        </button>
                                                    </div>
                                                )}
                                                {selectedClaimCompany && (
                                                    <div className="reg-claim-selected">
                                                        <p className="reg-claim-selected-note">We'll use the details below to match your ownership:</p>
                                                        <ul>
                                                            {selectedClaimCompany.email && <li>Email: {selectedClaimCompany.email}</li>}
                                                            {selectedClaimCompany.phone && <li>Phone: {selectedClaimCompany.phone}</li>}
                                                            {(selectedClaimCompany.address || selectedClaimCompany.city) && (
                                                                <li>
                                                                    Location: {selectedClaimCompany.address || `${selectedClaimCompany.city || ''} ${selectedClaimCompany.country || ''}`}
                                                                </li>
                                                            )}
                                                        </ul>
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
                                            <label>Company registration number *</label>
                                            <input type="text" value={form.registrationNumber} onChange={set('registrationNumber')} placeholder="e.g. 2019/123456/07" />
                                        </div>
                                    </div>
                                    <div className="reg-field">
                                        <label>Verification documents *</label>
                                        <p className="reg-field-hint">Upload supporting documents to verify your business.</p>
                                        <div className="reg-doc-grid">
                                            {BUSINESS_REQUIRED_DOCUMENTS.map((doc) => {
                                                const current = documents[doc.type];
                                                return (
                                                    <div key={doc.type} className="reg-doc-card">
                                                        <strong className="reg-doc-card-title">{doc.label}</strong>
                                                        {current ? (
                                                            <div className="reg-doc-body">
                                                                <span className="reg-field-hint">{current.filename || 'Uploaded document'}</span>
                                                                <div className="reg-doc-actions">
                                                                    <a
                                                                        href={resolveMediaUrl(current.url)}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="reg-btn-ghost reg-btn-pill"
                                                                    >
                                                                        Preview
                                                                    </a>
                                                                    <button
                                                                        type="button"
                                                                        className="reg-btn-ghost reg-btn-pill"
                                                                        onClick={() => removeDocument(doc.type)}
                                                                    >
                                                                        Replace
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <label
                                                                className="reg-btn-ghost reg-upload-btn"
                                                            >
                                                                <input
                                                                    type="file"
                                                                    accept=".pdf,.png,.jpg,.jpeg"
                                                                    onChange={onDocumentInputChange(doc.type)}
                                                                    disabled={!!docUploading[doc.type]}
                                                                    className="reg-upload-input"
                                                                />
                                                                    {docUploading[doc.type] ? 'Uploading…' : 'Upload file'}
                                                            </label>
                                                        )}
                                                    </div>
                                                );
                                            })}
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
                                    <ReviewRow label="Contact phone" value={form.contactPhone} />
                                    <ReviewRow label="Email"         value={form.email} />
                                    <ReviewRow label="Company"       value={form.companyName} />
                                    <ReviewRow label="Website"       value={form.companyWebsite || '—'} />
                                    <ReviewRow label="Industry"      value={form.industry} />
                                    <ReviewRow label="Company size"  value={`${form.companySize} employees`} />
                                    <ReviewRow label="Country"       value={form.country} />
                                    <ReviewRow label="Claiming profile" value={form.claimExistingProfile ? 'Yes' : 'No'} />
                                    <div className="reg-field reg-field--spaced">
                                        <label>Documents</label>
                                        <ul className="reg-doc-list">
                                            {BUSINESS_REQUIRED_DOCUMENTS.map((doc) => (
                                                <li key={doc.type}>
                                                    {documents[doc.type] ? '✔' : '•'} {doc.label}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
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
                            <button className="reg-submit-btn reg-submit-btn--amber reg-submit-btn--stretch" onClick={next}>
                                Continue →
                            </button>
                        ) : (
                            <button className="reg-submit-btn reg-submit-btn--amber reg-submit-btn--stretch" onClick={handleSubmit} disabled={loading}>
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
    <div className="reg-review-row">
        <span className="reg-review-label">{label}</span>
        <span className="reg-review-value">{value}</span>
    </div>
);

export default BusinessRegister;
