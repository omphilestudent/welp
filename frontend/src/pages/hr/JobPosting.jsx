// frontend/src/pages/hr/JobPostings.jsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';
import { FaPlus, FaEdit, FaEye, FaTrash, FaPaperPlane } from 'react-icons/fa';
import { format } from 'date-fns';

const JobPostings = () => {
    const [jobs, setJobs] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingJob, setEditingJob] = useState(null);

    useEffect(() => {
        fetchJobs();
        fetchDepartments();
    }, []);

    const fetchJobs = async () => {
        try {
            const { data } = await api.get('/hr/jobs');
            setJobs(data);
        } catch (error) {
            toast.error('Failed to load jobs');
        }
    };

    const fetchDepartments = async () => {
        try {
            const { data } = await api.get('/hr/departments');
            setDepartments(data);
        } catch (error) {
            toast.error('Failed to load departments');
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async (jobId) => {
        try {
            await api.patch(`/hr/jobs/${jobId}/publish`);
            toast.success('Job published successfully');
            fetchJobs();
        } catch (error) {
            toast.error('Failed to publish job');
        }
    };

    const handleClose = async (jobId) => {
        try {
            await api.patch(`/hr/jobs/${jobId}/close`);
            toast.success('Job closed successfully');
            fetchJobs();
        } catch (error) {
            toast.error('Failed to close job');
        }
    };

    const handleDelete = async (jobId) => {
        if (!window.confirm('Are you sure you want to delete this job posting?')) return;

        try {
            await api.delete(`/hr/jobs/${jobId}`);
            toast.success('Job deleted successfully');
            fetchJobs();
        } catch (error) {
            toast.error('Failed to delete job');
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            draft: 'badge-secondary',
            published: 'badge-success',
            closed: 'badge-danger',
            filled: 'badge-info'
        };
        return `badge ${badges[status] || 'badge-secondary'}`;
    };

    if (loading) return <Loading />;

    return (
        <div className="job-postings-page">
            <div className="page-header">
                <h1>Job Postings</h1>
                <button className="btn btn-primary" onClick={() => {
                    setEditingJob(null);
                    setShowForm(true);
                }}>
                    <FaPlus /> New Job Posting
                </button>
            </div>

            <div className="jobs-grid">
                {jobs.map(job => (
                    <div key={job.id} className="job-card">
                        <div className="job-header">
                            <h3>{job.title}</h3>
                            <span className={getStatusBadge(job.status)}>
                                {job.status}
                            </span>
                        </div>

                        <div className="job-meta">
                            <p><strong>Department:</strong> {job.department_name}</p>
                            <p><strong>Type:</strong> {job.employment_type}</p>
                            <p><strong>Location:</strong> {job.location || 'Remote'}</p>
                            {job.salary_min && job.salary_max && (
                                <p><strong>Salary:</strong> {job.salary_currency} {job.salary_min} - {job.salary_max}</p>
                            )}
                            <p><strong>Deadline:</strong> {format(new Date(job.application_deadline), 'MMM dd, yyyy')}</p>
                            <p><strong>Applications:</strong> {job.applications_count}</p>
                            <p><strong>Views:</strong> {job.views_count}</p>
                        </div>

                        <div className="job-actions">
                            <button
                                className="btn-icon"
                                onClick={() => window.open(`/hr/jobs/${job.id}`, '_blank')}
                                title="View"
                            >
                                <FaEye />
                            </button>
                            <button
                                className="btn-icon"
                                onClick={() => {
                                    setEditingJob(job);
                                    setShowForm(true);
                                }}
                                title="Edit"
                            >
                                <FaEdit />
                            </button>
                            {job.status === 'draft' && (
                                <button
                                    className="btn-icon success"
                                    onClick={() => handlePublish(job.id)}
                                    title="Publish"
                                >
                                    <FaPaperPlane />
                                </button>
                            )}
                            {job.status === 'published' && (
                                <button
                                    className="btn-icon warning"
                                    onClick={() => handleClose(job.id)}
                                    title="Close"
                                >
                                    Close
                                </button>
                            )}
                            <button
                                className="btn-icon danger"
                                onClick={() => handleDelete(job.id)}
                                title="Delete"
                            >
                                <FaTrash />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {showForm && (
                <JobForm
                    job={editingJob}
                    departments={departments}
                    onClose={() => setShowForm(false)}
                    onSave={() => {
                        setShowForm(false);
                        fetchJobs();
                    }}
                />
            )}
        </div>
    );
};

// Job Form Modal
const JobForm = ({ job, departments, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        title: job?.title || '',
        department_id: job?.department_id || '',
        employment_type: job?.employment_type || 'full-time',
        location: job?.location || '',
        salary_min: job?.salary_min || '',
        salary_max: job?.salary_max || '',
        salary_currency: job?.salary_currency || 'USD',
        description: job?.description || '',
        requirements: job?.requirements || [''],
        responsibilities: job?.responsibilities || [''],
        benefits: job?.benefits || [''],
        skills_required: job?.skills_required || [''],
        experience_level: job?.experience_level || '',
        education_required: job?.education_required || '',
        application_deadline: job?.application_deadline
            ? format(new Date(job.application_deadline), 'yyyy-MM-dd')
            : ''
    });

    const handleArrayInput = (field, index, value) => {
        const newArray = [...formData[field]];
        newArray[index] = value;
        setFormData({ ...formData, [field]: newArray });
    };

    const addArrayItem = (field) => {
        setFormData({ ...formData, [field]: [...formData[field], ''] });
    };

    const removeArrayItem = (field, index) => {
        const newArray = formData[field].filter((_, i) => i !== index);
        setFormData({ ...formData, [field]: newArray });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Filter out empty items
        const cleanData = {
            ...formData,
            requirements: formData.requirements.filter(r => r.trim()),
            responsibilities: formData.responsibilities.filter(r => r.trim()),
            benefits: formData.benefits.filter(b => b.trim()),
            skills_required: formData.skills_required.filter(s => s.trim())
        };

        try {
            if (job) {
                await api.patch(`/hr/jobs/${job.id}`, cleanData);
                toast.success('Job updated successfully');
            } else {
                await api.post('/hr/jobs', cleanData);
                toast.success('Job created successfully');
            }
            onSave();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to save job');
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content large">
                <h2>{job ? 'Edit Job' : 'Create New Job'}</h2>

                <form onSubmit={handleSubmit} className="job-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label>Job Title *</label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({...formData, title: e.target.value})}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Department *</label>
                            <select
                                value={formData.department_id}
                                onChange={(e) => setFormData({...formData, department_id: e.target.value})}
                                required
                            >
                                <option value="">Select Department</option>
                                {departments.map(dept => (
                                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Employment Type *</label>
                            <select
                                value={formData.employment_type}
                                onChange={(e) => setFormData({...formData, employment_type: e.target.value})}
                                required
                            >
                                <option value="full-time">Full Time</option>
                                <option value="part-time">Part Time</option>
                                <option value="contract">Contract</option>
                                <option value="internship">Internship</option>
                                <option value="remote">Remote</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Location</label>
                            <input
                                type="text"
                                value={formData.location}
                                onChange={(e) => setFormData({...formData, location: e.target.value})}
                                placeholder="City, Country or Remote"
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Salary Min</label>
                            <input
                                type="number"
                                value={formData.salary_min}
                                onChange={(e) => setFormData({...formData, salary_min: e.target.value})}
                            />
                        </div>
                        <div className="form-group">
                            <label>Salary Max</label>
                            <input
                                type="number"
                                value={formData.salary_max}
                                onChange={(e) => setFormData({...formData, salary_max: e.target.value})}
                            />
                        </div>
                        <div className="form-group">
                            <label>Currency</label>
                            <select
                                value={formData.salary_currency}
                                onChange={(e) => setFormData({...formData, salary_currency: e.target.value})}
                            >
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                                <option value="ZAR">ZAR</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Job Description *</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({...formData, description: e.target.value})}
                            rows="5"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Requirements</label>
                        {formData.requirements.map((req, index) => (
                            <div key={index} className="array-input">
                                <input
                                    type="text"
                                    value={req}
                                    onChange={(e) => handleArrayInput('requirements', index, e.target.value)}
                                    placeholder="Enter requirement"
                                />
                                <button type="button" onClick={() => removeArrayItem('requirements', index)}>
                                    Remove
                                </button>
                            </div>
                        ))}
                        <button type="button" onClick={() => addArrayItem('requirements')}>
                            Add Requirement
                        </button>
                    </div>

                    <div className="form-group">
                        <label>Responsibilities</label>
                        {formData.responsibilities.map((resp, index) => (
                            <div key={index} className="array-input">
                                <input
                                    type="text"
                                    value={resp}
                                    onChange={(e) => handleArrayInput('responsibilities', index, e.target.value)}
                                    placeholder="Enter responsibility"
                                />
                                <button type="button" onClick={() => removeArrayItem('responsibilities', index)}>
                                    Remove
                                </button>
                            </div>
                        ))}
                        <button type="button" onClick={() => addArrayItem('responsibilities')}>
                            Add Responsibility
                        </button>
                    </div>

                    <div className="form-group">
                        <label>Benefits</label>
                        {formData.benefits.map((benefit, index) => (
                            <div key={index} className="array-input">
                                <input
                                    type="text"
                                    value={benefit}
                                    onChange={(e) => handleArrayInput('benefits', index, e.target.value)}
                                    placeholder="Enter benefit"
                                />
                                <button type="button" onClick={() => removeArrayItem('benefits', index)}>
                                    Remove
                                </button>
                            </div>
                        ))}
                        <button type="button" onClick={() => addArrayItem('benefits')}>
                            Add Benefit
                        </button>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Experience Level</label>
                            <select
                                value={formData.experience_level}
                                onChange={(e) => setFormData({...formData, experience_level: e.target.value})}
                            >
                                <option value="">Select</option>
                                <option value="entry">Entry Level</option>
                                <option value="mid">Mid Level</option>
                                <option value="senior">Senior Level</option>
                                <option value="lead">Lead / Manager</option>
                                <option value="executive">Executive</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Education Required</label>
                            <input
                                type="text"
                                value={formData.education_required}
                                onChange={(e) => setFormData({...formData, education_required: e.target.value})}
                                placeholder="e.g., Bachelor's in Computer Science"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Application Deadline</label>
                        <input
                            type="date"
                            value={formData.application_deadline}
                            onChange={(e) => setFormData({...formData, application_deadline: e.target.value})}
                            min={format(new Date(), 'yyyy-MM-dd')}
                        />
                    </div>

                    <div className="modal-actions">
                        <button type="submit" className="btn btn-primary">
                            {job ? 'Update Job' : 'Create Job'}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default JobPostings;