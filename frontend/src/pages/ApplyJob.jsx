
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    FaUser,
    FaEnvelope,
    FaPhone,
    FaFileAlt,
    FaLink,
    FaGithub,
    FaLinkedin,
    FaGlobe,
    FaUpload,
    FaCheckCircle,
    FaArrowLeft,
    FaPaperPlane
} from 'react-icons/fa';
import api from '../services/api';
import Loading from '../components/common/Loading';
import toast from 'react-hot-toast';

const ApplyJob = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({

        firstName: '',
        lastName: '',
        email: '',
        phone: '',


        experience: '',
        currentCompany: '',
        currentPosition: '',
        skills: [],
        linkedin: '',
        github: '',
        portfolio: '',


        coverLetter: '',
        resume: null,
        additionalDocs: [],


        startDate: '',
        salaryExpectation: '',
        workAuthorization: '',
        remotePreference: 'hybrid',


        agreeToTerms: false,
        confirmAccuracy: false
    });

    const [currentSkill, setCurrentSkill] = useState('');
    const [uploadProgress, setUploadProgress] = useState({});

    useEffect(() => {
        fetchJobDetails();
    }, [id]);

    const fetchJobDetails = async () => {
        setLoading(true);
        try {

            const mockJob = {
                id: 1,
                title: 'Senior Frontend Developer',
                department: 'Engineering',
                location: 'Remote',
                type: 'Full-time'
            };
            setJob(mockJob);
        } catch (error) {
            console.error('Failed to fetch job details:', error);
            toast.error('Failed to load job details');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleAddSkill = () => {
        if (currentSkill && !formData.skills.includes(currentSkill)) {
            setFormData(prev => ({
                ...prev,
                skills: [...prev.skills, currentSkill]
            }));
            setCurrentSkill('');
        }
    };

    const handleRemoveSkill = (skill) => {
        setFormData(prev => ({
            ...prev,
            skills: prev.skills.filter(s => s !== skill)
        }));
    };

    const handleFileUpload = async (e, field) => {
        const file = e.target.files[0];
        if (!file) return;


        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Please upload a PDF or Word document');
            return;
        }


        if (file.size > 5 * 1024 * 1024) {
            toast.error('File size must be less than 5MB');
            return;
        }

        setUploadProgress(prev => ({ ...prev, [field]: 0 }));


        const interval = setInterval(() => {
            setUploadProgress(prev => ({
                ...prev,
                [field]: Math.min((prev[field] || 0) + 10, 90)
            }));
        }, 200);

        try {

            const fakeUrl = URL.createObjectURL(file);
            setFormData(prev => ({
                ...prev,
                [field]: fakeUrl
            }));

            clearInterval(interval);
            setUploadProgress(prev => ({ ...prev, [field]: 100 }));

            setTimeout(() => {
                setUploadProgress(prev => ({ ...prev, [field]: null }));
                toast.success(`${field} uploaded successfully`);
            }, 500);
        } catch (error) {
            clearInterval(interval);
            toast.error(`Failed to upload ${field}`);
        }
    };

    const validateStep1 = () => {
        if (!formData.firstName || !formData.lastName) {
            toast.error('Please enter your full name');
            return false;
        }
        if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            toast.error('Please enter a valid email address');
            return false;
        }
        if (!formData.phone) {
            toast.error('Please enter your phone number');
            return false;
        }
        return true;
    };

    const validateStep2 = () => {
        if (!formData.experience) {
            toast.error('Please enter your years of experience');
            return false;
        }
        if (formData.skills.length === 0) {
            toast.error('Please add at least one skill');
            return false;
        }
        return true;
    };

    const validateStep3 = () => {
        if (!formData.resume) {
            toast.error('Please upload your resume');
            return false;
        }
        if (!formData.coverLetter) {
            toast.error('Please write a cover letter');
            return false;
        }
        return true;
    };

    const validateStep4 = () => {
        if (!formData.agreeToTerms) {
            toast.error('Please agree to the terms and conditions');
            return false;
        }
        if (!formData.confirmAccuracy) {
            toast.error('Please confirm that the information is accurate');
            return false;
        }
        return true;
    };

    const handleNext = () => {
        if (step === 1 && validateStep1()) setStep(2);
        else if (step === 2 && validateStep2()) setStep(3);
        else if (step === 3 && validateStep3()) setStep(4);
    };

    const handleBack = () => {
        setStep(prev => prev - 1);
    };

    const handleSubmit = async () => {
        if (!validateStep4()) return;

        setSubmitting(true);
        try {

            await new Promise(resolve => setTimeout(resolve, 2000));
            toast.success('Application submitted successfully!');
            navigate('/application-success');
        } catch (error) {
            toast.error('Failed to submit application');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <Loading />;

    return (
        <div className="apply-page">
            <div className="container">
                {}
                <div className="apply-header">
                    <button onClick={() => navigate(-1)} className="back-btn">
                        <FaArrowLeft /> Back to Job
                    </button>
                    <h1>Apply for {job?.title}</h1>
                    <p className="job-subtitle">{job?.department} • {job?.location} • {job?.type}</p>
                </div>

                {}
                <div className="progress-steps">
                    <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
                        <div className="step-number">{step > 1 ? <FaCheckCircle /> : 1}</div>
                        <div className="step-label">Personal</div>
                    </div>
                    <div className="step-connector"></div>
                    <div className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
                        <div className="step-number">{step > 2 ? <FaCheckCircle /> : 2}</div>
                        <div className="step-label">Professional</div>
                    </div>
                    <div className="step-connector"></div>
                    <div className={`step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
                        <div className="step-number">{step > 3 ? <FaCheckCircle /> : 3}</div>
                        <div className="step-label">Documents</div>
                    </div>
                    <div className="step-connector"></div>
                    <div className={`step ${step >= 4 ? 'active' : ''}`}>
                        <div className="step-number">4</div>
                        <div className="step-label">Review</div>
                    </div>
                </div>

                <div className="apply-content">
                    {}
                    <motion.div
                        className="apply-form"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        {}
                        {step === 1 && (
                            <div className="form-step">
                                <h2>Personal Information</h2>
                                <p className="step-description">Tell us a bit about yourself</p>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>
                                            <FaUser /> First Name *
                                        </label>
                                        <input
                                            type="text"
                                            name="firstName"
                                            value={formData.firstName}
                                            onChange={handleInputChange}
                                            placeholder="Enter your first name"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            <FaUser /> Last Name *
                                        </label>
                                        <input
                                            type="text"
                                            name="lastName"
                                            value={formData.lastName}
                                            onChange={handleInputChange}
                                            placeholder="Enter your last name"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>
                                            <FaEnvelope /> Email *
                                        </label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            placeholder="you@example.com"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            <FaPhone /> Phone *
                                        </label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleInputChange}
                                            placeholder="+1 234 567 8900"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {}
                        {step === 2 && (
                            <div className="form-step">
                                <h2>Professional Information</h2>
                                <p className="step-description">Tell us about your experience and skills</p>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Years of Experience *</label>
                                        <select
                                            name="experience"
                                            value={formData.experience}
                                            onChange={handleInputChange}
                                        >
                                            <option value="">Select experience</option>
                                            <option value="0-1">Less than 1 year</option>
                                            <option value="1-3">1-3 years</option>
                                            <option value="3-5">3-5 years</option>
                                            <option value="5-7">5-7 years</option>
                                            <option value="7-10">7-10 years</option>
                                            <option value="10+">10+ years</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Current Company</label>
                                        <input
                                            type="text"
                                            name="currentCompany"
                                            value={formData.currentCompany}
                                            onChange={handleInputChange}
                                            placeholder="Where do you currently work?"
                                        />
                                    </div>
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Current Position</label>
                                        <input
                                            type="text"
                                            name="currentPosition"
                                            value={formData.currentPosition}
                                            onChange={handleInputChange}
                                            placeholder="e.g., Senior Developer"
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Skills *</label>
                                    <div className="skills-input">
                                        <input
                                            type="text"
                                            value={currentSkill}
                                            onChange={(e) => setCurrentSkill(e.target.value)}
                                            placeholder="Type a skill and press Add"
                                            onKeyPress={(e) => e.key === 'Enter' && handleAddSkill()}
                                        />
                                        <button type="button" onClick={handleAddSkill} className="btn btn-secondary">
                                            Add
                                        </button>
                                    </div>
                                    <div className="skills-list">
                                        {formData.skills.map(skill => (
                                            <span key={skill} className="skill-tag">
                                                {skill}
                                                <button onClick={() => handleRemoveSkill(skill)}>×</button>
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <h3>Online Presence</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>
                                            <FaLinkedin /> LinkedIn
                                        </label>
                                        <input
                                            type="url"
                                            name="linkedin"
                                            value={formData.linkedin}
                                            onChange={handleInputChange}
                                            placeholder="https://linkedin.com/in/username"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>
                                            <FaGithub /> GitHub
                                        </label>
                                        <input
                                            type="url"
                                            name="github"
                                            value={formData.github}
                                            onChange={handleInputChange}
                                            placeholder="https://github.com/username"
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>
                                        <FaGlobe /> Portfolio
                                    </label>
                                    <input
                                        type="url"
                                        name="portfolio"
                                        value={formData.portfolio}
                                        onChange={handleInputChange}
                                        placeholder="https://yourportfolio.com"
                                    />
                                </div>
                            </div>
                        )}

                        {}
                        {step === 3 && (
                            <div className="form-step">
                                <h2>Documents</h2>
                                <p className="step-description">Upload your resume and cover letter</p>

                                <div className="form-group">
                                    <label>
                                        <FaFileAlt /> Resume/CV *
                                    </label>
                                    <div className="upload-area">
                                        <input
                                            type="file"
                                            id="resume"
                                            accept=".pdf,.doc,.docx"
                                            onChange={(e) => handleFileUpload(e, 'resume')}
                                            style={{ display: 'none' }}
                                        />
                                        <label htmlFor="resume" className="upload-label">
                                            {formData.resume ? (
                                                <div className="upload-success">
                                                    <FaCheckCircle />
                                                    <span>Resume uploaded</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <FaUpload className="upload-icon" />
                                                    <span>Click to upload your resume</span>
                                                    <span className="upload-hint">PDF, DOC (Max 5MB)</span>
                                                </>
                                            )}
                                        </label>
                                    </div>
                                    {uploadProgress.resume && (
                                        <div className="upload-progress">
                                            <div className="progress-bar">
                                                <div className="progress-fill" style={{ width: `${uploadProgress.resume}%` }}></div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="form-group">
                                    <label>Cover Letter *</label>
                                    <textarea
                                        name="coverLetter"
                                        value={formData.coverLetter}
                                        onChange={handleInputChange}
                                        placeholder="Tell us why you're interested in this position and why you'd be a great fit..."
                                        rows="6"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Additional Documents (Optional)</label>
                                    <div className="upload-area">
                                        <input
                                            type="file"
                                            id="additional"
                                            accept=".pdf,.doc,.docx"
                                            onChange={(e) => handleFileUpload(e, 'additionalDocs')}
                                            style={{ display: 'none' }}
                                        />
                                        <label htmlFor="additional" className="upload-label">
                                            <FaUpload className="upload-icon" />
                                            <span>Click to upload additional documents</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {}
                        {step === 4 && (
                            <div className="form-step">
                                <h2>Review & Submit</h2>
                                <p className="step-description">Please review your information before submitting</p>

                                <div className="review-section">
                                    <h3>Personal Information</h3>
                                    <div className="review-item">
                                        <span>Name:</span>
                                        <strong>{formData.firstName} {formData.lastName}</strong>
                                    </div>
                                    <div className="review-item">
                                        <span>Email:</span>
                                        <strong>{formData.email}</strong>
                                    </div>
                                    <div className="review-item">
                                        <span>Phone:</span>
                                        <strong>{formData.phone}</strong>
                                    </div>
                                </div>

                                <div className="review-section">
                                    <h3>Professional Information</h3>
                                    <div className="review-item">
                                        <span>Experience:</span>
                                        <strong>{formData.experience}</strong>
                                    </div>
                                    <div className="review-item">
                                        <span>Current Company:</span>
                                        <strong>{formData.currentCompany || 'Not specified'}</strong>
                                    </div>
                                    <div className="review-item">
                                        <span>Skills:</span>
                                        <div className="review-skills">
                                            {formData.skills.map(skill => (
                                                <span key={skill} className="review-skill-tag">{skill}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="review-section">
                                    <h3>Preferences</h3>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Preferred Start Date</label>
                                            <input
                                                type="date"
                                                name="startDate"
                                                value={formData.startDate}
                                                onChange={handleInputChange}
                                                min={new Date().toISOString().split('T')[0]}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Salary Expectation</label>
                                            <input
                                                type="text"
                                                name="salaryExpectation"
                                                value={formData.salaryExpectation}
                                                onChange={handleInputChange}
                                                placeholder="e.g., $100,000"
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label>Work Authorization</label>
                                        <select
                                            name="workAuthorization"
                                            value={formData.workAuthorization}
                                            onChange={handleInputChange}
                                        >
                                            <option value="">Select authorization</option>
                                            <option value="us-citizen">US Citizen</option>
                                            <option value="green-card">Green Card</option>
                                            <option value="h1b">H1-B Visa</option>
                                            <option value="opt">OPT/CPT</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Remote Preference</label>
                                        <div className="radio-group">
                                            <label>
                                                <input
                                                    type="radio"
                                                    name="remotePreference"
                                                    value="remote"
                                                    checked={formData.remotePreference === 'remote'}
                                                    onChange={handleInputChange}
                                                />
                                                Fully Remote
                                            </label>
                                            <label>
                                                <input
                                                    type="radio"
                                                    name="remotePreference"
                                                    value="hybrid"
                                                    checked={formData.remotePreference === 'hybrid'}
                                                    onChange={handleInputChange}
                                                />
                                                Hybrid
                                            </label>
                                            <label>
                                                <input
                                                    type="radio"
                                                    name="remotePreference"
                                                    value="onsite"
                                                    checked={formData.remotePreference === 'onsite'}
                                                    onChange={handleInputChange}
                                                />
                                                On-site
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="terms-section">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            name="agreeToTerms"
                                            checked={formData.agreeToTerms}
                                            onChange={handleInputChange}
                                        />
                                        <span>I agree to the <a href="/terms" target="_blank">Terms of Service</a> and <a href="/privacy" target="_blank">Privacy Policy</a></span>
                                    </label>

                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            name="confirmAccuracy"
                                            checked={formData.confirmAccuracy}
                                            onChange={handleInputChange}
                                        />
                                        <span>I confirm that all information provided is accurate and complete</span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {}
                        <div className="form-navigation">
                            {step > 1 && (
                                <button onClick={handleBack} className="btn btn-secondary">
                                    Back
                                </button>
                            )}
                            {step < 4 ? (
                                <button onClick={handleNext} className="btn btn-primary">
                                    Continue
                                </button>
                            ) : (
                                <button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="btn btn-primary"
                                >
                                    {submitting ? 'Submitting...' : 'Submit Application'} <FaPaperPlane />
                                </button>
                            )}
                        </div>
                    </motion.div>

                    {}
                    <motion.div
                        className="apply-tips"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        <div className="tips-card">
                            <h3>Application Tips</h3>
                            <ul>
                                <li>✓ Tailor your resume to the job description</li>
                                <li>✓ Highlight relevant skills and experience</li>
                                <li>✓ Write a compelling cover letter</li>
                                <li>✓ Proofread before submitting</li>
                                <li>✓ Include links to your portfolio or GitHub</li>
                            </ul>
                        </div>

                        <div className="tips-card">
                            <h3>What Happens Next?</h3>
                            <ol>
                                <li>We'll review your application within 3-5 business days</li>
                                <li>If qualified, we'll schedule an initial phone screen</li>
                                <li>Technical interviews with the team</li>
                                <li>Final interview with leadership</li>
                                <li>Offer and onboarding</li>
                            </ol>
                        </div>

                        <div className="tips-card">
                            <h3>Need Help?</h3>
                            <p>Contact our recruiting team at <a href="mailto:careers@welp.com">careers@welp.com</a></p>
                        </div>
                    </motion.div>
                </div>
            </div>

            <style>{`
                .apply-page {
                    padding: 2rem 0;
                    background: #f7fafc;
                    min-height: 100vh;
                }

                .apply-header {
                    margin-bottom: 2rem;
                }

                .back-btn {
                    background: none;
                    border: none;
                    color: #667eea;
                    font-size: 1rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }

                .back-btn:hover {
                    text-decoration: underline;
                }

                .apply-header h1 {
                    color: #2d3748;
                    font-size: 2rem;
                    margin-bottom: 0.5rem;
                }

                .job-subtitle {
                    color: #718096;
                }

                
                .progress-steps {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin: 2rem 0;
                    background: white;
                    padding: 1.5rem;
                    border-radius: 60px;
                }

                .step {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.5rem;
                }

                .step-number {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: #e2e8f0;
                    color: #a0aec0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                }

                .step.active .step-number {
                    background: #667eea;
                    color: white;
                }

                .step.completed .step-number {
                    background: #48bb78;
                    color: white;
                }

                .step-label {
                    font-size: 0.9rem;
                    color: #a0aec0;
                }

                .step.active .step-label {
                    color: #667eea;
                    font-weight: 500;
                }

                .step-connector {
                    flex: 1;
                    height: 2px;
                    background: #e2e8f0;
                    margin: 0 1rem;
                }

                
                .apply-content {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 2rem;
                }

                .apply-form {
                    background: white;
                    border-radius: 16px;
                    padding: 2rem;
                }

                .form-step h2 {
                    color: #2d3748;
                    margin-bottom: 0.5rem;
                }

                .step-description {
                    color: #718096;
                    margin-bottom: 2rem;
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .form-group {
                    margin-bottom: 1.5rem;
                }

                .form-group label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: #4a5568;
                    font-weight: 500;
                    margin-bottom: 0.5rem;
                }

                .form-group input,
                .form-group select,
                .form-group textarea {
                    width: 100%;
                    padding: 0.75rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 1rem;
                }

                .form-group input:focus,
                .form-group select:focus,
                .form-group textarea:focus {
                    outline: none;
                    border-color: #667eea;
                }

                .skills-input {
                    display: flex;
                    gap: 0.5rem;
                }

                .skills-input input {
                    flex: 1;
                }

                .skills-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    margin-top: 0.5rem;
                }

                .skill-tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.25rem 0.75rem;
                    background: #f7fafc;
                    color: #4a5568;
                    border-radius: 30px;
                    font-size: 0.9rem;
                }

                .skill-tag button {
                    background: none;
                    border: none;
                    color: #a0aec0;
                    cursor: pointer;
                }

                .skill-tag button:hover {
                    color: #f56565;
                }

                .upload-area {
                    border: 2px dashed #e2e8f0;
                    border-radius: 8px;
                    padding: 2rem;
                    text-align: center;
                    cursor: pointer;
                }

                .upload-label {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                }

                .upload-icon {
                    font-size: 2rem;
                    color: #667eea;
                }

                .upload-hint {
                    color: #a0aec0;
                    font-size: 0.85rem;
                }

                .upload-success {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: #48bb78;
                }

                .upload-progress {
                    margin-top: 0.5rem;
                }

                .progress-bar {
                    height: 6px;
                    background: #e2e8f0;
                    border-radius: 3px;
                    overflow: hidden;
                }

                .progress-fill {
                    height: 100%;
                    background: #667eea;
                    transition: width 0.3s;
                }

                
                .review-section {
                    background: #f7fafc;
                    border-radius: 8px;
                    padding: 1.5rem;
                    margin-bottom: 1.5rem;
                }

                .review-section h3 {
                    color: #2d3748;
                    margin-bottom: 1rem;
                }

                .review-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 0.5rem 0;
                    border-bottom: 1px solid #e2e8f0;
                }

                .review-item:last-child {
                    border-bottom: none;
                }

                .review-item span {
                    color: #718096;
                }

                .review-item strong {
                    color: #2d3748;
                }

                .review-skills {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                }

                .review-skill-tag {
                    padding: 0.15rem 0.5rem;
                    background: #e2e8f0;
                    color: #4a5568;
                    border-radius: 30px;
                    font-size: 0.85rem;
                }

                
                .radio-group {
                    display: flex;
                    gap: 1.5rem;
                }

                .radio-group label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-weight: normal;
                }

                
                .terms-section {
                    margin: 2rem 0;
                    padding: 1.5rem;
                    background: #f7fafc;
                    border-radius: 8px;
                }

                .checkbox-label {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 1rem;
                    cursor: pointer;
                }

                .checkbox-label:last-child {
                    margin-bottom: 0;
                }

                .checkbox-label a {
                    color: #667eea;
                    text-decoration: none;
                }

                .checkbox-label a:hover {
                    text-decoration: underline;
                }

                
                .form-navigation {
                    display: flex;
                    gap: 1rem;
                    justify-content: flex-end;
                    margin-top: 2rem;
                }

                
                .apply-tips {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .tips-card {
                    background: white;
                    border-radius: 12px;
                    padding: 1.5rem;
                }

                .tips-card h3 {
                    color: #2d3748;
                    margin-bottom: 1rem;
                }

                .tips-card ul,
                .tips-card ol {
                    padding-left: 1.5rem;
                    color: #4a5568;
                }

                .tips-card li {
                    margin-bottom: 0.5rem;
                }

                .tips-card a {
                    color: #667eea;
                    text-decoration: none;
                }

                .tips-card a:hover {
                    text-decoration: underline;
                }

                .btn-primary,
                .btn-secondary {
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                    border: none;
                }

                .btn-primary {
                    background: #667eea;
                    color: white;
                }

                .btn-primary:hover {
                    background: #5a67d8;
                }

                .btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .btn-secondary {
                    background: #e2e8f0;
                    color: #4a5568;
                }

                .btn-secondary:hover {
                    background: #cbd5e0;
                }

                @media (max-width: 1024px) {
                    .apply-content {
                        grid-template-columns: 1fr;
                    }
                }

                @media (max-width: 768px) {
                    .progress-steps {
                        flex-direction: column;
                        gap: 1rem;
                        border-radius: 20px;
                    }

                    .step-connector {
                        display: none;
                    }

                    .form-row {
                        grid-template-columns: 1fr;
                    }

                    .radio-group {
                        flex-direction: column;
                        gap: 0.5rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default ApplyJob;