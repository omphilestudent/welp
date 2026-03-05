
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
    FaUserMd,
    FaGraduationCap,
    FaStethoscope,
    FaLanguage,
    FaGlobe,
    FaPhone,
    FaEnvelope,
    FaMapMarkerAlt,
    FaLinkedin,
    FaCheckCircle,
    FaClock,
    FaShieldAlt,
    FaHeart,
    FaUsers,
    FaArrowRight,
    FaArrowLeft,
    FaUpload,
    FaPlus,
    FaTrash
} from 'react-icons/fa';

const JoinPsychologist = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [formData, setFormData] = useState({

        fullName: '',
        email: '',
        phoneNumber: '',
        address: '',


        licenseNumber: '',
        licenseIssuingBody: '',
        yearsOfExperience: '',
        specialization: [],
        qualifications: [],
        biography: '',


        consultationModes: [],
        languages: ['English'],
        acceptedAgeGroups: [],


        website: '',
        linkedin: '',


        emergencyContact: {
            name: '',
            relationship: '',
            phone: ''
        },


        licenseDocument: null,
        avatarUrl: '',


        agreeToTerms: false
    });

    const [currentSpecialization, setCurrentSpecialization] = useState('');
    const [currentQualification, setCurrentQualification] = useState('');
    const [errors, setErrors] = useState({});
    const [fileUploadProgress, setFileUploadProgress] = useState(0);

    const specializationOptions = [
        'Clinical Psychology',
        'Counseling Psychology',
        'Industrial-Organizational Psychology',
        'Neuropsychology',
        'Child Psychology',
        'Adolescent Psychology',
        'Family Therapy',
        'Cognitive Behavioral Therapy',
        'Trauma Therapy',
        'Addiction Counseling',
        'Career Counseling',
        'Stress Management',
        'Anxiety Disorders',
        'Depression',
        'PTSD',
        'Relationship Counseling',
        'Grief Counseling',
        'Eating Disorders',
        'Sleep Disorders',
        'Mindfulness-Based Therapy'
    ];

    const consultationModeOptions = [
        'In-person',
        'Video Call',
        'Phone Call',
        'Chat/Text',
        'Email',
        'Group Sessions',
        'Workshops',
        'Corporate Sessions'
    ];

    const languageOptions = [
        'English', 'Spanish', 'French', 'German', 'Italian',
        'Portuguese', 'Russian', 'Chinese', 'Japanese', 'Korean',
        'Arabic', 'Hindi', 'Bengali', 'Urdu', 'Dutch',
        'Swedish', 'Norwegian', 'Danish', 'Finnish', 'Greek'
    ];

    const ageGroupOptions = [
        'Children (3-12)',
        'Adolescents (13-17)',
        'Young Adults (18-25)',
        'Adults (26-40)',
        'Middle-Aged Adults (41-60)',
        'Seniors (60+)',
        'All Ages'
    ];

    const validateStep1 = () => {
        const newErrors = {};
        if (!formData.fullName) newErrors.fullName = 'Full name is required';
        if (!formData.email) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Invalid email format';
        }
        if (!formData.phoneNumber) newErrors.phoneNumber = 'Phone number is required';
        return newErrors;
    };

    const validateStep2 = () => {
        const newErrors = {};
        if (!formData.licenseNumber) newErrors.licenseNumber = 'License number is required';
        if (!formData.licenseIssuingBody) newErrors.licenseIssuingBody = 'License issuing body is required';
        if (!formData.yearsOfExperience) {
            newErrors.yearsOfExperience = 'Years of experience is required';
        } else if (formData.yearsOfExperience < 0 || formData.yearsOfExperience > 70) {
            newErrors.yearsOfExperience = 'Invalid years of experience';
        }
        if (formData.specialization.length === 0) {
            newErrors.specialization = 'At least one specialization is required';
        }
        if (formData.qualifications.length === 0) {
            newErrors.qualifications = 'At least one qualification is required';
        }
        return newErrors;
    };

    const validateStep3 = () => {
        const newErrors = {};
        if (formData.consultationModes.length === 0) {
            newErrors.consultationModes = 'At least one consultation mode is required';
        }
        if (formData.languages.length === 0) {
            newErrors.languages = 'At least one language is required';
        }
        if (formData.acceptedAgeGroups.length === 0) {
            newErrors.acceptedAgeGroups = 'At least one age group is required';
        }
        return newErrors;
    };

    const handleAddSpecialization = () => {
        if (currentSpecialization && !formData.specialization.includes(currentSpecialization)) {
            setFormData({
                ...formData,
                specialization: [...formData.specialization, currentSpecialization]
            });
            setCurrentSpecialization('');
        }
    };

    const handleRemoveSpecialization = (item) => {
        setFormData({
            ...formData,
            specialization: formData.specialization.filter(s => s !== item)
        });
    };

    const handleAddQualification = () => {
        if (currentQualification) {
            setFormData({
                ...formData,
                qualifications: [...formData.qualifications, currentQualification]
            });
            setCurrentQualification('');
        }
    };

    const handleRemoveQualification = (item) => {
        setFormData({
            ...formData,
            qualifications: formData.qualifications.filter(q => q !== item)
        });
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;


        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Please upload a PDF, JPEG, or PNG file');
            return;
        }


        if (file.size > 5 * 1024 * 1024) {
            toast.error('File size must be less than 5MB');
            return;
        }

        setUploading(true);
        setFileUploadProgress(0);


        const interval = setInterval(() => {
            setFileUploadProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    return 100;
                }
                return prev + 10;
            });
        }, 200);

        try {


            const fakeUrl = URL.createObjectURL(file);
            setFormData({
                ...formData,
                licenseDocument: fakeUrl
            });

            setTimeout(() => {
                clearInterval(interval);
                setFileUploadProgress(100);
                setTimeout(() => {
                    toast.success('Document uploaded successfully');
                    setUploading(false);
                }, 500);
            }, 2000);
        } catch (error) {
            clearInterval(interval);
            toast.error('Failed to upload document');
            setUploading(false);
        }
    };

    const handleSubmit = async () => {

        const step1Errors = validateStep1();
        const step2Errors = validateStep2();
        const step3Errors = validateStep3();

        if (Object.keys(step1Errors).length > 0 ||
            Object.keys(step2Errors).length > 0 ||
            Object.keys(step3Errors).length > 0) {
            toast.error('Please complete all required fields');
            return;
        }

        if (!formData.agreeToTerms) {
            toast.error('You must agree to the terms and conditions');
            return;
        }

        setLoading(true);
        try {
            console.log('Submitting application:', formData);

            const response = await api.post('/psychologists/apply', {
                fullName: formData.fullName,
                email: formData.email,
                phoneNumber: formData.phoneNumber,
                address: formData.address,
                licenseNumber: formData.licenseNumber,
                licenseIssuingBody: formData.licenseIssuingBody,
                yearsOfExperience: parseInt(formData.yearsOfExperience),
                specialization: formData.specialization,
                qualifications: formData.qualifications,
                biography: formData.biography,
                consultationModes: formData.consultationModes,
                languages: formData.languages,
                acceptedAgeGroups: formData.acceptedAgeGroups,
                website: formData.website,
                linkedin: formData.linkedin,
                emergencyContact: formData.emergencyContact,
                avatarUrl: formData.avatarUrl
            });

            console.log('Application response:', response.data);
            toast.success('Application submitted successfully!');
            navigate('/application-success');
        } catch (error) {
            console.error('Application error:', error.response || error);
            toast.error(error.response?.data?.error || 'Failed to submit application');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="join-psychologist-page">
            {}
            <div className="psychologist-hero">
                <div className="container">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="hero-content"
                    >
                        <h1>
                            <FaUserMd className="hero-icon" />
                            Join as a Psychologist
                        </h1>
                        <p>Make a difference in workplace mental health and wellbeing</p>
                    </motion.div>
                </div>
            </div>

            <div className="container">
                {}
                <div className="stats-grid">
                    <motion.div
                        className="stat-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <FaUsers className="stat-icon" />
                        <div className="stat-number">10,000+</div>
                        <div className="stat-label">Employees Helped</div>
                    </motion.div>
                    <motion.div
                        className="stat-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <FaHeart className="stat-icon" />
                        <div className="stat-number">500+</div>
                        <div className="stat-label">Active Psychologists</div>
                    </motion.div>
                    <motion.div
                        className="stat-card"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <FaShieldAlt className="stat-icon" />
                        <div className="stat-number">100%</div>
                        <div className="stat-label">Verified Professionals</div>
                    </motion.div>
                </div>

                {}
                <div className="psychologist-steps">
                    <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
                        <div className="step-number">{step > 1 ? <FaCheckCircle /> : 1}</div>
                        <div className="step-label">Personal Info</div>
                    </div>
                    <div className="step-connector"></div>
                    <div className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
                        <div className="step-number">{step > 2 ? <FaCheckCircle /> : 2}</div>
                        <div className="step-label">Professional</div>
                    </div>
                    <div className="step-connector"></div>
                    <div className={`step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
                        <div className="step-number">{step > 3 ? <FaCheckCircle /> : 3}</div>
                        <div className="step-label">Practice</div>
                    </div>
                    <div className="step-connector"></div>
                    <div className={`step ${step >= 4 ? 'active' : ''}`}>
                        <div className="step-number">4</div>
                        <div className="step-label">Documents</div>
                    </div>
                </div>

                <div className="psychologist-content">
                    <AnimatePresence mode="wait">
                        {}
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                className="psychologist-form"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <h2>Personal Information</h2>
                                <p className="step-description">
                                    Tell us about yourself. This information helps us verify your identity.
                                </p>

                                <div className="form-group">
                                    <label className="form-label">
                                        <FaUserMd className="input-icon" />
                                        Full Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        className={`form-input ${errors.fullName ? 'error' : ''}`}
                                        placeholder="Dr. John Doe"
                                    />
                                    {errors.fullName && <span className="error-text">{errors.fullName}</span>}
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">
                                            <FaEnvelope className="input-icon" />
                                            Email *
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className={`form-input ${errors.email ? 'error' : ''}`}
                                            placeholder="john.doe@example.com"
                                        />
                                        {errors.email && <span className="error-text">{errors.email}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">
                                            <FaPhone className="input-icon" />
                                            Phone Number *
                                        </label>
                                        <input
                                            type="tel"
                                            value={formData.phoneNumber}
                                            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                                            className={`form-input ${errors.phoneNumber ? 'error' : ''}`}
                                            placeholder="+1 234 567 8900"
                                        />
                                        {errors.phoneNumber && <span className="error-text">{errors.phoneNumber}</span>}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        <FaMapMarkerAlt className="input-icon" />
                                        Practice Address
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        className="form-input"
                                        placeholder="123 Therapy St, City, State"
                                    />
                                </div>

                                <div className="form-actions">
                                    <button
                                        onClick={() => {
                                            const stepErrors = validateStep1();
                                            if (Object.keys(stepErrors).length === 0) {
                                                setStep(2);
                                            } else {
                                                setErrors(stepErrors);
                                                toast.error('Please fill in all required fields');
                                            }
                                        }}
                                        className="btn btn-primary"
                                    >
                                        Continue <FaArrowRight />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {}
                        {step === 2 && (
                            <motion.div
                                key="step2"
                                className="psychologist-form"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <h2>Professional Information</h2>
                                <p className="step-description">
                                    Provide your professional credentials and qualifications.
                                </p>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">
                                            License Number *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.licenseNumber}
                                            onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                                            className={`form-input ${errors.licenseNumber ? 'error' : ''}`}
                                            placeholder="LIC-12345"
                                        />
                                        {errors.licenseNumber && <span className="error-text">{errors.licenseNumber}</span>}
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">
                                            Issuing Body *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.licenseIssuingBody}
                                            onChange={(e) => setFormData({ ...formData, licenseIssuingBody: e.target.value })}
                                            className={`form-input ${errors.licenseIssuingBody ? 'error' : ''}`}
                                            placeholder="State Board of Psychology"
                                        />
                                        {errors.licenseIssuingBody && <span className="error-text">{errors.licenseIssuingBody}</span>}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        Years of Experience *
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.yearsOfExperience}
                                        onChange={(e) => setFormData({ ...formData, yearsOfExperience: e.target.value })}
                                        className={`form-input ${errors.yearsOfExperience ? 'error' : ''}`}
                                        placeholder="10"
                                        min="0"
                                        max="70"
                                    />
                                    {errors.yearsOfExperience && <span className="error-text">{errors.yearsOfExperience}</span>}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        Specializations *
                                    </label>
                                    <div className="tags-input">
                                        <input
                                            type="text"
                                            value={currentSpecialization}
                                            onChange={(e) => setCurrentSpecialization(e.target.value)}
                                            placeholder="Type and press Enter to add"
                                            list="specializations"
                                        />
                                        <datalist id="specializations">
                                            {specializationOptions.map(opt => (
                                                <option key={opt} value={opt} />
                                            ))}
                                        </datalist>
                                        <button
                                            type="button"
                                            onClick={handleAddSpecialization}
                                            className="btn btn-secondary btn-small"
                                        >
                                            <FaPlus /> Add
                                        </button>
                                    </div>
                                    <div className="tags-list">
                                        {formData.specialization.map((item, index) => (
                                            <span key={index} className="tag">
                                                {item}
                                                <button onClick={() => handleRemoveSpecialization(item)}>
                                                    <FaTrash />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    {errors.specialization && <span className="error-text">{errors.specialization}</span>}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        Qualifications *
                                    </label>
                                    <div className="tags-input">
                                        <input
                                            type="text"
                                            value={currentQualification}
                                            onChange={(e) => setCurrentQualification(e.target.value)}
                                            placeholder="e.g., PhD in Clinical Psychology, Master's in Counseling"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddQualification}
                                            className="btn btn-secondary btn-small"
                                        >
                                            <FaPlus /> Add
                                        </button>
                                    </div>
                                    <div className="tags-list">
                                        {formData.qualifications.map((item, index) => (
                                            <span key={index} className="tag">
                                                {item}
                                                <button onClick={() => handleRemoveQualification(item)}>
                                                    <FaTrash />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    {errors.qualifications && <span className="error-text">{errors.qualifications}</span>}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        Professional Biography
                                    </label>
                                    <textarea
                                        value={formData.biography}
                                        onChange={(e) => setFormData({ ...formData, biography: e.target.value })}
                                        className="form-textarea"
                                        placeholder="Tell us about your experience, approach, and what inspired you to become a psychologist..."
                                        rows="5"
                                    />
                                    <div className="character-count">
                                        {formData.biography.length}/2000
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button
                                        onClick={() => setStep(1)}
                                        className="btn btn-secondary"
                                    >
                                        <FaArrowLeft /> Back
                                    </button>
                                    <button
                                        onClick={() => {
                                            const stepErrors = validateStep2();
                                            if (Object.keys(stepErrors).length === 0) {
                                                setStep(3);
                                            } else {
                                                setErrors(stepErrors);
                                                toast.error('Please fill in all required fields');
                                            }
                                        }}
                                        className="btn btn-primary"
                                    >
                                        Continue <FaArrowRight />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {}
                        {step === 3 && (
                            <motion.div
                                key="step3"
                                className="psychologist-form"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <h2>Practice Information</h2>
                                <p className="step-description">
                                    Tell us how you work and who you work with.
                                </p>

                                <div className="form-group">
                                    <label className="form-label">
                                        Consultation Modes *
                                    </label>
                                    <div className="checkbox-grid">
                                        {consultationModeOptions.map(mode => (
                                            <label key={mode} className="checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.consultationModes.includes(mode)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setFormData({
                                                                ...formData,
                                                                consultationModes: [...formData.consultationModes, mode]
                                                            });
                                                        } else {
                                                            setFormData({
                                                                ...formData,
                                                                consultationModes: formData.consultationModes.filter(m => m !== mode)
                                                            });
                                                        }
                                                    }}
                                                />
                                                <span>{mode}</span>
                                            </label>
                                        ))}
                                    </div>
                                    {errors.consultationModes && <span className="error-text">{errors.consultationModes}</span>}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        Languages Spoken *
                                    </label>
                                    <div className="checkbox-grid">
                                        {languageOptions.map(language => (
                                            <label key={language} className="checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.languages.includes(language)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setFormData({
                                                                ...formData,
                                                                languages: [...formData.languages, language]
                                                            });
                                                        } else {
                                                            setFormData({
                                                                ...formData,
                                                                languages: formData.languages.filter(l => l !== language)
                                                            });
                                                        }
                                                    }}
                                                />
                                                <span>{language}</span>
                                            </label>
                                        ))}
                                    </div>
                                    {errors.languages && <span className="error-text">{errors.languages}</span>}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        Age Groups Accepted *
                                    </label>
                                    <div className="checkbox-grid">
                                        {ageGroupOptions.map(ageGroup => (
                                            <label key={ageGroup} className="checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.acceptedAgeGroups.includes(ageGroup)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setFormData({
                                                                ...formData,
                                                                acceptedAgeGroups: [...formData.acceptedAgeGroups, ageGroup]
                                                            });
                                                        } else {
                                                            setFormData({
                                                                ...formData,
                                                                acceptedAgeGroups: formData.acceptedAgeGroups.filter(a => a !== ageGroup)
                                                            });
                                                        }
                                                    }}
                                                />
                                                <span>{ageGroup}</span>
                                            </label>
                                        ))}
                                    </div>
                                    {errors.acceptedAgeGroups && <span className="error-text">{errors.acceptedAgeGroups}</span>}
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">
                                            <FaGlobe className="input-icon" />
                                            Website (Optional)
                                        </label>
                                        <input
                                            type="url"
                                            value={formData.website}
                                            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                            className="form-input"
                                            placeholder="https://yourpractice.com"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">
                                            <FaLinkedin className="input-icon" />
                                            LinkedIn Profile (Optional)
                                        </label>
                                        <input
                                            type="url"
                                            value={formData.linkedin}
                                            onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                                            className="form-input"
                                            placeholder="https://linkedin.com/in/username"
                                        />
                                    </div>
                                </div>

                                <h3 className="section-subtitle">Emergency Contact</h3>
                                <p className="section-description">
                                    Who should we contact in case of emergency?
                                </p>

                                <div className="form-group">
                                    <label className="form-label">Contact Name</label>
                                    <input
                                        type="text"
                                        value={formData.emergencyContact.name}
                                        onChange={(e) => setFormData({
                                            ...formData,
                                            emergencyContact: { ...formData.emergencyContact, name: e.target.value }
                                        })}
                                        className="form-input"
                                        placeholder="Jane Doe"
                                    />
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Relationship</label>
                                        <input
                                            type="text"
                                            value={formData.emergencyContact.relationship}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                emergencyContact: { ...formData.emergencyContact, relationship: e.target.value }
                                            })}
                                            className="form-input"
                                            placeholder="Spouse, Partner, Parent"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Emergency Phone</label>
                                        <input
                                            type="tel"
                                            value={formData.emergencyContact.phone}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                emergencyContact: { ...formData.emergencyContact, phone: e.target.value }
                                            })}
                                            className="form-input"
                                            placeholder="+1 234 567 8900"
                                        />
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button
                                        onClick={() => setStep(2)}
                                        className="btn btn-secondary"
                                    >
                                        <FaArrowLeft /> Back
                                    </button>
                                    <button
                                        onClick={() => {
                                            const stepErrors = validateStep3();
                                            if (Object.keys(stepErrors).length === 0) {
                                                setStep(4);
                                            } else {
                                                setErrors(stepErrors);
                                                toast.error('Please fill in all required fields');
                                            }
                                        }}
                                        className="btn btn-primary"
                                    >
                                        Continue <FaArrowRight />
                                    </button>
                                </div>
                            </motion.div>
                        )}

                        {}
                        {step === 4 && (
                            <motion.div
                                key="step4"
                                className="psychologist-form"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <h2>Documents & Review</h2>
                                <p className="step-description">
                                    Upload your license and review your application before submitting.
                                </p>

                                <div className="upload-section">
                                    <h3>License Document</h3>
                                    <p className="upload-description">
                                        Please upload a clear copy of your professional license (PDF, JPEG, or PNG, max 5MB)
                                    </p>

                                    <div className="upload-area">
                                        <input
                                            type="file"
                                            id="license-upload"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={handleFileUpload}
                                            style={{ display: 'none' }}
                                        />
                                        <label htmlFor="license-upload" className="upload-label">
                                            {formData.licenseDocument ? (
                                                <div className="upload-success">
                                                    <FaCheckCircle className="success-icon" />
                                                    <span>Document uploaded successfully</span>
                                                </div>
                                            ) : (
                                                <div className="upload-prompt">
                                                    <FaUpload className="upload-icon" />
                                                    <span>Click to upload or drag and drop</span>
                                                    <span className="upload-hint">PDF, JPEG, PNG (Max 5MB)</span>
                                                </div>
                                            )}
                                        </label>
                                    </div>

                                    {uploading && (
                                        <div className="upload-progress">
                                            <div className="progress-bar">
                                                <div className="progress-fill" style={{ width: `${fileUploadProgress}%` }}></div>
                                            </div>
                                            <span className="progress-text">{fileUploadProgress}% uploaded</span>
                                        </div>
                                    )}
                                </div>

                                <div className="review-summary">
                                    <h3>Review Your Application</h3>

                                    <div className="review-section">
                                        <h4>Personal Information</h4>
                                        <div className="review-item">
                                            <span className="review-label">Full Name:</span>
                                            <span className="review-value">{formData.fullName}</span>
                                        </div>
                                        <div className="review-item">
                                            <span className="review-label">Email:</span>
                                            <span className="review-value">{formData.email}</span>
                                        </div>
                                        <div className="review-item">
                                            <span className="review-label">Phone:</span>
                                            <span className="review-value">{formData.phoneNumber}</span>
                                        </div>
                                        {formData.address && (
                                            <div className="review-item">
                                                <span className="review-label">Address:</span>
                                                <span className="review-value">{formData.address}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="review-section">
                                        <h4>Professional Information</h4>
                                        <div className="review-item">
                                            <span className="review-label">License Number:</span>
                                            <span className="review-value">{formData.licenseNumber}</span>
                                        </div>
                                        <div className="review-item">
                                            <span className="review-label">Issuing Body:</span>
                                            <span className="review-value">{formData.licenseIssuingBody}</span>
                                        </div>
                                        <div className="review-item">
                                            <span className="review-label">Experience:</span>
                                            <span className="review-value">{formData.yearsOfExperience} years</span>
                                        </div>
                                        <div className="review-item">
                                            <span className="review-label">Specializations:</span>
                                            <span className="review-value">{formData.specialization.join(', ')}</span>
                                        </div>
                                        <div className="review-item">
                                            <span className="review-label">Qualifications:</span>
                                            <span className="review-value">{formData.qualifications.join(', ')}</span>
                                        </div>
                                    </div>

                                    <div className="review-section">
                                        <h4>Practice Information</h4>
                                        <div className="review-item">
                                            <span className="review-label">Consultation Modes:</span>
                                            <span className="review-value">{formData.consultationModes.join(', ')}</span>
                                        </div>
                                        <div className="review-item">
                                            <span className="review-label">Languages:</span>
                                            <span className="review-value">{formData.languages.join(', ')}</span>
                                        </div>
                                        <div className="review-item">
                                            <span className="review-label">Age Groups:</span>
                                            <span className="review-value">{formData.acceptedAgeGroups.join(', ')}</span>
                                        </div>
                                    </div>

                                    {formData.emergencyContact.name && (
                                        <div className="review-section">
                                            <h4>Emergency Contact</h4>
                                            <div className="review-item">
                                                <span className="review-label">Name:</span>
                                                <span className="review-value">{formData.emergencyContact.name}</span>
                                            </div>
                                            <div className="review-item">
                                                <span className="review-label">Relationship:</span>
                                                <span className="review-value">{formData.emergencyContact.relationship}</span>
                                            </div>
                                            <div className="review-item">
                                                <span className="review-label">Phone:</span>
                                                <span className="review-value">{formData.emergencyContact.phone}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="terms-agreement">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={formData.agreeToTerms}
                                            onChange={(e) => setFormData({ ...formData, agreeToTerms: e.target.checked })}
                                        />
                                        <span>
                                            I confirm that all information provided is accurate and complete. I understand that
                                            false information may result in immediate rejection or termination of my application.
                                            I agree to the <a href="/terms" target="_blank">Terms of Service</a> and
                                            <a href="/psychologist-guidelines" target="_blank"> Psychologist Guidelines</a>.
                                        </span>
                                    </label>
                                </div>

                                <div className="verification-notice">
                                    <FaShieldAlt className="notice-icon" />
                                    <div className="notice-content">
                                        <h4>Verification Process</h4>
                                        <p>
                                            Your application will be reviewed within 3-5 business days. We may contact you for
                                            additional information or to schedule a verification call. Once verified, you'll receive
                                            an email with your account details and can start offering support immediately.
                                        </p>
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button
                                        onClick={() => setStep(3)}
                                        className="btn btn-secondary"
                                    >
                                        <FaArrowLeft /> Back
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={loading || !formData.agreeToTerms || !formData.licenseDocument}
                                        className="btn btn-primary"
                                    >
                                        {loading ? 'Submitting...' : 'Submit Application'}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    
                    <div className="psychologist-sidebar">
                        <div className="info-card">
                            <h3><FaShieldAlt /> Why Join Welp?</h3>
                            <ul>
                                <li>- Help employees in need</li>
                                <li>- Flexible schedule</li>
                                <li>- Competitive compensation</li>
                                <li>- Professional community</li>
                                <li>- Continuing education credits</li>
                                <li>- Malpractice insurance coverage</li>
                            </ul>
                        </div>

                        <div className="info-card">
                            <h3><FaCheckCircle /> Requirements</h3>
                            <ul>
                                <li>Valid psychology license</li>
                                <li>Minimum 3 years experience</li>
                                <li>Clean disciplinary record</li>
                                <li>Professional liability insurance</li>
                                <li>Valid ID and credentials</li>
                            </ul>
                        </div>

                        <div className="info-card">
                            <h3><FaClock /> Timeline</h3>
                            <ol>
                                <li>Application: 15-20 minutes</li>
                                <li>Review: 3-5 business days</li>
                                <li>Verification call: 30 minutes</li>
                                <li>Account activation: 24 hours</li>
                            </ol>
                        </div>

                        <div className="info-card testimonial">
                            <FaHeart className="testimonial-icon" />
                            <p className="testimonial-text">
                                "Joining Welp has been incredibly rewarding. I've been able to help dozens of employees
                                improve their mental health and work-life balance."
                            </p>
                            <p className="testimonial-author">- Dr. Sarah Johnson, Clinical Psychologist</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JoinPsychologist;