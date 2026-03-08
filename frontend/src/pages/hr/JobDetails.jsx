// src/pages/hr/JobDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';
import {
    FaBriefcase,
    FaEdit,
    FaTrash,
    FaCopy,
    FaShare,
    FaCalendarAlt,
    FaMapMarkerAlt,
    FaClock,
    FaUsers,
    FaCheckCircle,
    FaTimesCircle,
    FaBuilding,
    FaDollarSign,
    FaLevelUpAlt,
    FaGraduationCap,
    FaGlobe,
    FaRegClock,
    FaArrowLeft,
    FaPrint,
    FaDownload,
    FaEnvelope
} from 'react-icons/fa';

const JobDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [job, setJob] = useState(null);
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('details');

    useEffect(() => {
        fetchJobDetails();
        fetchApplications();
    }, [id]);

    const fetchJobDetails = async () => {
        try {
            const { data } = await api.get(`/hr/jobs/${id}`);
            const jobData = data.data || data;

            setJob({
                id: jobData.id,
                title: jobData.title || 'Untitled Position',
                department: jobData.department_name || jobData.department || 'Unassigned',
                department_id: jobData.department_id || null,
                location: jobData.location || 'Not specified',
                type: jobData.employment_type || jobData.type || 'full-time',
                experience: jobData.experience_level || jobData.experience || 'Not specified',
                salary_min: jobData.salary_min || null,
                salary_max: jobData.salary_max || null,
                salary_currency: jobData.salary_currency || 'USD',
                description: jobData.description || '',
                requirements: Array.isArray(jobData.requirements) ? jobData.requirements : [],
                responsibilities: Array.isArray(jobData.responsibilities) ? jobData.responsibilities : [],
                benefits: Array.isArray(jobData.benefits) ? jobData.benefits : [],
                skills: Array.isArray(jobData.skills_required) ? jobData.skills_required : [],
                status: jobData.status || 'draft',
                postedDate: jobData.created_at ? new Date(jobData.created_at).toLocaleDateString() : '-',
                deadline: jobData.application_deadline ? new Date(jobData.application_deadline).toLocaleDateString() : null,
                postedBy: jobData.posted_by_name || 'System',
                isRemote: jobData.is_remote || false,
                education: jobData.education_required || null,
                views: jobData.views_count || 0,
                clicks: jobData.clicks_count || 0
            });
        } catch (error) {
            console.error('Failed to fetch job details:', error);
            toast.error('Failed to load job details');
            navigate('/hr/jobs');
        }
    };

    const fetchApplications = async () => {
        try {
            const { data } = await api.get(`/hr/jobs/${id}/applications`);
            const appsData = data.data || data.applications || data;
            setApplications(Array.isArray(appsData) ? appsData : []);
        } catch (error) {
            console.error('Failed to fetch applications:', error);
            setApplications([]);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (newStatus) => {
        try {
            await api.patch(`/hr/jobs/${id}`, { status: newStatus });
            toast.success(`Job status updated to ${newStatus}`);
            fetchJobDetails();
        } catch (error) {
            toast.error('Failed to update job status');
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this job posting?')) return;

        try {
            await api.delete(`/hr/jobs/${id}`);
            toast.success('Job deleted successfully');
            navigate('/hr/jobs');
        } catch (error) {
            toast.error('Failed to delete job');
        }
    };

    const handleDuplicate = async () => {
        try {
            const jobData = {
                title: `${job.title} (Copy)`,
                department_id: job.department_id,
                employment_type: job.type,
                location: job.location,
                salary_min: job.salary_min,
                salary_max: job.salary_max,
                salary_currency: job.salary_currency,
                description: job.description,
                requirements: job.requirements,
                responsibilities: job.responsibilities,
                benefits: job.benefits,
                skills_required: job.skills,
                experience_level: job.experience,
                education_required: job.education,
                is_remote: job.isRemote,
                status: 'draft'
            };

            await api.post('/hr/jobs', jobData);
            toast.success('Job duplicated successfully');
            navigate('/hr/jobs');
        } catch (error) {
            toast.error('Failed to duplicate job');
        }
    };

    const handleShare = () => {
        const link = `${window.location.origin}/careers/jobs/${id}`;
        navigator.clipboard.writeText(link);
        toast.success('Job link copied to clipboard');
    };

    const getStatusBadge = (status) => {
        const badges = {
            open: { bg: '#e6f7e6', color: '#38a169', icon: <FaCheckCircle />, label: 'Open' },
            closed: { bg: '#ffe6e6', color: '#f56565', icon: <FaTimesCircle />, label: 'Closed' },
            draft: { bg: '#e6e6e6', color: '#718096', icon: <FaClock />, label: 'Draft' }
        };
        return badges[status] || badges.draft;
    };

    const formatSalary = () => {
        if (!job.salary_min && !job.salary_max) return 'Not disclosed';
        if (job.salary_min && job.salary_max) {
            return `${job.salary_currency} ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}`;
        }
        return job.salary_min ? `${job.salary_currency} ${job.salary_min.toLocaleString()}+` : 'Negotiable';
    };

    if (loading) return <Loading />;
    if (!job) return null;

    const statusBadge = getStatusBadge(job.status);

    return (
        <div className="job-details-page">
            {/* Header */}
            <div className="page-header">
                <div className="header-left">
                    <button className="back-button" onClick={() => navigate('/hr/jobs')}>
                        <FaArrowLeft /> Back to Jobs
                    </button>
                    <h1>
                        <FaBriefcase className="header-icon" />
                        {job.title}
                    </h1>
                </div>
                <div className="header-actions">
                    <span className="status-badge" style={{ backgroundColor: statusBadge.bg, color: statusBadge.color }}>
                        {statusBadge.icon} {statusBadge.label}
                    </span>
                    <button className="btn-icon" onClick={handleShare} title="Share">
                        <FaShare />
                    </button>
                    <button className="btn-icon" onClick={() => window.print()} title="Print">
                        <FaPrint />
                    </button>
                    <button className="btn-icon" onClick={handleDuplicate} title="Duplicate">
                        <FaCopy />
                    </button>
                    <Link to={`/hr/jobs/${id}/edit`} className="btn-icon" title="Edit">
                        <FaEdit />
                    </Link>
                    <button className="btn-icon danger" onClick={handleDelete} title="Delete">
                        <FaTrash />
                    </button>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions">
                {job.status !== 'open' && (
                    <button className="btn btn-success" onClick={() => handleStatusChange('open')}>
                        <FaCheckCircle /> Publish Job
                    </button>
                )}
                {job.status === 'open' && (
                    <button className="btn btn-warning" onClick={() => handleStatusChange('closed')}>
                        <FaTimesCircle /> Close Job
                    </button>
                )}
                <Link to={`/hr/jobs/${id}/applications`} className="btn btn-primary">
                    <FaUsers /> View Applications ({applications.length})
                </Link>
                <button className="btn btn-secondary">
                    <FaEnvelope /> Contact Candidates
                </button>
            </div>

            {/* Tabs */}
            <div className="details-tabs">
                <button
                    className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
                    onClick={() => setActiveTab('details')}
                >
                    Job Details
                </button>
                <button
                    className={`tab-btn ${activeTab === 'applications' ? 'active' : ''}`}
                    onClick={() => setActiveTab('applications')}
                >
                    Applications ({applications.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                    onClick={() => setActiveTab('analytics')}
                >
                    Analytics
                </button>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {activeTab === 'details' && (
                    <div className="job-details">
                        {/* Key Info Cards */}
                        <div className="info-cards">
                            <div className="info-card">
                                <FaBuilding className="info-icon" />
                                <div>
                                    <label>Department</label>
                                    <span>{job.department}</span>
                                </div>
                            </div>
                            <div className="info-card">
                                <FaMapMarkerAlt className="info-icon" />
                                <div>
                                    <label>Location</label>
                                    <span>{job.location} {job.isRemote && '🌍'}</span>
                                </div>
                            </div>
                            <div className="info-card">
                                <FaClock className="info-icon" />
                                <div>
                                    <label>Employment Type</label>
                                    <span className="type-badge">{job.type}</span>
                                </div>
                            </div>
                            <div className="info-card">
                                <FaLevelUpAlt className="info-icon" />
                                <div>
                                    <label>Experience Level</label>
                                    <span>{job.experience}</span>
                                </div>
                            </div>
                            <div className="info-card">
                                <FaDollarSign className="info-icon" />
                                <div>
                                    <label>Salary</label>
                                    <span className="salary">{formatSalary()}</span>
                                </div>
                            </div>
                            <div className="info-card">
                                <FaRegClock className="info-icon" />
                                <div>
                                    <label>Posted Date</label>
                                    <span>{job.postedDate}</span>
                                </div>
                            </div>
                            {job.deadline && (
                                <div className="info-card">
                                    <FaCalendarAlt className="info-icon" />
                                    <div>
                                        <label>Application Deadline</label>
                                        <span>{job.deadline}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        <div className="detail-section">
                            <h2>Job Description</h2>
                            <div className="description-content">
                                {job.description.split('\n').map((paragraph, i) => (
                                    <p key={i}>{paragraph}</p>
                                ))}
                            </div>
                        </div>

                        {/* Requirements */}
                        {job.requirements.length > 0 && (
                            <div className="detail-section">
                                <h2>Requirements</h2>
                                <ul className="requirements-list">
                                    {job.requirements.map((req, i) => (
                                        <li key={i}>{req}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Responsibilities */}
                        {job.responsibilities.length > 0 && (
                            <div className="detail-section">
                                <h2>Responsibilities</h2>
                                <ul className="responsibilities-list">
                                    {job.responsibilities.map((resp, i) => (
                                        <li key={i}>{resp}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Skills */}
                        {job.skills.length > 0 && (
                            <div className="detail-section">
                                <h2>Required Skills</h2>
                                <div className="skills-grid">
                                    {job.skills.map((skill, i) => (
                                        <span key={i} className="skill-tag">{skill}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Benefits */}
                        {job.benefits.length > 0 && (
                            <div className="detail-section">
                                <h2>Benefits</h2>
                                <ul className="benefits-list">
                                    {job.benefits.map((benefit, i) => (
                                        <li key={i}>{benefit}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'applications' && (
                    <div className="applications-tab">
                        <div className="applications-header">
                            <h2>Applications ({applications.length})</h2>
                            <button className="btn btn-secondary">
                                <FaDownload /> Export
                            </button>
                        </div>

                        {applications.length === 0 ? (
                            <div className="empty-state">
                                <FaUsers size={48} />
                                <h3>No applications yet</h3>
                                <p>Applications will appear here when candidates apply</p>
                            </div>
                        ) : (
                            <div className="applications-table">
                                <table>
                                    <thead>
                                    <tr>
                                        <th>Applicant</th>
                                        <th>Applied Date</th>
                                        <th>Status</th>
                                        <th>Resume</th>
                                        <th>Actions</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {applications.map(app => (
                                        <tr key={app.id}>
                                            <td>
                                                <div className="applicant-info">
                                                    <div className="applicant-avatar">
                                                        {app.first_name?.[0]}{app.last_name?.[0]}
                                                    </div>
                                                    <div>
                                                        <div>{app.first_name} {app.last_name}</div>
                                                        <small>{app.email}</small>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{new Date(app.created_at).toLocaleDateString()}</td>
                                            <td>
                                                    <span className={`status-badge ${app.status}`}>
                                                        {app.status}
                                                    </span>
                                            </td>
                                            <td>
                                                {app.resume_url && (
                                                    <a href={app.resume_url} target="_blank" rel="noopener noreferrer">
                                                        View Resume
                                                    </a>
                                                )}
                                            </td>
                                            <td>
                                                <button className="btn-icon">
                                                    <FaEye />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'analytics' && (
                    <div className="analytics-tab">
                        <h2>Job Performance Analytics</h2>
                        <div className="analytics-grid">
                            <div className="analytics-card">
                                <h3>Views</h3>
                                <div className="analytics-value">{job.views || 0}</div>
                            </div>
                            <div className="analytics-card">
                                <h3>Clicks</h3>
                                <div className="analytics-value">{job.clicks || 0}</div>
                            </div>
                            <div className="analytics-card">
                                <h3>Applications</h3>
                                <div className="analytics-value">{applications.length}</div>
                            </div>
                            <div className="analytics-card">
                                <h3>Conversion Rate</h3>
                                <div className="analytics-value">
                                    {job.views ? ((applications.length / job.views) * 100).toFixed(1) : 0}%
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .job-details-page {
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
                    gap: 0.5rem;
                    align-items: center;
                }

                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.5rem 1rem;
                    border-radius: 30px;
                    font-size: 0.9rem;
                    font-weight: 500;
                }

                .btn-icon {
                    width: 36px;
                    height: 36px;
                    border-radius: 8px;
                    border: none;
                    background: #f7fafc;
                    color: #4a5568;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s;
                }

                .btn-icon:hover {
                    background: #4299e1;
                    color: white;
                }

                .btn-icon.danger:hover {
                    background: #f56565;
                }

                .quick-actions {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 2rem;
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
                    text-decoration: none;
                }

                .btn-primary {
                    background: #4299e1;
                    color: white;
                }

                .btn-success {
                    background: #48bb78;
                    color: white;
                }

                .btn-warning {
                    background: #ed8936;
                    color: white;
                }

                .btn-secondary {
                    background: white;
                    color: #4a5568;
                    border: 1px solid #e2e8f0;
                }

                .details-tabs {
                    display: flex;
                    gap: 0.5rem;
                    border-bottom: 2px solid #e2e8f0;
                    margin-bottom: 2rem;
                }

                .tab-btn {
                    padding: 0.75rem 1.5rem;
                    background: none;
                    border: none;
                    color: #718096;
                    cursor: pointer;
                    font-weight: 500;
                    position: relative;
                }

                .tab-btn.active {
                    color: #4299e1;
                }

                .tab-btn.active::after {
                    content: '';
                    position: absolute;
                    bottom: -2px;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: #4299e1;
                }

                .info-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1rem;
                    margin-bottom: 2rem;
                }

                .info-card {
                    background: #f7fafc;
                    padding: 1rem;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .info-icon {
                    font-size: 1.5rem;
                    color: #4299e1;
                }

                .info-card label {
                    display: block;
                    color: #718096;
                    font-size: 0.85rem;
                    margin-bottom: 0.25rem;
                }

                .info-card span {
                    color: #2d3748;
                    font-weight: 500;
                }

                .type-badge {
                    text-transform: capitalize;
                }

                .salary {
                    color: #48bb78;
                }

                .detail-section {
                    margin-bottom: 2rem;
                }

                .detail-section h2 {
                    color: #2d3748;
                    font-size: 1.25rem;
                    margin-bottom: 1rem;
                }

                .description-content {
                    line-height: 1.8;
                    color: #4a5568;
                }

                .requirements-list,
                .responsibilities-list,
                .benefits-list {
                    list-style: none;
                    padding: 0;
                }

                .requirements-list li,
                .responsibilities-list li,
                .benefits-list li {
                    padding: 0.5rem 0;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .requirements-list li::before,
                .responsibilities-list li::before,
                .benefits-list li::before {
                    content: '•';
                    color: #4299e1;
                    font-weight: bold;
                }

                .skills-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                }

                .skill-tag {
                    padding: 0.5rem 1rem;
                    background: #e6f7ff;
                    color: #3182ce;
                    border-radius: 30px;
                    font-size: 0.9rem;
                }

                .applications-table {
                    overflow-x: auto;
                }

                .applications-table table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .applications-table th {
                    text-align: left;
                    padding: 1rem;
                    color: #718096;
                    font-weight: 600;
                    border-bottom: 2px solid #e2e8f0;
                }

                .applications-table td {
                    padding: 1rem;
                    border-bottom: 1px solid #e2e8f0;
                }

                .applicant-info {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .applicant-avatar {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                }

                .analytics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                }

                .analytics-card {
                    background: #f7fafc;
                    padding: 1.5rem;
                    border-radius: 8px;
                    text-align: center;
                }

                .analytics-card h3 {
                    color: #718096;
                    font-size: 0.9rem;
                    margin-bottom: 0.5rem;
                }

                .analytics-value {
                    color: #2d3748;
                    font-size: 2rem;
                    font-weight: 700;
                }

                .empty-state {
                    text-align: center;
                    padding: 4rem 2rem;
                }

                .empty-state svg {
                    color: #cbd5e0;
                    margin-bottom: 1rem;
                }

                .empty-state h3 {
                    color: #2d3748;
                    margin-bottom: 0.5rem;
                }

                .empty-state p {
                    color: #a0aec0;
                }

                @media (max-width: 768px) {
                    .page-header {
                        flex-direction: column;
                        gap: 1rem;
                        align-items: flex-start;
                    }

                    .quick-actions {
                        flex-direction: column;
                    }

                    .info-cards {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
};

export default JobDetails;