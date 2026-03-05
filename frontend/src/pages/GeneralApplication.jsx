
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    FaUser,
    FaEnvelope,
    FaPhone,
    FaFileAlt,
    FaLink,
    FaGithub,
    FaLinkedin,
    FaUpload,
    FaCheckCircle,
    FaArrowLeft,
    FaPaperPlane,
    FaBriefcase,
    FaGraduationCap,
    FaHeart
} from 'react-icons/fa';
import toast from 'react-hot-toast';

const GeneralApplication = () => {
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({});
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        interestedRoles: [],
        experience: '',
        skills: [],
        linkedin: '',
        github: '',
        portfolio: '',
        coverLetter: '',
        resume: null,
        whyWelp: '',
        referral: '',
        agreeToTerms: false
    });

    const [currentSkill, setCurrentSkill] = useState('');
    const [selectedRoles, setSelectedRoles] = useState([]);

    const roleOptions = [
        'Engineering',
        'Product',
        'Design',
        'Marketing',
        'Sales',
        'HR',
        'Operations',
        'Data Science'
    ];

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

    const handleRoleToggle = (role) => {
        setSelectedRoles(prev => {
            const newRoles = prev.includes(role)
                ? prev.filter(r => r !== role)
                : [...prev, role];
            setFormData(prev => ({ ...prev, interestedRoles: newRoles }));
            return newRoles;
        });
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(file.type)) {
            toast.error('Please upload a PDF or Word document');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('File size must be less than 5MB');
            return;
        }

        setUploadProgress({ resume: 0 });

        const interval = setInterval(() => {
            setUploadProgress(prev => ({
                resume: Math.min((prev.resume || 0) + 10, 90)
            }));
        }, 200);

        try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            setFormData(prev => ({ ...prev, resume: file.name }));
            clearInterval(interval);
            setUploadProgress({ resume: 100 });
            setTimeout(() => {
                setUploadProgress({});
                toast.success('Resume uploaded successfully');
            }, 500);
        } catch (error) {
            clearInterval(interval);
            toast.error('Failed to upload resume');
        }
    };

    const handleSubmit = async () => {
        if (!formData.firstName || !formData.lastName) {
            toast.error('Please enter your name');
            return;
        }
        if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            toast.error('Please enter a valid email');
            return;
        }
        if (!formData.resume) {
            toast.error('Please upload your resume');
            return;
        }
        if (!formData.agreeToTerms) {
            toast.error('Please agree to the terms');
            return;
        }

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

    return (
        <div className="general-apply-page">
            <div className="container">
                <button onClick={() => navigate(-1)} className="back-btn">
                    <FaArrowLeft /> Back
                </button>

                <motion.div
                    className="apply-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <h1>General Application</h1>
                    <p className="subtitle">
                        Don't see a specific role that matches your skills? Submit a general application
                        and we'll keep you in mind for future opportunities.
                    </p>

                    <div className="form-grid">
                        <div className="form-section">
                            <h2>
                                <FaUser /> Personal Information
                            </h2>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>First Name *</label>
                                    <input
                                        type="text"
                                        name="firstName"
                                        value={formData.firstName}
                                        onChange={handleInputChange}
                                        placeholder="Enter your first name"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Last Name *</label>
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
                                        <FaPhone /> Phone
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

                        <div className="form-section">
                            <h2>
                                <FaBriefcase /> Professional Information
                            </h2>

                            <div className="form-group">
                                <label>Roles You're Interested In</label>
                                <div className="roles-grid">
                                    {roleOptions.map(role => (
                                        <button
                                            key={role}
                                            type="button"
                                            className={`role-btn ${selectedRoles.includes(role) ? 'selected' : ''}`}
                                            onClick={() => handleRoleToggle(role)}
                                        >
                                            {role}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Years of Experience</label>
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
                                <label>Skills</label>
                                <div className="skills-input">
                                    <input
                                        type="text"
                                        value={currentSkill}
                                        onChange={(e) => setCurrentSkill(e.target.value)}
                                        placeholder="Type a skill and press Add"
                                        onKeyPress={(e) => e.key === 'Enter' && handleAddSkill()}
                                    />
                                    <button type="button" onClick={handleAddSkill} className="add-btn">
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
                        </div>

                        <div className="form-section">
                            <h2>
                                <FaLink /> Online Presence
                            </h2>

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

                            <div className="form-group">
                                <label>Portfolio/Website</label>
                                <input
                                    type="url"
                                    name="portfolio"
                                    value={formData.portfolio}
                                    onChange={handleInputChange}
                                    placeholder="https://yourportfolio.com"
                                />
                            </div>
                        </div>

                        <div className="form-section">
                            <h2>
                                <FaFileAlt /> Application Materials
                            </h2>

                            <div className="form-group">
                                <label>Resume/CV *</label>
                                <div className="upload-area">
                                    <input
                                        type="file"
                                        id="resume"
                                        accept=".pdf,.doc,.docx"
                                        onChange={handleFileUpload}
                                        style={{ display: 'none' }}
                                    />
                                    <label htmlFor="resume" className="upload-label">
                                        {formData.resume ? (
                                            <div className="upload-success">
                                                <FaCheckCircle />
                                                <span>{formData.resume}</span>
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
                                <label>Cover Letter</label>
                                <textarea
                                    name="coverLetter"
                                    value={formData.coverLetter}
                                    onChange={handleInputChange}
                                    placeholder="Tell us about yourself and why you're interested in Welp..."
                                    rows="6"
                                />
                            </div>

                            <div className="form-group">
                                <label>
                                    <FaHeart /> Why Welp?
                                </label>
                                <textarea
                                    name="whyWelp"
                                    value={formData.whyWelp}
                                    onChange={handleInputChange}
                                    placeholder="What excites you about our mission and culture?"
                                    rows="4"
                                />
                            </div>

                            <div className="form-group">
                                <label>How did you hear about us?</label>
                                <input
                                    type="text"
                                    name="referral"
                                    value={formData.referral}
                                    onChange={handleInputChange}
                                    placeholder="e.g., LinkedIn, Friend, Job Board"
                                />
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
                            <span>
                                I agree to the <a href="/terms" target="_blank">Terms of Service</a> and
                                <a href="/privacy" target="_blank"> Privacy Policy</a>. I confirm that all
                                information provided is accurate.
                            </span>
                        </label>
                    </div>

                    <div className="form-actions">
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="btn btn-primary"
                        >
                            {submitting ? 'Submitting...' : 'Submit Application'} <FaPaperPlane />
                        </button>
                    </div>
                </motion.div>
            </div>

            <style>{`
                .general-apply-page {
                    padding: 2rem 0;
                    background: #f7fafc;
                    min-height: 100vh;
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
                    margin-bottom: 2rem;
                }

                .back-btn:hover {
                    text-decoration: underline;
                }

                .apply-card {
                    max-width: 900px;
                    margin: 0 auto;
                    background: white;
                    border-radius: 16px;
                    padding: 2rem;
                }

                .apply-card h1 {
                    color: #2d3748;
                    margin-bottom: 0.5rem;
                }

                .subtitle {
                    color: #718096;
                    margin-bottom: 2rem;
                }

                .form-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 2rem;
                }

                .form-section h2 {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: #2d3748;
                    margin-bottom: 1.5rem;
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .form-group {
                    margin-bottom: 1rem;
                }

                .form-group label {
                    display: block;
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

                .roles-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }

                .role-btn {
                    padding: 0.5rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 30px;
                    background: white;
                    color: #4a5568;
                    cursor: pointer;
                    transition: all 0.3s;
                }

                .role-btn.selected {
                    background: #667eea;
                    color: white;
                    border-color: #667eea;
                }

                .skills-input {
                    display: flex;
                    gap: 0.5rem;
                }

                .skills-input input {
                    flex: 1;
                }

                .add-btn {
                    padding: 0 1rem;
                    background: #667eea;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
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
                }

                .skill-tag button {
                    background: none;
                    border: none;
                    color: #a0aec0;
                    cursor: pointer;
                }

                .upload-area {
                    border: 2px dashed #e2e8f0;
                    border-radius: 8px;
                    padding: 2rem;
                    text-align: center;
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
                    cursor: pointer;
                }

                .checkbox-label a {
                    color: #667eea;
                    text-decoration: none;
                }

                .checkbox-label a:hover {
                    text-decoration: underline;
                }

                .form-actions {
                    display: flex;
                    justify-content: flex-end;
                }

                .btn-primary {
                    background: #667eea;
                    color: white;
                    padding: 0.75rem 1.5rem;
                    border: none;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .btn-primary:hover {
                    background: #5a67d8;
                }

                .btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                @media (max-width: 768px) {
                    .form-row {
                        grid-template-columns: 1fr;
                    }

                    .roles-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
            `}</style>
        </div>
    );
};

export default GeneralApplication;