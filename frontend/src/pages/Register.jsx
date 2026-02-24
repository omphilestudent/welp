// frontend/src/pages/Register.jsx (Updated)
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../services/api';
import {
    FaUser,
    FaEnvelope,
    FaLock,
    FaBuilding,
    FaBriefcase,
    FaUserMd,
    FaArrowRight
} from 'react-icons/fa';

const Register = () => {
    const navigate = useNavigate();
    const { register } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        // Account Info
        email: '',
        password: '',
        confirmPassword: '',
        role: 'employee',
        isAnonymous: false,
        displayName: '',

        // Professional Info
        occupation: '',
        workplaceName: '',
        workplaceExists: false,
        selectedWorkplace: null,

        // For business/psychologist registration
        businessEmail: '',
        businessPhone: '',
        position: '',
        licenseNumber: '',
        licenseIssuingBody: '',
        yearsOfExperience: ''
    });

    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    const handleRoleChange = (role) => {
        setFormData({ ...formData, role });

        // Redirect based on role after registration
        if (role === 'psychologist') {
            toast.success('You will be redirected to the psychologist application form');
        } else if (role === 'business') {
            toast.success('You will be redirected to claim or create your business');
        }
    };

    const searchWorkplace = async (query) => {
        if (!query || query.length < 2) return;

        setSearching(true);
        try {
            const { data } = await api.get('/companies/search', {
                params: { q: query, limit: 5 }
            });
            setSearchResults(data.companies || []);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setSearching(false);
        }
    };

    const handleWorkplaceSelect = (company) => {
        setFormData({
            ...formData,
            workplaceExists: true,
            selectedWorkplace: company,
            workplaceName: company.name
        });
        setSearchResults([]);
    };

    const handleCreateWorkplace = () => {
        setFormData({
            ...formData,
            workplaceExists: false,
            selectedWorkplace: null
        });
    };

    const validateStep1 = () => {
        if (formData.isAnonymous) return true;

        if (!formData.email) {
            toast.error('Email is required');
            return false;
        }
        if (!/\S+@\S+\.\S+/.test(formData.email)) {
            toast.error('Invalid email format');
            return false;
        }
        if (!formData.password || formData.password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return false;
        }
        if (formData.password !== formData.confirmPassword) {
            toast.error('Passwords do not match');
            return false;
        }
        return true;
    };

    const validateStep2 = () => {
        if (!formData.occupation) {
            toast.error('Please enter your occupation');
            return false;
        }
        if (!formData.workplaceName) {
            toast.error('Please enter your workplace');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (step === 1) {
            if (validateStep1()) {
                if (formData.isAnonymous) {
                    // Skip to final registration for anonymous users
                    await completeRegistration();
                } else {
                    setStep(2);
                }
            }
            return;
        }

        if (step === 2) {
            if (validateStep2()) {
                await completeRegistration();
            }
        }
    };

    const completeRegistration = async () => {
        setLoading(true);

        try {
            // First, handle workplace if it's new
            let workplaceId = formData.selectedWorkplace?.id;

            if (!formData.workplaceExists && formData.workplaceName && formData.role === 'employee') {
                // Create new company
                const companyData = {
                    name: formData.workplaceName,
                    description: `Workplace of ${formData.displayName || 'employee'}`,
                    industry: 'Other',
                    is_claimed: false
                };

                const { data } = await api.post('/companies', companyData);
                workplaceId = data.id;
            }

            // Prepare registration data
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
                    displayName: formData.displayName || formData.email.split('@')[0],
                    occupation: formData.occupation,
                    workplaceId
                };

            const result = await register(registrationData);

            if (result.success) {
                toast.success('Account created successfully!');

                // Redirect based on role
                if (formData.role === 'psychologist') {
                    navigate('/psychologist/join');
                } else if (formData.role === 'business') {
                    navigate('/search?unclaimed=true');
                } else {
                    navigate('/dashboard');
                }
            } else {
                toast.error(result.error);
            }
        } catch (error) {
            toast.error('Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="container">
                <motion.div
                    className="auth-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h1 className="auth-title">Create Account</h1>
                    <p className="auth-subtitle">Join Welp today</p>

                    {/* Progress Steps */}
                    {!formData.isAnonymous && (
                        <div className="register-steps">
                            <div className={`step ${step >= 1 ? 'active' : ''}`}>
                                <div className="step-number">1</div>
                                <div className="step-label">Account</div>
                            </div>
                            <div className="step-connector"></div>
                            <div className={`step ${step >= 2 ? 'active' : ''}`}>
                                <div className="step-number">2</div>
                                <div className="step-label">Professional</div>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="auth-form">
                        {/* Step 1: Account Information */}
                        {step === 1 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                {/* Role Selection */}
                                <div className="form-group">
                                    <label className="form-label">I am a...</label>
                                    <div className="role-options">
                                        {['employee', 'psychologist', 'business'].map(role => (
                                            <label key={role} className="role-option">
                                                <input
                                                    type="radio"
                                                    name="role"
                                                    value={role}
                                                    checked={formData.role === role}
                                                    onChange={() => handleRoleChange(role)}
                                                />
                                                <span>
                          {role === 'employee' && <FaUser />}
                                                    {role === 'psychologist' && <FaUserMd />}
                                                    {role === 'business' && <FaBuilding />}
                                                    {role.charAt(0).toUpperCase() + role.slice(1)}
                        </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Anonymous Option */}
                                <div className="form-group">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            name="isAnonymous"
                                            checked={formData.isAnonymous}
                                            onChange={(e) => setFormData({ ...formData, isAnonymous: e.target.checked })}
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
                                        <FaUser /> Display Name
                                    </label>
                                    <input
                                        type="text"
                                        id="displayName"
                                        name="displayName"
                                        value={formData.displayName}
                                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                        className="form-input"
                                        placeholder="How should we call you?"
                                    />
                                </div>

                                {/* Email and Password (not for anonymous) */}
                                {!formData.isAnonymous && (
                                    <>
                                        <div className="form-group">
                                            <label htmlFor="email" className="form-label">
                                                <FaEnvelope /> Email
                                            </label>
                                            <input
                                                type="email"
                                                id="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                className="form-input"
                                                placeholder="Enter your email"
                                                required
                                            />
                                        </div>

                                        <div className="form-row">
                                            <div className="form-group">
                                                <label htmlFor="password" className="form-label">
                                                    <FaLock /> Password
                                                </label>
                                                <input
                                                    type="password"
                                                    id="password"
                                                    name="password"
                                                    value={formData.password}
                                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                    className="form-input"
                                                    placeholder="Create a password"
                                                    required
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="confirmPassword" className="form-label">
                                                    <FaLock /> Confirm
                                                </label>
                                                <input
                                                    type="password"
                                                    id="confirmPassword"
                                                    name="confirmPassword"
                                                    value={formData.confirmPassword}
                                                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                                    className="form-input"
                                                    placeholder="Confirm password"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="form-actions">
                                    <button
                                        type="submit"
                                        className="btn btn-primary btn-block"
                                    >
                                        {formData.isAnonymous ? 'Create Anonymous Account' : 'Continue'}
                                        {!formData.isAnonymous && <FaArrowRight />}
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 2: Professional Information (for employees) */}
                        {step === 2 && formData.role === 'employee' && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                <h3 className="step-title">Tell us about your work</h3>

                                <div className="form-group">
                                    <label htmlFor="occupation" className="form-label">
                                        <FaBriefcase /> Your Occupation *
                                    </label>
                                    <input
                                        type="text"
                                        id="occupation"
                                        value={formData.occupation}
                                        onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                                        className="form-input"
                                        placeholder="e.g., Software Engineer, Manager, Designer"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        <FaBuilding /> Your Workplace *
                                    </label>

                                    {/* Workplace Search */}
                                    <input
                                        type="text"
                                        value={formData.workplaceName}
                                        onChange={(e) => {
                                            setFormData({ ...formData, workplaceName: e.target.value });
                                            searchWorkplace(e.target.value);
                                        }}
                                        className="form-input"
                                        placeholder="Search for your company"
                                    />

                                    {/* Search Results */}
                                    {searching && <div className="searching">Searching...</div>}

                                    {searchResults.length > 0 && (
                                        <div className="search-results">
                                            {searchResults.map(company => (
                                                <div
                                                    key={company.id}
                                                    className="search-result-item"
                                                    onClick={() => handleWorkplaceSelect(company)}
                                                >
                                                    <strong>{company.name}</strong>
                                                    <span>{company.industry}</span>
                                                </div>
                                            ))}
                                            <div
                                                className="search-result-item create-new"
                                                onClick={handleCreateWorkplace}
                                            >
                                                + Add "{formData.workplaceName}" as a new company
                                            </div>
                                        </div>
                                    )}

                                    {formData.selectedWorkplace && (
                                        <div className="selected-workplace">
                                            <FaCheckCircle className="check-icon" />
                                            <span>Selected: {formData.selectedWorkplace.name}</span>
                                        </div>
                                    )}

                                    {!formData.workplaceExists && formData.workplaceName && !formData.selectedWorkplace && (
                                        <p className="help-text">
                                            This company will be added to our database when you register.
                                        </p>
                                    )}
                                </div>

                                <div className="form-actions">
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="btn btn-secondary"
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="btn btn-primary"
                                    >
                                        {loading ? 'Creating Account...' : 'Create Account'}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </form>

                    <div className="auth-footer">
                        <p>
                            Already have an account?{' '}
                            <Link to="/login" className="auth-link">
                                Log in
                            </Link>
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default Register;