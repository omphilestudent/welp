import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';
import {
    FaBriefcase,
    FaPlus,
    FaEdit,
    FaEye,
    FaTrash,
    FaCopy,
    FaShare,
    FaCalendarAlt,
    FaMapMarkerAlt,
    FaClock,
    FaUsers,
    FaFileAlt,
    FaCheckCircle,
    FaTimesCircle,
    FaFilter,
    FaSearch,
    FaDownload,
    FaPrint,
    FaEllipsisV,
    FaChartLine,
    FaBuilding,
    FaGlobe,
    FaDollarSign,
    FaLevelUpAlt,
    FaGraduationCap,
    FaRegClock
} from 'react-icons/fa';

const JobPostings = () => {
    const navigate = useNavigate();
    const [jobs, setJobs] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterDepartment, setFilterDepartment] = useState('all');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [selectedJobs, setSelectedJobs] = useState([]);
    const [viewMode, setViewMode] = useState('grid');
    const [stats, setStats] = useState({
        total: 0,
        open: 0,
        closed: 0,
        draft: 0,
        totalApplications: 0,
        avgApplications: 0
    });

    useEffect(() => {
        fetchJobs();
        fetchDepartments();
    }, []);

    const fetchJobs = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/hr/jobs');

            // Handle different response formats
            const jobsData = data.data || data.jobs || data;

            const normalizedJobs = (Array.isArray(jobsData) ? jobsData : []).map((job) => ({
                id: job.id,
                title: job.title || 'Untitled Position',
                department: job.department_name || job.department || 'Unassigned',
                department_id: job.department_id || null,
                location: job.location || 'Not specified',
                type: job.employment_type || job.type || 'full-time',
                experience: job.experience_level || job.experience || 'Not specified',
                salary_min: job.salary_min || null,
                salary_max: job.salary_max || null,
                salary_currency: job.salary_currency || 'USD',
                description: job.description || '',
                requirements: Array.isArray(job.requirements) ? job.requirements : [],
                responsibilities: Array.isArray(job.responsibilities) ? job.responsibilities : [],
                benefits: Array.isArray(job.benefits) ? job.benefits : [],
                skills: Array.isArray(job.skills_required) ? job.skills_required : [],
                applications: Number(job.applications_count || job.applications || 0),
                status: job.status || 'draft',
                postedDate: job.created_at ? new Date(job.created_at).toISOString() : new Date().toISOString(),
                deadline: job.application_deadline ? new Date(job.application_deadline).toISOString() : null,
                postedBy: job.posted_by_name || 'System',
                views: Number(job.views_count || 0),
                clicks: Number(job.clicks_count || 0),
                isRemote: job.is_remote || false,
                education: job.education_required || null
            }));

            setJobs(normalizedJobs);

            // Calculate stats
            const total = normalizedJobs.length;
            const open = normalizedJobs.filter(j => j.status === 'open').length;
            const closed = normalizedJobs.filter(j => j.status === 'closed').length;
            const draft = normalizedJobs.filter(j => j.status === 'draft').length;
            const totalApplications = normalizedJobs.reduce((sum, j) => sum + j.applications, 0);

            setStats({
                total,
                open,
                closed,
                draft,
                totalApplications,
                avgApplications: total > 0 ? Math.round(totalApplications / total) : 0
            });
        } catch (error) {
            console.error('Failed to fetch jobs:', error);
            toast.error('Failed to load job postings');
            setJobs([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchDepartments = async () => {
        try {
            const { data } = await api.get('/hr/departments');
            const deptData = data.data || data.departments || data;
            setDepartments(Array.isArray(deptData) ? deptData.map(d => d.name) : []);
        } catch (error) {
            console.error('Failed to fetch departments:', error);
            setDepartments([]);
        }
    };

    const handleCreateJob = () => {
        navigate('/hr/jobs/create');
    };

    const handleEditJob = (jobId) => {
        navigate(`/hr/jobs/${jobId}/edit`);
    };

    const handleViewJob = (jobId) => {
        navigate(`/hr/jobs/${jobId}`);
    };

    const handleDeleteJob = async (id) => {
        if (!window.confirm('Are you sure you want to delete this job posting?')) return;

        try {
            await api.delete(`/hr/jobs/${id}`);
            toast.success('Job deleted successfully');
            fetchJobs();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to delete job');
        }
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete ${selectedJobs.length} jobs?`)) return;

        try {
            await Promise.all(selectedJobs.map((jobId) => api.delete(`/hr/jobs/${jobId}`)));
            toast.success(`${selectedJobs.length} jobs deleted successfully`);
            setSelectedJobs([]);
            fetchJobs();
        } catch (error) {
            toast.error('Failed to delete some jobs');
        }
    };

    const handleDuplicate = async (job) => {
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
            fetchJobs();
        } catch (error) {
            toast.error('Failed to duplicate job');
        }
    };

    const handleShare = (job) => {
        const link = `${window.location.origin}/careers/jobs/${job.id}`;
        navigator.clipboard.writeText(link);
        toast.success('Job link copied to clipboard');
    };

    const handleStatusChange = async (jobId, newStatus) => {
        try {
            await api.patch(`/hr/jobs/${jobId}`, { status: newStatus });
            toast.success(`Job status updated to ${newStatus}`);
            fetchJobs();
        } catch (error) {
            toast.error('Failed to update job status');
        }
    };

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
    };

    const handleFilterStatus = (status) => {
        setFilterStatus(status);
    };

    const handleFilterDepartment = (dept) => {
        setFilterDepartment(dept);
    };

    const handleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    const handleSelectJob = (id) => {
        setSelectedJobs(prev =>
            prev.includes(id) ? prev.filter(jobId => jobId !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedJobs.length === filteredJobs.length) {
            setSelectedJobs([]);
        } else {
            setSelectedJobs(filteredJobs.map(job => job.id));
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            open: { bg: '#e6f7e6', color: '#38a169', icon: <FaCheckCircle />, label: 'Open' },
            closed: { bg: '#ffe6e6', color: '#f56565', icon: <FaTimesCircle />, label: 'Closed' },
            draft: { bg: '#e6e6e6', color: '#718096', icon: <FaClock />, label: 'Draft' }
        };
        return badges[status] || badges.draft;
    };

    const getTypeBadge = (type) => {
        const badges = {
            'full-time': { bg: '#e6f7ff', color: '#3182ce', label: 'Full Time' },
            'part-time': { bg: '#fff7e6', color: '#ed8936', label: 'Part Time' },
            'contract': { bg: '#f0e6ff', color: '#9f7aea', label: 'Contract' },
            'internship': { bg: '#e6ffe6', color: '#48bb78', label: 'Internship' },
            'remote': { bg: '#ffe6f7', color: '#f687b3', label: 'Remote' }
        };
        return badges[type] || badges['full-time'];
    };

    const formatSalary = (job) => {
        if (!job.salary_min && !job.salary_max) return 'Not disclosed';
        if (job.salary_min && job.salary_max) {
            return `${job.salary_currency} ${job.salary_min.toLocaleString()} - ${job.salary_max.toLocaleString()}`;
        }
        return job.salary_min ? `${job.salary_currency} ${job.salary_min.toLocaleString()}+` : 'Negotiable';
    };

    const filteredJobs = jobs
        .filter(job => {
            const matchesSearch =
                job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                job.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
                job.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (job.description && job.description.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesStatus = filterStatus === 'all' || job.status === filterStatus;
            const matchesDepartment = filterDepartment === 'all' || job.department === filterDepartment;

            return matchesSearch && matchesStatus && matchesDepartment;
        })
        .sort((a, b) => {
            let aVal = a[sortBy];
            let bVal = b[sortBy];

            if (sortBy === 'applications' || sortBy === 'views' || sortBy === 'clicks') {
                aVal = Number(aVal);
                bVal = Number(bVal);
            }

            if (sortBy === 'postedDate') {
                aVal = new Date(aVal).getTime();
                bVal = new Date(bVal).getTime();
            }

            if (sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

    if (loading) return <Loading />;

    return (
        <div className="job-postings-page">
            {/* Header */}
            <div className="page-header">
                <div className="header-left">
                    <h1>
                        <FaBriefcase className="header-icon" />
                        Job Postings
                    </h1>
                    <p className="header-description">
                        Manage and track all your job openings
                    </p>
                </div>
                <div className="header-actions">
                    <div className="view-toggle">
                        <button
                            className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                            onClick={() => setViewMode('grid')}
                        >
                            Grid
                        </button>
                        <button
                            className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                            onClick={() => setViewMode('table')}
                        >
                            Table
                        </button>
                    </div>
                    <button className="btn btn-primary" onClick={handleCreateJob}>
                        <FaPlus /> New Job
                    </button>
                    {selectedJobs.length > 0 && (
                        <button className="btn btn-danger" onClick={handleBulkDelete}>
                            <FaTrash /> Delete ({selectedJobs.length})
                        </button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="filters-section">
                <div className="search-box">
                    <FaSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search jobs by title, department, location..."
                        value={searchTerm}
                        onChange={handleSearch}
                    />
                </div>

                <div className="filter-group">
                    <select
                        value={filterStatus}
                        onChange={(e) => handleFilterStatus(e.target.value)}
                        className="filter-select"
                    >
                        <option value="all">All Status</option>
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                        <option value="draft">Draft</option>
                    </select>

                    <select
                        value={filterDepartment}
                        onChange={(e) => handleFilterDepartment(e.target.value)}
                        className="filter-select"
                    >
                        <option value="all">All Departments</option>
                        {departments.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </select>

                    <button className="btn btn-secondary" onClick={() => window.print()}>
                        <FaPrint /> Print
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: '#4299e120', color: '#4299e1' }}>
                        <FaBriefcase />
                    </div>
                    <div className="stat-content">
                        <h3>Total Jobs</h3>
                        <div className="stat-value">{stats.total}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: '#48bb7820', color: '#48bb78' }}>
                        <FaCheckCircle />
                    </div>
                    <div className="stat-content">
                        <h3>Open</h3>
                        <div className="stat-value">{stats.open}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: '#f5656520', color: '#f56565' }}>
                        <FaTimesCircle />
                    </div>
                    <div className="stat-content">
                        <h3>Closed</h3>
                        <div className="stat-value">{stats.closed}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: '#a0aec020', color: '#a0aec0' }}>
                        <FaClock />
                    </div>
                    <div className="stat-content">
                        <h3>Draft</h3>
                        <div className="stat-value">{stats.draft}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: '#9f7aea20', color: '#9f7aea' }}>
                        <FaUsers />
                    </div>
                    <div className="stat-content">
                        <h3>Total Applications</h3>
                        <div className="stat-value">{stats.totalApplications}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: '#f687b320', color: '#f687b3' }}>
                        <FaChartLine />
                    </div>
                    <div className="stat-content">
                        <h3>Avg. Applications/Job</h3>
                        <div className="stat-value">{stats.avgApplications}</div>
                    </div>
                </div>
            </div>

            {/* Bulk Actions */}
            {selectedJobs.length > 0 && (
                <div className="bulk-actions-bar">
                    <span>{selectedJobs.length} jobs selected</span>
                    <div className="bulk-actions-group">
                        <button className="btn-icon" onClick={() => {
                            selectedJobs.forEach(id => handleStatusChange(id, 'open'));
                        }} title="Mark as Open">
                            <FaCheckCircle />
                        </button>
                        <button className="btn-icon" onClick={() => {
                            selectedJobs.forEach(id => handleStatusChange(id, 'closed'));
                        }} title="Mark as Closed">
                            <FaTimesCircle />
                        </button>
                        <button className="btn-icon danger" onClick={handleBulkDelete} title="Delete Selected">
                            <FaTrash />
                        </button>
                    </div>
                </div>
            )}

            {/* Jobs Display */}
            {viewMode === 'grid' ? (
                <div className="jobs-grid">
                    {filteredJobs.map(job => {
                        const statusBadge = getStatusBadge(job.status);
                        const typeBadge = getTypeBadge(job.type);
                        return (
                            <div key={job.id} className={`job-card ${selectedJobs.includes(job.id) ? 'selected' : ''}`}>
                                <div className="job-card-header">
                                    <div className="job-title-section">
                                        <input
                                            type="checkbox"
                                            checked={selectedJobs.includes(job.id)}
                                            onChange={() => handleSelectJob(job.id)}
                                            className="job-checkbox"
                                        />
                                        <h3 onClick={() => handleViewJob(job.id)} style={{ cursor: 'pointer' }}>
                                            {job.title}
                                        </h3>
                                    </div>
                                    <div className="job-actions">
                                        <button className="btn-icon" onClick={() => handleDuplicate(job)} title="Duplicate">
                                            <FaCopy />
                                        </button>
                                        <button className="btn-icon" onClick={() => handleShare(job)} title="Share">
                                            <FaShare />
                                        </button>
                                        <button className="btn-icon" onClick={() => handleEditJob(job.id)} title="Edit">
                                            <FaEdit />
                                        </button>
                                        <button className="btn-icon danger" onClick={() => handleDeleteJob(job.id)} title="Delete">
                                            <FaTrash />
                                        </button>
                                    </div>
                                </div>

                                <div className="job-meta-tags">
                                    <span className="job-department">
                                        <FaBuilding /> {job.department}
                                    </span>
                                    <span className="job-location">
                                        <FaMapMarkerAlt /> {job.location} {job.isRemote && '🌍'}
                                    </span>
                                    <span className="job-type" style={{ backgroundColor: typeBadge.bg, color: typeBadge.color }}>
                                        {typeBadge.label}
                                    </span>
                                </div>

                                <div className="job-salary-info">
                                    <FaDollarSign /> {formatSalary(job)}
                                </div>

                                <div className="job-description-preview">
                                    <p>{job.description.substring(0, 150)}...</p>
                                </div>

                                <div className="job-requirements-preview">
                                    {job.skills.slice(0, 4).map((skill, i) => (
                                        <span key={i} className="skill-tag">{skill}</span>
                                    ))}
                                    {job.skills.length > 4 && (
                                        <span className="skill-tag">+{job.skills.length - 4}</span>
                                    )}
                                </div>

                                <div className="job-stats-row">
                                    <div className="stat-item">
                                        <FaUsers /> {job.applications} Applicants
                                    </div>
                                    <div className="stat-item">
                                        <FaRegClock /> Posted: {new Date(job.postedDate).toLocaleDateString()}
                                    </div>
                                    {job.deadline && (
                                        <div className="stat-item">
                                            <FaCalendarAlt /> Deadline: {new Date(job.deadline).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>

                                <div className="job-card-footer">
                                    <span className="status-badge" style={{ backgroundColor: statusBadge.bg, color: statusBadge.color }}>
                                        {statusBadge.icon} {statusBadge.label}
                                    </span>
                                    <div className="status-actions">
                                        {job.status !== 'open' && (
                                            <button onClick={() => handleStatusChange(job.id, 'open')} className="btn-small">
                                                Publish
                                            </button>
                                        )}
                                        {job.status === 'open' && (
                                            <button onClick={() => handleStatusChange(job.id, 'closed')} className="btn-small">
                                                Close
                                            </button>
                                        )}
                                        <button onClick={() => handleViewJob(job.id)} className="btn-small btn-primary">
                                            View
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                        <tr>
                            <th style={{ width: '30px' }}>
                                <input
                                    type="checkbox"
                                    checked={selectedJobs.length === filteredJobs.length && filteredJobs.length > 0}
                                    onChange={handleSelectAll}
                                />
                            </th>
                            <th onClick={() => handleSort('title')}>
                                Job Title {sortBy === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th onClick={() => handleSort('department')}>
                                Department {sortBy === 'department' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th onClick={() => handleSort('location')}>
                                Location {sortBy === 'location' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th>Type</th>
                            <th onClick={() => handleSort('applications')}>
                                Apps {sortBy === 'applications' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th onClick={() => handleSort('status')}>
                                Status
                            </th>
                            <th onClick={() => handleSort('postedDate')}>
                                Posted {sortBy === 'postedDate' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th>Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {filteredJobs.map(job => {
                            const statusBadge = getStatusBadge(job.status);
                            const typeBadge = getTypeBadge(job.type);
                            return (
                                <tr key={job.id} className={selectedJobs.includes(job.id) ? 'selected' : ''}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={selectedJobs.includes(job.id)}
                                            onChange={() => handleSelectJob(job.id)}
                                        />
                                    </td>
                                    <td>
                                            <span className="job-link" onClick={() => handleViewJob(job.id)} style={{ cursor: 'pointer' }}>
                                                {job.title}
                                            </span>
                                    </td>
                                    <td>{job.department}</td>
                                    <td>{job.location} {job.isRemote && '🌍'}</td>
                                    <td>
                                            <span className="type-badge" style={{ backgroundColor: typeBadge.bg, color: typeBadge.color }}>
                                                {typeBadge.label}
                                            </span>
                                    </td>
                                    <td>{job.applications}</td>
                                    <td>
                                            <span className="status-badge" style={{ backgroundColor: statusBadge.bg, color: statusBadge.color }}>
                                                {statusBadge.icon} {statusBadge.label}
                                            </span>
                                    </td>
                                    <td>{new Date(job.postedDate).toLocaleDateString()}</td>
                                    <td>
                                        <div className="action-buttons">
                                            <button className="btn-icon" onClick={() => handleViewJob(job.id)} title="View">
                                                <FaEye />
                                            </button>
                                            <button className="btn-icon" onClick={() => handleEditJob(job.id)} title="Edit">
                                                <FaEdit />
                                            </button>
                                            <button className="btn-icon" onClick={() => handleDuplicate(job)} title="Duplicate">
                                                <FaCopy />
                                            </button>
                                            <button className="btn-icon danger" onClick={() => handleDeleteJob(job.id)} title="Delete">
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>

                    {filteredJobs.length === 0 && (
                        <div className="empty-state">
                            <FaBriefcase size={48} />
                            <h3>No jobs found</h3>
                            <p>Try adjusting your search or filter criteria, or create a new job posting</p>
                            <button className="btn btn-primary" onClick={handleCreateJob}>
                                <FaPlus /> Create New Job
                            </button>
                        </div>
                    )}
                </div>
            )}

            <style>{`
                .job-postings-page {
                    padding: 2rem;
                    max-width: 1600px;
                    margin: 0 auto;
                }

                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }

                .header-left h1 {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    color: #2d3748;
                    font-size: 2rem;
                    margin-bottom: 0.5rem;
                }

                .header-icon {
                    color: #4299e1;
                }

                .header-description {
                    color: #718096;
                }

                .header-actions {
                    display: flex;
                    gap: 1rem;
                    align-items: center;
                }

                .view-toggle {
                    display: flex;
                    gap: 0.5rem;
                    background: #f7fafc;
                    padding: 0.25rem;
                    border-radius: 8px;
                }

                .toggle-btn {
                    padding: 0.5rem 1rem;
                    border: none;
                    background: transparent;
                    border-radius: 6px;
                    color: #718096;
                    cursor: pointer;
                    transition: all 0.3s;
                }

                .toggle-btn.active {
                    background: white;
                    color: #4299e1;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                .filters-section {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 2rem;
                    flex-wrap: wrap;
                }

                .search-box {
                    flex: 1;
                    position: relative;
                    min-width: 300px;
                }

                .search-icon {
                    position: absolute;
                    left: 1rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #a0aec0;
                }

                .search-box input {
                    width: 100%;
                    padding: 0.75rem 1rem 0.75rem 2.5rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 0.95rem;
                }

                .filter-group {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }

                .filter-select {
                    padding: 0.75rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    background: white;
                    min-width: 150px;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                    margin-bottom: 2rem;
                }

                .stat-card {
                    background: white;
                    border-radius: 12px;
                    padding: 1.5rem;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }

                .stat-icon {
                    width: 50px;
                    height: 50px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                }

                .stat-content h3 {
                    color: #718096;
                    font-size: 0.85rem;
                    margin-bottom: 0.25rem;
                }

                .stat-value {
                    color: #2d3748;
                    font-size: 1.5rem;
                    font-weight: 700;
                }

                .bulk-actions-bar {
                    background: #4299e1;
                    color: white;
                    padding: 1rem;
                    border-radius: 8px;
                    margin-bottom: 1rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .bulk-actions-group {
                    display: flex;
                    gap: 0.5rem;
                }

                .jobs-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(450px, 1fr));
                    gap: 1.5rem;
                }

                .job-card {
                    background: white;
                    border-radius: 12px;
                    padding: 1.5rem;
                    border: 1px solid #e2e8f0;
                    transition: all 0.3s;
                }

                .job-card:hover {
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                    transform: translateY(-4px);
                }

                .job-card.selected {
                    border-color: #4299e1;
                    box-shadow: 0 0 0 2px rgba(66,153,225,0.2);
                }

                .job-card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 1rem;
                }

                .job-title-section {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    flex: 1;
                }

                .job-checkbox {
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                }

                .job-title-section h3 {
                    margin: 0;
                    color: #2d3748;
                }

                .job-actions {
                    display: flex;
                    gap: 0.25rem;
                }

                .job-meta-tags {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1rem;
                    flex-wrap: wrap;
                }

                .job-meta-tags span {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.9rem;
                    color: #718096;
                }

                .job-salary-info {
                    background: #f7fafc;
                    padding: 0.75rem;
                    border-radius: 6px;
                    margin-bottom: 1rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: #48bb78;
                    font-weight: 600;
                }

                .job-description-preview {
                    color: #4a5568;
                    margin-bottom: 1rem;
                    line-height: 1.6;
                }

                .job-requirements-preview {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                    margin-bottom: 1rem;
                }

                .skill-tag {
                    padding: 0.25rem 0.75rem;
                    background: #f7fafc;
                    color: #4a5568;
                    border-radius: 30px;
                    font-size: 0.8rem;
                }

                .job-stats-row {
                    display: flex;
                    gap: 1.5rem;
                    margin-bottom: 1rem;
                    padding: 0.75rem 0;
                    border-top: 1px solid #e2e8f0;
                    border-bottom: 1px solid #e2e8f0;
                    font-size: 0.9rem;
                    color: #718096;
                }

                .stat-item {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }

                .job-card-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.25rem 0.75rem;
                    border-radius: 30px;
                    font-size: 0.85rem;
                }

                .status-actions {
                    display: flex;
                    gap: 0.5rem;
                }

                .btn-small {
                    padding: 0.25rem 0.75rem;
                    border: 1px solid #e2e8f0;
                    background: white;
                    border-radius: 4px;
                    font-size: 0.85rem;
                    cursor: pointer;
                }

                .btn-small.btn-primary {
                    background: #4299e1;
                    color: white;
                    border: none;
                }

                .table-container {
                    background: white;
                    border-radius: 12px;
                    overflow-x: auto;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }

                .data-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .data-table th {
                    padding: 1rem;
                    text-align: left;
                    color: #718096;
                    font-weight: 600;
                    font-size: 0.85rem;
                    border-bottom: 2px solid #e2e8f0;
                    cursor: pointer;
                }

                .data-table th:hover {
                    color: #4299e1;
                }

                .data-table td {
                    padding: 1rem;
                    border-bottom: 1px solid #e2e8f0;
                    color: #2d3748;
                }

                .data-table tr.selected {
                    background: #f0f9ff;
                }

                .job-link {
                    color: #4299e1;
                    text-decoration: none;
                    font-weight: 500;
                }

                .type-badge {
                    padding: 0.25rem 0.75rem;
                    border-radius: 30px;
                    font-size: 0.8rem;
                    font-weight: 500;
                }

                .btn-icon {
                    width: 32px;
                    height: 32px;
                    border-radius: 6px;
                    border: none;
                    background: #f7fafc;
                    color: #718096;
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

                .btn-primary {
                    background: #4299e1;
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    text-decoration: none;
                }

                .btn-primary:hover {
                    background: #3182ce;
                }

                .btn-secondary {
                    background: white;
                    color: #4a5568;
                    border: 1px solid #e2e8f0;
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .btn-secondary:hover {
                    background: #f7fafc;
                }

                .btn-danger {
                    background: #f56565;
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .btn-danger:hover {
                    background: #e53e3e;
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
                    margin-bottom: 1.5rem;
                }

                @media (max-width: 768px) {
                    .page-header {
                        flex-direction: column;
                        gap: 1rem;
                    }

                    .filters-section {
                        flex-direction: column;
                    }

                    .search-box {
                        min-width: 100%;
                    }

                    .filter-group {
                        width: 100%;
                    }

                    .filter-select {
                        flex: 1;
                    }

                    .stats-grid {
                        grid-template-columns: 1fr;
                    }

                    .jobs-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
};

export default JobPostings;