// frontend/src/pages/ClaimBusiness.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
    FaBuilding,
    FaEnvelope,
    FaPhone,
    FaUserTie,
    FaCheckCircle,
    FaExclamationTriangle,
    FaClock,
    FaArrowRight,
    FaArrowLeft,
    FaFileContract,
    FaShieldAlt,
    FaStar
} from 'react-icons/fa';

const ClaimBusiness = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [verificationLoading, setVerificationLoading] = useState(false);
    const [company, setCompany] = useState(null);
    const [verificationCode, setVerificationCode] = useState('');
    const [verificationSent, setVerificationSent] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [formData, setFormData] = useState({
        businessEmail: '',
        businessPhone: '',
        position: '',
        message: '',
        agreeToTerms: false,
        confirmOwnership: false
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        if (id) {
            fetchCompany();
        }
    }, [id]);

    useEffect(() => {
        let timer;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    const fetchCompany = async () => {
        try {
            const { data } = await api.get(`/companies/${id}`);
            setCompany(data);
        } catch (error) {
            toast.error('Failed to load company details');
            navigate('/search');
        }
    };

    const validateStep1 = () => {
        const newErrors = {};
        if (!formData.businessEmail) {
            newErrors.businessEmail = 'Business email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.businessEmail)) {
            newErrors.businessEmail = 'Invalid email format';
        }
        if (!formData.businessPhone) {
            newErrors.businessPhone = 'Business phone is required';
        }
        if (!formData.position) {
            newErrors.position = 'Your position is required';
        }
        if (!formData.agreeToTerms) {
            newErrors.agreeToTerms = 'You must agree to the terms';
        }
        if (!formData.confirmOwnership) {
            newErrors.confirmOwnership = 'You must confirm ownership';
        }
        return newErrors;
    };

    const handleSendVerification = async () => {
        const stepErrors = validateStep1();
        if (Object.keys(stepErrors).length > 0) {
            setErrors(stepErrors);
            toast.error('Please fill in all required fields');
            return;
        }

        setVerificationLoading(true);
        try {
            await api.post('/companies/verify-email', {
                email: formData.businessEmail
            });
            setVerificationSent(true);
            setCountdown(60);
            toast.success('Verification code sent to your email');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to send verification code');
        } finally {
            setVerificationLoading(false);
        }
    };

    const handleVerifyCode = async () => {
        if (!verificationCode || verificationCode.length !== 6) {
            toast.error('Please enter a valid 6-digit code');
            return;
        }

        setVerificationLoading(true);
        try {
            await api.post('/companies/confirm-verification', {
                email: formData.businessEmail,
                code: verificationCode
            });
            toast.success('Email verified successfully');
            setStep(2);
        } catch (error) {
            toast.error(error.response?.data?.error || 'Invalid verification code');
        } finally {
            setVerificationLoading(false);
        }
    };

    const handleSubmitClaim = async () => {
        setLoading(true);
        try {
            await api.post(`/companies/${id}/request-claim`, formData);
            toast.success('Claim request submitted successfully! An admin will review your request.');
            navigate('/dashboard');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to submit claim request');
        } finally {
            setLoading(false);
        }
    };

    if (!company) {
        return (
            <div className="loading-container">
                <div className="spinner-large"></div>
            </div>
        );
    }

    return (
        <div className="claim-business-page">
            {/* Header */}
            <div className="claim-header">
                <div className="container">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="claim-header-content"
                    >
                        <h1>
                            <FaBuilding className="header-icon" />
                            Claim Your Business
                        </h1>
                        <p>Verify your ownership and start managing your company profile</p>
                    </motion.div>
                </div>
            </div>

            <div className="container">
                <div className="claim-content">
                    {/* Company Info Card */}
                    <motion.div
                        className="company-info-card"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className="company-info-header">
                            {company.logo_url ? (
                                <img src={company.logo_url} alt={company.name} className="company-logo" />
                            ) : (
                                <div className="company-logo-placeholder">
                                    {company.name?.charAt(0)}
                                </div>
                            )}
                            <div className="company-details">
                                <h2>{company.name}</h2>
                                <div className="company-meta">
                                    <span className="industry">{company.industry || 'General Business'}</span>
                                    <span className="rating">
                    <FaStar className="star-icon" />
                                        {company.avg_rating || '0.0'} ({company.review_count || 0} reviews)
                  </span>
                                </div>
                                {company.address && (
                                    <p className="address">📍 {company.address}</p>
                                )}
                            </div>
                            <div className="company-status">
                <span className="status-badge unclaimed">
                  <FaExclamationTriangle />
                  Unclaimed
                </span>
                            </div>
                        </div>
                    </motion.div>

                    {/* Progress Steps */}
                    <div className="claim-steps">
                        <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
                            <div className="step-number">{step > 1 ? <FaCheckCircle /> : 1}</div>
                            <div className="step-label">Verify Email</div>
                        </div>
                        <div className="step-connector"></div>
                        <div className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
                            <div className="step-number">{step > 2 ? <FaCheckCircle /> : 2}</div>
                            <div className="step-label">Business Details</div>
                        </div>
                        <div className="step-connector"></div>
                        <div className={`step ${step >= 3 ? 'active' : ''}`}>
                            <div className="step-number">3</div>
                            <div className="step-label">Confirmation</div>
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {/* Step 1: Email Verification */}
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                className="claim-form"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                            >
                                <h2>Verify Your Business Email</h2>
                                <p className="step-description">
                                    We'll send a verification code to your business email to confirm you're authorized to claim this company.
                                </p>

                                <div className="form-group">
                                    <label className="form-label">
                                        <FaEnvelope className="input-icon" />
                                        Business Email
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.businessEmail}
                                        onChange={(e) => setFormData({ ...formData, businessEmail: e.target.value })}
                                        className={`form-input ${errors.businessEmail ? 'error' : ''}`}
                                        placeholder="e.g., yourname@company.com"
                                        disabled={verificationSent}
                                    />
                                    {errors.businessEmail && (
                                        <span className="error-text">{errors.businessEmail}</span>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        <FaPhone className="input-icon" />
                                        Business Phone
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.businessPhone}
                                        onChange={(e) => setFormData({ ...formData, businessPhone: e.target.value })}
                                        className={`form-input ${errors.businessPhone ? 'error' : ''}`}
                                        placeholder="Business phone number"
                                        disabled={verificationSent}
                                    />
                                    {errors.businessPhone && (
                                        <span className="error-text">{errors.businessPhone}</span>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        <FaUserTie className="input-icon" />
                                        Your Position
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.position}
                                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                        className={`form-input ${errors.position ? 'error' : ''}`}
                                        placeholder="e.g., Owner, Manager, CEO"
                                        disabled={verificationSent}
                                    />
                                    {errors.position && (
                                        <span className="error-text">{errors.position}</span>
                                    )}
                                </div>

                                {!verificationSent ? (
                                    <button
                                        onClick={handleSendVerification}
                                        disabled={verificationLoading}
                                        className="btn btn-primary btn-block"
                                    >
                                        {verificationLoading ? 'Sending...' : 'Send Verification Code'}
                                    </button>
                                ) : (
                                    <div className="verification-section">
                                        <p className="verification-message">
                                            <FaEnvelope /> Verification code sent to {formData.businessEmail}
                                        </p>

                                        <div className="form-group">
                                            <label className="form-label">Enter 6-digit Code</label>
                                            <input
                                                type="text"
                                                value={verificationCode}
                                                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                className="form-input code-input"
                                                placeholder="000000"
                                                maxLength="6"
                                            />
                                        </div>

                                        <div className="verification-actions">
                                            <button
                                                onClick={handleVerifyCode}
                                                disabled={verificationLoading || verificationCode.length !== 6}
                                                className="btn btn-primary"
                                            >
                                                {verificationLoading ? 'Verifying...' : 'Verify Code'}
                                            </button>
                                            {countdown > 0 ? (
                                                <span className="resend-timer">
                          <FaClock /> Resend in {countdown}s
                        </span>
                                            ) : (
                                                <button
                                                    onClick={handleSendVerification}
                                                    className="btn btn-secondary"
                                                >
                                                    Resend Code
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="form-group terms-group">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={formData.agreeToTerms}
                                            onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
                                        />
                                        <span>I agree to the <a href="/terms" target="_blank">Terms of Service</a> and <a href="/guidelines" target="_blank">Business Guidelines</a></span>
                                    </label>
                                    {errors.agreeToTerms && (
                                        <span className="error-text">{errors.agreeToTerms}</span>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={formData.confirmOwnership}
                                            onChange={(e) => setFormData({ ...formData, confirmOwnership: e.target.checked })}
                                        />
                                        <span>I confirm that I am authorized to represent this business</span>
                                    </label>
                                    {errors.confirmOwnership && (
                                        <span className="error-text">{errors.confirmOwnership}</span>
                                    )}
                                </div>
                            </motion.div>
                        )}

                        {/* Step 2: Additional Information */}
                        {step === 2 && (
                            <motion.div
                                key="step2"
                                className="claim-form"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                            >
                                <h2>Additional Information</h2>
                                <p className="step-description">
                                    Tell us more about your connection to this business. This helps us verify your claim faster.
                                </p>

                                <div className="form-group">
                                    <label className="form-label">Message to Admin (Optional)</label>
                                    <textarea
                                        value={formData.message}
                                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                        className="form-textarea"
                                        placeholder="Any additional information that might help us verify your claim..."
                                        rows="4"
                                    />
                                    <div className="character-count">
                                        {formData.message.length}/500
                                    </div>
                                </div>

                                <div className="verification-actions">
                                    <button
                                        onClick={() => setStep(1)}
                                        className="btn btn-secondary"
                                    >
                                        <FaArrowLeft /> Back
                                    </button>
                                    <button
                                        onClick={() => setStep(3)}
                                        className="btn btn-primary"
                                    >
                                        Continue <FaArrowRight />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 3: Confirmation */}
                        {step === 3 && (
                            <motion.div
                                key="step3"
                                className="claim-form"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                            >
                                <h2>Review & Submit</h2>
                                <p className="step-description">
                                    Please review your information before submitting your claim request.
                                </p>

                                <div className="review-card">
                                    <h3>Business Information</h3>
                                    <div className="review-item">
                                        <span className="review-label">Business Email:</span>
                                        <span className="review-value">{formData.businessEmail}</span>
                                    </div>
                                    <div className="review-item">
                                        <span className="review-label">Business Phone:</span>
                                        <span className="review-value">{formData.businessPhone}</span>
                                    </div>
                                    <div className="review-item">
                                        <span className="review-label">Your Position:</span>
                                        <span className="review-value">{formData.position}</span>
                                    </div>
                                    {formData.message && (
                                        <div className="review-item">
                                            <span className="review-label">Message:</span>
                                            <span className="review-value">{formData.message}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="benefits-card">
                                    <h3>What happens after claiming?</h3>
                                    <ul>
                                        <li><FaCheckCircle className="benefit-icon" /> Respond to reviews officially</li>
                                        <li><FaCheckCircle className="benefit-icon" /> Update your business information</li>
                                        <li><FaCheckCircle className="benefit-icon" /> Get insights and analytics</li>
                                        <li><FaCheckCircle className="benefit-icon" /> Build your employer brand</li>
                                        <li><FaShieldAlt className="benefit-icon" /> Show customers you care about feedback</li>
                                    </ul>
                                </div>

                                <div className="verification-actions">
                                    <button
                                        onClick={() => setStep(2)}
                                        className="btn btn-secondary"
                                    >
                                        <FaArrowLeft /> Back
                                    </button>
                                    <button
                                        onClick={handleSubmitClaim}
                                        disabled={loading}
                                        className="btn btn-primary"
                                    >
                                        {loading ? 'Submitting...' : 'Submit Claim Request'}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Info Panel */}
                    <motion.div
                        className="claim-info-panel"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className="info-card">
                            <h3><FaShieldAlt /> Why Claim Your Business?</h3>
                            <ul>
                                <li>✓ Respond to reviews and show you care</li>
                                <li>✓ Update your business information</li>
                                <li>✓ Get notified about new reviews</li>
                                <li>✓ Build trust with potential employees</li>
                                <li>✓ Free forever for businesses</li>
                            </ul>
                        </div>

                        <div className="info-card">
                            <h3><FaFileContract /> Verification Process</h3>
                            <ol>
                                <li>Verify your business email</li>
                                <li>Provide business details</li>
                                <li>Admin review (1-2 business days)</li>
                                <li>Start managing your profile</li>
                            </ol>
                        </div>

                        <div className="info-card">
                            <h3><FaExclamationTriangle /> Requirements</h3>
                            <ul>
                                <li>Valid business email address</li>
                                <li>Authorization to represent the company</li>
                                <li>Accurate business information</li>
                                <li>Agreement to terms of service</li>
                            </ul>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default ClaimBusiness;