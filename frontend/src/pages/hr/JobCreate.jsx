// src/pages/hr/JobCreate.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';
import {
    FaBriefcase,
    FaSave,
    FaTimes,
    FaPlus,
    FaTrash,
    FaBuilding,
    FaMapMarkerAlt,
    FaClock,
    FaDollarSign,
    FaLevelUpAlt,
    FaGraduationCap,
    FaGlobe,
    FaCheckCircle,
    FaRegClock,
    FaArrowLeft,
    FaCloudUploadAlt
} from 'react-icons/fa';

const JobCreate = () => {
    const navigate = useNavigate();
    const { id } = useParams(); // For edit mode
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [formData, setFormData] = useState({
        title: '',
        department_id: '',
        employment_type: 'full-time',
        location: '',
        is_remote: false,
        salary_min: '',
        salary_max: '',
        salary_currency: 'USD',
        description: '',
        requirements: [],
        responsibilities: [],
        benefits: [],
        skills_required: [],
        experience_level: '',
        education_required: '',
        application_deadline: '',
        status: 'draft'
    });

    const [newRequirement, setNewRequirement] = useState('');
    const [newResponsibility, setNewResponsibility] = useState('');
    const [newBenefit, setNewBenefit] = useState('');
    const [newSkill, setNewSkill] = useState('');

    // Fetch departments on mount
    useEffect(() => {
        fetchDepartments();
        if (id) {
            fetchJobDetails();
        }
    }, [id]);

    const fetchDepartments = async () => {
        try {
            const { data } = await api.get('/hr/departments');
            const deptData = data.data || data.departments || data;
            setDepartments(Array.isArray(deptData) ? deptData : []);
        } catch (error) {
            console.error('Failed to fetch departments:', error);
            toast.error('Failed to load departments');
        }
    };

    const fetchJobDetails = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/hr/jobs/${id}`);
            const jobData = data.data || data;

            setFormData({
                title: jobData.title || '',
                department_id: jobData.department_id || '',
                employment_type: jobData.employment_type || 'full-time',
                location: jobData.location || '',
                is_remote: jobData.is_remote || false,
                salary_min: jobData.salary_min || '',
                salary_max: jobData.salary_max || '',
                salary_currency: jobData.salary_currency || 'USD',
                description: jobData.description || '',
                requirements: Array.isArray(jobData.requirements) ? jobData.requirements : [],
                responsibilities: Array.isArray(jobData.responsibilities) ? jobData.responsibilities : [],
                benefits: Array.isArray(jobData.benefits) ? jobData.benefits : [],
                skills_required: Array.isArray(jobData.skills_required) ? jobData.skills_required : [],
                experience_level: jobData.experience_level || '',
                education_required: jobData.education_required || '',
                application_deadline: jobData.application_deadline ? jobData.application_deadline.split('T')[0] : '',
                status: jobData.status || 'draft'
            });
        } catch (error) {
            console.error('Failed to fetch job details:', error);
            toast.error('Failed to load job details');
            navigate('/hr/jobs');
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

    const handleAddRequirement = () => {
        if (newRequirement.trim()) {
            setFormData(prev => ({
                ...prev,
                requirements: [...prev.requirements, newRequirement.trim()]
            }));
            setNewRequirement('');
        }
    };

    const handleRemoveRequirement = (index) => {
        setFormData(prev => ({
            ...prev,
            requirements: prev.requirements.filter((_, i) => i !== index)
        }));
    };

    const handleAddResponsibility = () => {
        if (newResponsibility.trim()) {
            setFormData(prev => ({
                ...prev,
                responsibilities: [...prev.responsibilities, newResponsibility.trim()]
            }));
            setNewResponsibility('');
        }
    };

    const handleRemoveResponsibility = (index) => {
        setFormData(prev => ({
            ...prev,
            responsibilities: prev.responsibilities.filter((_, i) => i !== index)
        }));
    };

    const handleAddBenefit = () => {
        if (newBenefit.trim()) {
            setFormData(prev => ({
                ...prev,
                benefits: [...prev.benefits, newBenefit.trim()]
            }));
            setNewBenefit('');
        }
    };

    const handleRemoveBenefit = (index) => {
        setFormData(prev => ({
            ...prev,
            benefits: prev.benefits.filter((_, i) => i !== index)
        }));
    };

    const handleAddSkill = () => {
        if (newSkill.trim()) {
            setFormData(prev => ({
                ...prev,
                skills_required: [...prev.skills_required, newSkill.trim()]
            }));
            setNewSkill('');
        }
    };

    const handleRemoveSkill = (index) => {
        setFormData(prev => ({
            ...prev,
            skills_required: prev.skills_required.filter((_, i) => i !== index)
        }));
    };

    const validateForm = () => {
        if (!formData.title.trim()) {
            toast.error('Job title is required');
            return false;
        }
        if (!formData.department_id) {
            toast.error('Department is required');
            return false;
        }
        if (!formData.description.trim()) {
            toast.error('Job description is required');
            return false;
        }
        if (formData.salary_min && formData.salary_max &&
            Number(formData.salary_min) > Number(formData.salary_max)) {
            toast.error('Minimum salary cannot be greater than maximum salary');
            return false;
        }
        return true;
    };

    const handleSubmit = async (status = 'draft') => {
        if (!validateForm()) return;

        setSubmitting(true);
        try {
            // Prepare data for API
            const jobData = {
                ...formData,
                salary_min: formData.salary_min ? Number(formData.salary_min) : null,
                salary_max: formData.salary_max ? Number(formData.salary_max) : null,
                requirements: formData.requirements,
                responsibilities: formData.responsibilities,
                benefits: formData.benefits,
                skills_required: formData.skills_required,
                status: status // Use the passed status
            };

            let response;
            if (id) {
                // Update existing job
                response = await api.put(`/hr/jobs/${id}`, jobData);
            } else {
                // Create new job
                response = await api.post('/hr/jobs', jobData);
            }

            if (response.data.success || response.data.id) {
                toast.success(status === 'open'
                    ? 'Job published successfully!'
                    : 'Job saved as draft successfully!'
                );
                navigate('/hr/jobs');
            } else {
                toast.error('Failed to save job');
            }
        } catch (error) {
            console.error('Error saving job:', error);
            toast.error(error.response?.data?.error || 'Failed to save job');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePublish = () => {
        handleSubmit('open');
    };

    const handleSaveDraft = () => {
        handleSubmit('draft');
    };

    if (loading) return <Loading />;

    return (
        <div className="job-create-page">
            {/* Header */}
            <div className="page-header">
                <div className="header-left">
                    <button className="back-button" onClick={() => navigate('/hr/jobs')}>
                        <FaArrowLeft /> Back to Jobs
                    </button>
                    <h1>
                        <FaBriefcase className="header-icon" />
                        {id ? 'Edit Job Posting' : 'Create New Job Posting'}
                    </h1>
                </div>
                <div className="header-actions">
                    <button
                        className="btn btn-secondary"
                        onClick={() => navigate('/hr/jobs')}
                        disabled={submitting}
                    >
                        <FaTimes /> Cancel
                    </button>
                    <button
                        className="btn btn-success"
                        onClick={handlePublish}
                        disabled={submitting}
                    >
                        {submitting ? <FaRegClock className="spinning" /> : <FaCloudUploadAlt />}
                        {submitting ? 'Publishing...' : 'Publish Job'}
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSaveDraft}
                        disabled={submitting}
                    >
                        {submitting ? <FaRegClock className="spinning" /> : <FaSave />}
                        {submitting ? 'Saving...' : 'Save as Draft'}
                    </button>
                </div>
            </div>

            {/* Form */}
            <form className="job-form" onSubmit={(e) => e.preventDefault()}>
                <div className="form-grid">
                    {/* Basic Information */}
                    <div className="form-section">
                        <h2>Basic Information</h2>

                        <div className="form-group">
                            <label>Job Title *</label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleInputChange}
                                placeholder="e.g., Senior Frontend Developer"
                                disabled={submitting}
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Department *</label>
                                <select
                                    name="department_id"
                                    value={formData.department_id}
                                    onChange={handleInputChange}
                                    disabled={submitting}
                                >
                                    <option value="">Select Department</option>
                                    {departments.map(dept => (
                                        <option key={dept.id} value={dept.id}>
                                            {dept.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Employment Type</label>
                                <select
                                    name="employment_type"
                                    value={formData.employment_type}
                                    onChange={handleInputChange}
                                    disabled={submitting}
                                >
                                    <option value="full-time">Full Time</option>
                                    <option value="part-time">Part Time</option>
                                    <option value="contract">Contract</option>
                                    <option value="internship">Internship</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Location</label>
                                <input
                                    type="text"
                                    name="location"
                                    value={formData.location}
                                    onChange={handleInputChange}
                                    placeholder="e.g., New York, NY"
                                    disabled={submitting}
                                />
                            </div>

                            <div className="form-group checkbox-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="is_remote"
                                        checked={formData.is_remote}
                                        onChange={handleInputChange}
                                        disabled={submitting}
                                    />
                                    <span>Remote Position</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Compensation */}
                    <div className="form-section">
                        <h2>Compensation</h2>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Salary Min</label>
                                <input
                                    type="number"
                                    name="salary_min"
                                    value={formData.salary_min}
                                    onChange={handleInputChange}
                                    placeholder="50000"
                                    disabled={submitting}
                                />
                            </div>

                            <div className="form-group">
                                <label>Salary Max</label>
                                <input
                                    type="number"
                                    name="salary_max"
                                    value={formData.salary_max}
                                    onChange={handleInputChange}
                                    placeholder="80000"
                                    disabled={submitting}
                                />
                            </div>

                            <div className="form-group">
                                <label>Currency</label>
                                <select
                                    name="salary_currency"
                                    value={formData.salary_currency}
                                    onChange={handleInputChange}
                                    disabled={submitting}
                                >
                                    <option value="USD">USD</option>
                                    <option value="EUR">EUR</option>
                                    <option value="GBP">GBP</option>
                                    <option value="CAD">CAD</option>
                                    <option value="AUD">AUD</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Requirements & Qualifications */}
                    <div className="form-section">
                        <h2>Requirements & Qualifications</h2>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Experience Level</label>
                                <select
                                    name="experience_level"
                                    value={formData.experience_level}
                                    onChange={handleInputChange}
                                    disabled={submitting}
                                >
                                    <option value="">Select Experience Level</option>
                                    <option value="entry">Entry Level (0-2 years)</option>
                                    <option value="mid">Mid Level (3-5 years)</option>
                                    <option value="senior">Senior Level (5-8 years)</option>
                                    <option value="lead">Lead (8+ years)</option>
                                    <option value="executive">Executive</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Education Required</label>
                                <input
                                    type="text"
                                    name="education_required"
                                    value={formData.education_required}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Bachelor's in Computer Science"
                                    disabled={submitting}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Skills Required</label>
                            <div className="tag-input-group">
                                <input
                                    type="text"
                                    value={newSkill}
                                    onChange={(e) => setNewSkill(e.target.value)}
                                    placeholder="Add a skill (e.g., React, Python)"
                                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill())}
                                    disabled={submitting}
                                />
                                <button
                                    type="button"
                                    className="btn-icon"
                                    onClick={handleAddSkill}
                                    disabled={submitting}
                                >
                                    <FaPlus />
                                </button>
                            </div>
                            <div className="tags-list">
                                {formData.skills_required.map((skill, index) => (
                                    <span key={index} className="tag">
                                        {skill}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveSkill(index)}
                                            disabled={submitting}
                                        >
                                            <FaTimes />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Requirements</label>
                            <div className="tag-input-group">
                                <input
                                    type="text"
                                    value={newRequirement}
                                    onChange={(e) => setNewRequirement(e.target.value)}
                                    placeholder="Add a requirement"
                                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRequirement())}
                                    disabled={submitting}
                                />
                                <button
                                    type="button"
                                    className="btn-icon"
                                    onClick={handleAddRequirement}
                                    disabled={submitting}
                                >
                                    <FaPlus />
                                </button>
                            </div>
                            <ul className="list-items">
                                {formData.requirements.map((req, index) => (
                                    <li key={index}>
                                        {req}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveRequirement(index)}
                                            disabled={submitting}
                                        >
                                            <FaTrash />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Responsibilities */}
                    <div className="form-section">
                        <h2>Responsibilities</h2>

                        <div className="form-group">
                            <div className="tag-input-group">
                                <input
                                    type="text"
                                    value={newResponsibility}
                                    onChange={(e) => setNewResponsibility(e.target.value)}
                                    placeholder="Add a responsibility"
                                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddResponsibility())}
                                    disabled={submitting}
                                />
                                <button
                                    type="button"
                                    className="btn-icon"
                                    onClick={handleAddResponsibility}
                                    disabled={submitting}
                                >
                                    <FaPlus />
                                </button>
                            </div>
                            <ul className="list-items">
                                {formData.responsibilities.map((resp, index) => (
                                    <li key={index}>
                                        {resp}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveResponsibility(index)}
                                            disabled={submitting}
                                        >
                                            <FaTrash />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Benefits */}
                    <div className="form-section">
                        <h2>Benefits</h2>

                        <div className="form-group">
                            <div className="tag-input-group">
                                <input
                                    type="text"
                                    value={newBenefit}
                                    onChange={(e) => setNewBenefit(e.target.value)}
                                    placeholder="Add a benefit"
                                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddBenefit())}
                                    disabled={submitting}
                                />
                                <button
                                    type="button"
                                    className="btn-icon"
                                    onClick={handleAddBenefit}
                                    disabled={submitting}
                                >
                                    <FaPlus />
                                </button>
                            </div>
                            <ul className="list-items">
                                {formData.benefits.map((benefit, index) => (
                                    <li key={index}>
                                        {benefit}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveBenefit(index)}
                                            disabled={submitting}
                                        >
                                            <FaTrash />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="form-section full-width">
                        <h2>Job Description *</h2>

                        <div className="form-group">
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                rows="10"
                                placeholder="Provide a detailed description of the role..."
                                disabled={submitting}
                            />
                        </div>
                    </div>

                    {/* Additional Information */}
                    <div className="form-section">
                        <h2>Additional Information</h2>

                        <div className="form-group">
                            <label>Application Deadline</label>
                            <input
                                type="date"
                                name="application_deadline"
                                value={formData.application_deadline}
                                onChange={handleInputChange}
                                min={new Date().toISOString().split('T')[0]}
                                disabled={submitting}
                            />
                        </div>
                    </div>
                </div>
            </form>

            <style>{`
                .job-create-page {
                    padding: 2rem;
                    max-width: 1200px;
                    margin: 0 auto;
                }

                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }

                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .back-button {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    background: #f7fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    color: #4a5568;
                    cursor: pointer;
                    font-size: 0.9rem;
                }

                .back-button:hover {
                    background: #edf2f7;
                }

                .back-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .page-header h1 {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    color: #2d3748;
                }

                .header-icon {
                    color: #4299e1;
                }

                .header-actions {
                    display: flex;
                    gap: 1rem;
                    align-items: center;
                }

                .btn {
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    border: none;
                    font-size: 0.95rem;
                    transition: all 0.3s;
                }

                .btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .btn-primary {
                    background: #4299e1;
                    color: white;
                }

                .btn-primary:hover:not(:disabled) {
                    background: #3182ce;
                }

                .btn-success {
                    background: #48bb78;
                    color: white;
                }

                .btn-success:hover:not(:disabled) {
                    background: #38a169;
                }

                .btn-secondary {
                    background: white;
                    color: #4a5568;
                    border: 1px solid #e2e8f0;
                }

                .btn-secondary:hover:not(:disabled) {
                    background: #f7fafc;
                }

                .spinning {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .job-form {
                    background: white;
                    border-radius: 12px;
                    padding: 2rem;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }

                .form-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 2rem;
                }

                .form-section {
                    background: #f7fafc;
                    padding: 1.5rem;
                    border-radius: 8px;
                }

                .form-section.full-width {
                    grid-column: 1 / -1;
                }

                .form-section h2 {
                    color: #2d3748;
                    font-size: 1.25rem;
                    margin-bottom: 1.5rem;
                }

                .form-group {
                    margin-bottom: 1rem;
                }

                .form-group label {
                    display: block;
                    color: #4a5568;
                    font-size: 0.9rem;
                    font-weight: 600;
                    margin-bottom: 0.5rem;
                }

                .form-group input,
                .form-group select,
                .form-group textarea {
                    width: 100%;
                    padding: 0.75rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    font-size: 0.95rem;
                    transition: all 0.3s;
                }

                .form-group input:focus,
                .form-group select:focus,
                .form-group textarea:focus {
                    outline: none;
                    border-color: #4299e1;
                    box-shadow: 0 0 0 3px rgba(66,153,225,0.1);
                }

                .form-group input:disabled,
                .form-group select:disabled,
                .form-group textarea:disabled {
                    background: #f7fafc;
                    cursor: not-allowed;
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                }

                .checkbox-group {
                    display: flex;
                    align-items: center;
                    padding-top: 1.5rem;
                }

                .checkbox-group label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    cursor: pointer;
                    margin-bottom: 0;
                }

                .checkbox-group input[type="checkbox"] {
                    width: auto;
                }

                .tag-input-group {
                    display: flex;
                    gap: 0.5rem;
                }

                .tag-input-group input {
                    flex: 1;
                }

                .btn-icon {
                    width: 42px;
                    height: 42px;
                    border-radius: 6px;
                    border: none;
                    background: #4299e1;
                    color: white;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s;
                }

                .btn-icon:hover:not(:disabled) {
                    background: #3182ce;
                }

                .btn-icon:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .tags-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    margin-top: 0.5rem;
                }

                .tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.25rem 0.75rem;
                    background: #4299e1;
                    color: white;
                    border-radius: 30px;
                    font-size: 0.85rem;
                }

                .tag button {
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    padding: 0;
                    display: flex;
                    align-items: center;
                }

                .tag button:hover {
                    opacity: 0.8;
                }

                .list-items {
                    list-style: none;
                    padding: 0;
                    margin: 0.5rem 0 0;
                }

                .list-items li {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.5rem;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 4px;
                    margin-bottom: 0.25rem;
                }

                .list-items li button {
                    background: none;
                    border: none;
                    color: #f56565;
                    cursor: pointer;
                    padding: 0.25rem;
                }

                .list-items li button:hover {
                    color: #e53e3e;
                }

                @media (max-width: 768px) {
                    .page-header {
                        flex-direction: column;
                        gap: 1rem;
                        align-items: flex-start;
                    }

                    .header-actions {
                        width: 100%;
                        flex-direction: column;
                    }

                    .btn {
                        width: 100%;
                        justify-content: center;
                    }

                    .form-grid {
                        grid-template-columns: 1fr;
                    }

                    .form-row {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
};

export default JobCreate;