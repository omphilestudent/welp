
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
    FaGlobe
} from 'react-icons/fa';

const JobPostings = () => {
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

    useEffect(() => {
        fetchJobs();
        fetchDepartments();
    }, []);

    const fetchJobs = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/hr/jobs');
            const normalizedJobs = (data || []).map((job) => ({
                id: job.id,
                title: job.title,
                department: job.department_name || 'Unassigned',
                department_id: job.department_id || null,
                location: job.location || 'Not specified',
                type: job.employment_type || 'full-time',
                experience: job.experience_level || 'N/A',
                salary: job.salary_min && job.salary_max
                    ? `$${job.salary_min} - $${job.salary_max}`
                    : 'Not disclosed',
                description: job.description || '',
                requirements: Array.isArray(job.requirements) ? job.requirements : [],
                benefits: Array.isArray(job.benefits) ? job.benefits : [],
                applications: Number(job.applications_count || 0),
                status: job.status || 'draft',
                postedDate: job.created_at ? new Date(job.created_at).toLocaleDateString() : '-',
                deadline: job.application_deadline ? new Date(job.application_deadline).toLocaleDateString() : '-',
                postedBy: job.posted_by_name || 'Unknown',
                views: Number(job.views_count || 0),
                clicks: Number(job.clicks_count || 0)
            }));

            setJobs(normalizedJobs);
        } catch (error) {
            console.error('Failed to fetch jobs:', error);
            toast.error('Failed to load job postings');
        } finally {
            setLoading(false);
        }
    };

    const fetchDepartments = async () => {
        try {
            const { data } = await api.get('/hr/departments');
            setDepartments((data || []).map((department) => department.name));
        } catch (error) {
            console.error('Failed to fetch departments:', error);
            setDepartments([]);
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

    const handleDeleteJob = async (id) => {
        if (!window.confirm('Are you sure you want to delete this job posting?')) return;

        try {
            await api.delete(`/hr/jobs/${id}`);
            toast.success('Job deleted successfully');
            fetchJobs();
        } catch (error) {
            toast.error('Failed to delete job');
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
            toast.error('Failed to delete jobs');
        }
    };

    const handleDuplicate = async (job) => {
        try {
            await api.post('/hr/jobs', {
                title: `${job.title} (Copy)`,
                department_id: job.department_id,
                employment_type: job.type,
                location: job.location,
                salary_min: null,
                salary_max: null,
                salary_currency: 'USD',
                description: job.description,
                requirements: job.requirements || [],
                responsibilities: [],
                benefits: job.benefits || [],
                skills_required: [],
                experience_level: job.experience || null,
                education_required: null,
                application_deadline: null
            });
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


    const filteredJobs = jobs
        .filter(job => {
            const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                job.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
                job.location.toLowerCase().includes(searchTerm.toLowerCase());
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

            if (sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

    if (loading) return <Loading />;

    return (
        <div className="job-postings-page">
            {}
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
                    <Link to="/hr/jobs/new" className="btn btn-primary">
                        <FaPlus /> New Job
                    </Link>
                    {selectedJobs.length > 0 && (
                        <button className="btn btn-danger" onClick={handleBulkDelete}>
                            <FaTrash /> Delete ({selectedJobs.length})
                        </button>
                    )}
                </div>
            </div>

            {}
            <div className="filters-section">
                <div className="search-box">
                    <FaSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search jobs by title, department, or location..."
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

                    <button className="btn btn-secondary">
                        <FaDownload /> Export
                    </button>
                </div>
            </div>

            {}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: '#4299e120', color: '#4299e1' }}>
                        <FaBriefcase />
                    </div>
                    <div className="stat-content">
                        <h3>Total Jobs</h3>
                        <div className="stat-value">{jobs.length}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: '#48bb7820', color: '#48bb78' }}>
                        <FaCheckCircle />
                    </div>
                    <div className="stat-content">
                        <h3>Open</h3>
                        <div className="stat-value">{jobs.filter(j => j.status === 'open').length}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: '#f5656520', color: '#f56565' }}>
                        <FaTimesCircle />
                    </div>
                    <div className="stat-content">
                        <h3>Closed</h3>
                        <div className="stat-value">{jobs.filter(j => j.status === 'closed').length}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: '#a0aec020', color: '#a0aec0' }}>
                        <FaClock />
                    </div>
                    <div className="stat-content">
                        <h3>Draft</h3>
                        <div className="stat-value">{jobs.filter(j => j.status === 'draft').length}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: '#9f7aea20', color: '#9f7aea' }}>
                        <FaUsers />
                    </div>
                    <div className="stat-content">
                        <h3>Total Applications</h3>
                        <div className="stat-value">
                            {jobs.reduce((sum, job) => sum + (job.applications || 0), 0)}
                        </div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: '#f687b320', color: '#f687b3' }}>
                        <FaChartLine />
                    </div>
                    <div className="stat-content">
                        <h3>Avg. Applications/Job</h3>
                        <div className="stat-value">
                            {Math.round(jobs.reduce((sum, job) => sum + (job.applications || 0), 0) / jobs.length)}
                        </div>
                    </div>
                </div>
            </div>

            {}
            {selectedJobs.length > 0 && (
                <div className="bulk-actions">
                    <span>{selectedJobs.length} jobs selected</span>
                    <button className="btn-icon" onClick={handleBulkDelete} title="Delete Selected">
                        <FaTrash />
                    </button>
                </div>
            )}

            {}
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
                                        <h3>
                                            <Link to={`/hr/jobs/${job.id}`}>{job.title}</Link>
                                        </h3>
                                    </div>
                                    <div className="job-actions">
                                        <button className="btn-icon" onClick={() => handleDuplicate(job)} title="Duplicate">
                                            <FaCopy />
                                        </button>
                                        <button className="btn-icon" onClick={() => handleShare(job)} title="Share">
                                            <FaShare />
                                        </button>
                                        <Link to={`/hr/jobs/${job.id}/edit`} className="btn-icon" title="Edit">
                                            <FaEdit />
                                        </Link>
                                        <button className="btn-icon danger" onClick={() => handleDeleteJob(job.id)} title="Delete">
                                            <FaTrash />
                                        </button>
                                    </div>
                                </div>

                                <div className="job-meta">
                                    <span className="job-department">
                                        <FaBuilding /> {job.department}
                                    </span>
                                    <span className="job-location">
                                        <FaMapMarkerAlt /> {job.location}
                                    </span>
                                    <span className="job-type" style={{ backgroundColor: typeBadge.bg, color: typeBadge.color }}>
                                        {typeBadge.label}
                                    </span>
                                </div>

                                <div className="job-description">
                                    <p>{job.description.substring(0, 150)}...</p>
                                </div>

                                <div className="job-requirements">
                                    <strong>Key Requirements:</strong>
                                    <div className="requirement-tags">
                                        {job.requirements.slice(0, 3).map((req, i) => (
                                            <span key={i} className="requirement-tag">{req}</span>
                                        ))}
                                        {job.requirements.length > 3 && (
                                            <span className="requirement-tag">+{job.requirements.length - 3}</span>
                                        )}
                                    </div>
                                </div>

                                <div className="job-stats">
                                    <div className="stat-item">
                                        <FaUsers /> {job.applications} Applications
                                    </div>
                                    <div className="stat-item">
                                        <FaCalendarAlt /> Posted: {job.postedDate}
                                    </div>
                                    <div className="stat-item">
                                        <FaClock /> Deadline: {job.deadline}
                                    </div>
                                </div>

                                <div className="job-footer">
                                    <span className="status-badge" style={{ backgroundColor: statusBadge.bg, color: statusBadge.color }}>
                                        {statusBadge.icon} {statusBadge.label}
                                    </span>
                                    <Link to={`/hr/jobs/${job.id}`} className="view-details">
                                        View Details →
                                    </Link>
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
                            <th onClick={() => handleSort('type')}>
                                Type
                            </th>
                            <th onClick={() => handleSort('applications')}>
                                Applications {sortBy === 'applications' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th onClick={() => handleSort('status')}>
                                Status
                            </th>
                            <th onClick={() => handleSort('postedDate')}>
                                Posted Date {sortBy === 'postedDate' && (sortOrder === 'asc' ? '↑' : '↓')}
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
                                        <Link to={`/hr/jobs/${job.id}`} className="job-link">
                                            {job.title}
                                        </Link>
                                    </td>
                                    <td>{job.department}</td>
                                    <td>{job.location}</td>
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
                                    <td>{job.postedDate}</td>
                                    <td>
                                        <div className="action-buttons">
                                            <Link to={`/hr/jobs/${job.id}`} className="btn-icon" title="View">
                                                <FaEye />
                                            </Link>
                                            <Link to={`/hr/jobs/${job.id}/edit`} className="btn-icon" title="Edit">
                                                <FaEdit />
                                            </Link>
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
                            <p>Try adjusting your search or filter criteria</p>
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

                .bulk-actions {
                    background: #4299e1;
                    color: white;
                    padding: 1rem;
                    border-radius: 8px;
                    margin-bottom: 1rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .jobs-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
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
                }

                .job-title-section h3 a {
                    color: #2d3748;
                    text-decoration: none;
                }

                .job-title-section h3 a:hover {
                    color: #4299e1;
                }

                .job-actions {
                    display: flex;
                    gap: 0.25rem;
                }

                .job-meta {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1rem;
                    flex-wrap: wrap;
                }

                .job-meta span {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.9rem;
                    color: #718096;
                }

                .job-type {
                    padding: 0.15rem 0.5rem;
                    border-radius: 30px;
                    font-size: 0.8rem;
                    font-weight: 500;
                }

                .job-description {
                    color: #4a5568;
                    margin-bottom: 1rem;
                    line-height: 1.6;
                }

                .job-requirements {
                    margin-bottom: 1rem;
                }

                .job-requirements strong {
                    color: #2d3748;
                    font-size: 0.9rem;
                    display: block;
                    margin-bottom: 0.5rem;
                }

                .requirement-tags {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }

                .requirement-tag {
                    padding: 0.25rem 0.75rem;
                    background: #f7fafc;
                    color: #4a5568;
                    border-radius: 30px;
                    font-size: 0.8rem;
                }

                .job-stats {
                    display: flex;
                    gap: 1.5rem;
                    margin-bottom: 1rem;
                    padding: 0.75rem 0;
                    border-top: 1px solid #e2e8f0;
                    border-bottom: 1px solid #e2e8f0;
                }

                .stat-item {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    color: #718096;
                    font-size: 0.9rem;
                }

                .job-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .view-details {
                    color: #4299e1;
                    text-decoration: none;
                    font-weight: 500;
                }

                .view-details:hover {
                    text-decoration: underline;
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