import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
    FaRegClock
} from 'react-icons/fa';

const JobCreate = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
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

    useEffect(() => {
        fetchDepartments();
    }, []);

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

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setLoading(true);
        try {
            // Prepare data for API
            const jobData = {
                ...formData,
                salary_min: formData.salary_min ? Number(formData.salary_min) : null,
                salary_max: formData.salary_max ? Number(formData.salary_max) : null,
                requirements: formData.requirements,
                responsibilities: formData.responsibilities,
                benefits: formData.benefits,
                skills_required: formData.skills_required
            };

            const response = await api.post('/hr/jobs', jobData);

            if (response.data.success || response.data.id) {
                toast.success('Job created successfully');
                navigate('/hr/jobs');
            } else {
                toast.error('Failed to create job');
            }
        } catch (error) {
            console.error('Error creating job:', error);
            toast.error(error.response?.data?.error || 'Failed to create job');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAsDraft = async () => {
        setFormData(prev => ({ ...prev, status: 'draft' }));
        await handleSubmit({ preventDefault: () => {} });
    };

    const handlePublish = async () => {
        setFormData(prev => ({ ...prev, status: 'open' }));
        await handleSubmit({ preventDefault: () => {} });
    };

    if (loading) return <Loading />;

    return (
        <div className="job-create-page">
            <div className="page-header">
                <h1>
                    <FaBriefcase className="header-icon" />
                    Create New Job Posting
                </h1>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={() => navigate('/hr/jobs')}>
                        <FaTimes /> Cancel
                    </button>
                    <button className="btn btn-primary" onClick={handlePublish}>
                        <FaCheckCircle /> Publish Job
                    </button>
                    <button className="btn btn-secondary" onClick={handleSaveAsDraft}>
                        <FaSave /> Save as Draft
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="job-form">
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
                                required
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Department *</label>
                                <select
                                    name="department_id"
                                    value={formData.department_id}
                                    onChange={handleInputChange}
                                    required
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
                                >
                                    <option value="full-time">Full Time</option>
                                    <option value="part-time">Part Time</option>
                                    <option value="contract">Contract</option>
                                    <option value="internship">Internship</option>
                                    <option value="remote">Remote</option>
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
                                />
                            </div>

                            <div className="form-group checkbox-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        name="is_remote"
                                        checked={formData.is_remote}
                                        onChange={handleInputChange}
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
                                />
                            </div>

                            <div className="form-group">
                                <label>Currency</label>
                                <select
                                    name="salary_currency"
                                    value={formData.salary_currency}
                                    onChange={handleInputChange}
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

                    {/* Requirements */}
                    <div className="form-section">
                        <h2>Requirements & Qualifications</h2>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Experience Level</label>
                                <select
                                    name="experience_level"
                                    value={formData.experience_level}
                                    onChange={handleInputChange}
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
                                />
                                <button type="button" className="btn-icon" onClick={handleAddSkill}>
                                    <FaPlus />
                                </button>
                            </div>
                            <div className="tags-list">
                                {formData.skills_required.map((skill, index) => (
                                    <span key={index} className="tag">
                                        {skill}
                                        <button type="button" onClick={() => handleRemoveSkill(index)}>
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
                                />
                                <button type="button" className="btn-icon" onClick={handleAddRequirement}>
                                    <FaPlus />
                                </button>
                            </div>
                            <ul className="list-items">
                                {formData.requirements.map((req, index) => (
                                    <li key={index}>
                                        {req}
                                        <button type="button" onClick={() => handleRemoveRequirement(index)}>
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
                                />
                                <button type="button" className="btn-icon" onClick={handleAddResponsibility}>
                                    <FaPlus />
                                </button>
                            </div>
                            <ul className="list-items">
                                {formData.responsibilities.map((resp, index) => (
                                    <li key={index}>
                                        {resp}
                                        <button type="button" onClick={() => handleRemoveResponsibility(index)}>
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
                                />
                                <button type="button" className="btn-icon" onClick={handleAddBenefit}>
                                    <FaPlus />
                                </button>
                            </div>
                            <ul className="list-items">
                                {formData.benefits.map((benefit, index) => (
                                    <li key={index}>
                                        {benefit}
                                        <button type="button" onClick={() => handleRemoveBenefit(index)}>
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
                                required
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
                            />
                        </div>
                    </div>
                </div>

                <div className="form-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => navigate('/hr/jobs')}>
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ display: 'none' }}>Submit</button>
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
                }

                .form-group input:focus,
                .form-group select:focus,
                .form-group textarea:focus {
                    outline: none;
                    border-color: #4299e1;
                    box-shadow: 0 0 0 3px rgba(66,153,225,0.1);
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

                .form-actions {
                    margin-top: 2rem;
                    display: flex;
                    justify-content: flex-end;
                    gap: 1rem;
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
                }

                .btn-primary {
                    background: #4299e1;
                    color: white;
                }

                .btn-primary:hover {
                    background: #3182ce;
                }

                .btn-secondary {
                    background: white;
                    color: #4a5568;
                    border: 1px solid #e2e8f0;
                }

                .btn-secondary:hover {
                    background: #f7fafc;
                }

                .btn-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 6px;
                    border: none;
                    background: #4299e1;
                    color: white;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }

                .btn-icon:hover {
                    background: #3182ce;
                }

                @media (max-width: 768px) {
                    .form-grid {
                        grid-template-columns: 1fr;
                    }

                    .form-row {
                        grid-template-columns: 1fr;
                    }

                    .page-header {
                        flex-direction: column;
                        gap: 1rem;
                        align-items: flex-start;
                    }

                    .header-actions {
                        width: 100%;
                        flex-direction: column;
                    }
                }
            `}</style>
        </div>
    );
};

export default JobCreate;