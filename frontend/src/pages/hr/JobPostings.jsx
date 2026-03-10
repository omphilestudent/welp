import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';
import {
    FaBriefcase, FaPlus, FaEdit, FaEye, FaTrash, FaCopy,
    FaShare, FaCalendarAlt, FaMapMarkerAlt, FaClock, FaUsers,
    FaCheckCircle, FaTimesCircle, FaSearch, FaPrint,
    FaChartLine, FaBuilding, FaGlobe, FaDollarSign,
    FaRegClock, FaExclamationTriangle, FaBug
} from 'react-icons/fa';

// ─── Inline popup error modal ────────────────────────────────────────────────
const ErrorModal = ({ errors, onClose }) => {
    if (!errors || errors.length === 0) return null;
    return (
        <>
            <div className="jp-overlay" onClick={onClose} />
            <div className="jp-error-modal" role="dialog" aria-modal="true" aria-label="Error details">
                <div className="jp-error-modal__header">
                    <FaExclamationTriangle className="jp-error-modal__icon" />
                    <div>
                        <h3>Action Failed</h3>
                        <p>{errors.length} issue{errors.length > 1 ? 's' : ''} occurred</p>
                    </div>
                    <button className="jp-error-modal__close" onClick={onClose} aria-label="Close">
                        <FaTimesCircle />
                    </button>
                </div>
                <ul className="jp-error-modal__list">
                    {errors.map((err, i) => (
                        <li key={i} className="jp-error-modal__item">
                            <FaBug className="jp-error-modal__item-icon" />
                            <div className="jp-error-modal__item-body">
                                {err.field && (
                                    <p><strong>Field:</strong> {err.field}</p>
                                )}
                                <p><strong>Error:</strong> {err.message || err.error || String(err)}</p>
                                {err.value && (
                                    <p><strong>Invalid value:</strong> <code>{JSON.stringify(err.value)}</code></p>
                                )}
                                {err.availableDepartments && err.availableDepartments.length > 0 && (
                                    <div className="jp-error-modal__dept-hint">
                                        <p><strong>Valid departments:</strong></p>
                                        <ul>
                                            {err.availableDepartments.map((d) => (
                                                <li key={d.id}>{d.name}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
                <div className="jp-error-modal__footer">
                    <button className="jp-btn jp-btn--primary" onClick={onClose}>
                        Got it
                    </button>
                </div>
            </div>
        </>
    );
};

// ─── Parse server error response into a list of error objects ───────────────
const parseServerErrors = (err) => {
    const data = err.response?.data;
    if (!data) return [{ message: err.message || 'An unexpected error occurred' }];
    if (data.error) {
        return [{
            field: data.field || null,
            message: data.message || data.error,
            value: data.value || null,
            availableDepartments: data.availableDepartments || null
        }];
    }
    if (Array.isArray(data.errors)) {
        return data.errors.map((e) => ({
            field: e.field || null,
            message: e.message || e.error || String(e)
        }));
    }
    return [{ message: data.message || 'Server error' }];
};

// ─── Main Component ──────────────────────────────────────────────────────────
const JobPostings = () => {
    const navigate = useNavigate();
    const [jobs, setJobs]                         = useState([]);
    const [departments, setDepartments]           = useState([]);
    const [loading, setLoading]                   = useState(true);
    const [searchTerm, setSearchTerm]             = useState('');
    const [filterStatus, setFilterStatus]         = useState('all');
    const [filterDepartment, setFilterDepartment] = useState('all');
    const [sortBy, setSortBy]                     = useState('created_at');
    const [sortOrder, setSortOrder]               = useState('desc');
    const [selectedJobs, setSelectedJobs]         = useState([]);
    const [viewMode, setViewMode]                 = useState('grid');
    const [pageError, setPageError]               = useState(null);       // full-page load error
    const [modalErrors, setModalErrors]           = useState([]);         // popup action errors
    const [stats, setStats] = useState({
        total: 0, open: 0, closed: 0, draft: 0, totalApplications: 0, avgApplications: 0
    });

    // ── Data fetching ────────────────────────────────────────────────────────
    const fetchJobs = useCallback(async () => {
        setLoading(true);
        setPageError(null);
        try {
            const { data } = await api.get('/hr/jobs');
            const raw = data.data || data.jobs || data;
            if (!raw) throw new Error('Invalid response format from server');

            const normalised = (Array.isArray(raw) ? raw : []).map((job) => ({
                id:              job.id,
                title:           job.title || 'Untitled Position',
                department:      job.department_name || job.department || 'Unassigned',
                // ✅ Store the real UUID so duplicate / status-change calls work
                department_id:   job.department_id || null,
                location:        job.location || 'Not specified',
                type:            job.employment_type || job.type || 'full-time',
                experience:      job.experience_level || job.experience || 'Not specified',
                salary_min:      job.salary_min || null,
                salary_max:      job.salary_max || null,
                salary_currency: job.salary_currency || 'USD',
                description:     job.description || '',
                requirements:    Array.isArray(job.requirements)     ? job.requirements     : [],
                responsibilities:Array.isArray(job.responsibilities) ? job.responsibilities : [],
                benefits:        Array.isArray(job.benefits)         ? job.benefits         : [],
                skills:          Array.isArray(job.skills_required)  ? job.skills_required  : [],
                applications:    Number(job.applications_count || job.applications || 0),
                status:          job.status || 'draft',
                postedDate:      job.created_at
                    ? new Date(job.created_at).toISOString()
                    : new Date().toISOString(),
                deadline:        job.application_deadline
                    ? new Date(job.application_deadline).toISOString()
                    : null,
                postedBy:        job.posted_by_name || 'System',
                views:           Number(job.views_count || 0),
                isRemote:        job.is_remote || false,
                education:       job.education_required || null
            }));

            setJobs(normalised);

            const total             = normalised.length;
            const open              = normalised.filter((j) => j.status === 'open').length;
            const closed            = normalised.filter((j) => j.status === 'closed').length;
            const draft             = normalised.filter((j) => j.status === 'draft').length;
            const totalApplications = normalised.reduce((s, j) => s + j.applications, 0);
            setStats({
                total, open, closed, draft, totalApplications,
                avgApplications: total > 0 ? Math.round(totalApplications / total) : 0
            });
        } catch (err) {
            console.error('Failed to fetch jobs:', err);
            const msg = err.response?.data?.error || err.message || 'Failed to load job postings';
            setPageError(msg);
            toast.error(msg);
            setJobs([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchDepartments = useCallback(async () => {
        try {
            const { data } = await api.get('/hr/departments');
            const raw = data.data || data.departments || data;
            // Normalise alias: backend sends department_id, not id
            const list = (Array.isArray(raw) ? raw : []).map((d) => ({
                id:   d.department_id || d.id,
                name: d.name
            }));
            setDepartments(list);
        } catch (err) {
            console.error('Failed to fetch departments:', err);
            setDepartments([]);
        }
    }, []);

    useEffect(() => {
        fetchJobs();
        fetchDepartments();
    }, [fetchJobs, fetchDepartments]);

    // ── Actions ──────────────────────────────────────────────────────────────
    const showActionError = (err) => {
        const errors = parseServerErrors(err);
        setModalErrors(errors);
        toast.error(errors[0]?.message || 'Action failed');
    };

    const handleDeleteJob = async (jobId) => {
        if (!window.confirm('Are you sure you want to delete this job posting?')) return;
        try {
            await api.delete(`/hr/jobs/${jobId}`);
            toast.success('Job deleted successfully');
            fetchJobs();
        } catch (err) {
            showActionError(err);
        }
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`Delete ${selectedJobs.length} selected job(s)?`)) return;
        try {
            await Promise.all(selectedJobs.map((jid) => api.delete(`/hr/jobs/${jid}`)));
            toast.success(`${selectedJobs.length} jobs deleted`);
            setSelectedJobs([]);
            fetchJobs();
        } catch (err) {
            showActionError(err);
        }
    };

    const handleDuplicate = async (job) => {
        // ✅ Guard: department_id must be a real UUID, not null/undefined
        if (!job.department_id) {
            setModalErrors([{
                message: 'This job has no department assigned. Please edit the job and assign a valid department before duplicating.',
                field: 'department_id'
            }]);
            return;
        }

        try {
            await api.post('/hr/jobs', {
                title:             `${job.title} (Copy)`,
                department_id:     job.department_id,   // ✅ real UUID from DB
                employment_type:   job.type,
                location:          job.location,
                salary_min:        job.salary_min,
                salary_max:        job.salary_max,
                salary_currency:   job.salary_currency,
                description:       job.description,
                requirements:      job.requirements,
                responsibilities:  job.responsibilities,
                benefits:          job.benefits,
                skills_required:   job.skills,
                experience_level:  job.experience,
                education_required:job.education,
                is_remote:         job.isRemote,
                status:            'draft'
            });
            toast.success('Job duplicated as draft');
            fetchJobs();
        } catch (err) {
            showActionError(err);
        }
    };

    const handleShare = (job) => {
        const link = `${window.location.origin}/careers/jobs/${job.id}`;
        navigator.clipboard.writeText(link).then(
            () => toast.success('Job link copied to clipboard'),
            () => toast.error('Could not copy link')
        );
    };

    const handleStatusChange = async (jobId, newStatus) => {
        try {
            await api.patch(`/hr/jobs/${jobId}`, { status: newStatus });
            toast.success(`Job marked as ${newStatus}`);
            fetchJobs();
        } catch (err) {
            showActionError(err);
        }
    };

    // ── Sorting / filtering ──────────────────────────────────────────────────
    const handleSort = (field) => {
        if (sortBy === field) {
            setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    const handleSelectJob = (jid) =>
        setSelectedJobs((prev) =>
            prev.includes(jid) ? prev.filter((x) => x !== jid) : [...prev, jid]
        );

    const filteredJobs = jobs
        .filter((job) => {
            const q = searchTerm.toLowerCase();
            const matchesSearch =
                job.title.toLowerCase().includes(q) ||
                job.department.toLowerCase().includes(q) ||
                job.location.toLowerCase().includes(q) ||
                job.description.toLowerCase().includes(q);

            const matchesStatus = filterStatus === 'all' || job.status === filterStatus;
            // ✅ Compare by department NAME (filter select uses name as value)
            const matchesDept   = filterDepartment === 'all' || job.department === filterDepartment;

            return matchesSearch && matchesStatus && matchesDept;
        })
        .sort((a, b) => {
            let av = a[sortBy];
            let bv = b[sortBy];
            if (['applications', 'views'].includes(sortBy)) { av = Number(av); bv = Number(bv); }
            if (sortBy === 'postedDate') { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
            return sortOrder === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
        });

    // ── Badge helpers ────────────────────────────────────────────────────────
    const getStatusBadge = (status) => ({
        open:   { bg: '#e6f7e6', color: '#38a169', icon: <FaCheckCircle />, label: 'Open' },
        closed: { bg: '#ffe6e6', color: '#f56565', icon: <FaTimesCircle />, label: 'Closed' },
        draft:  { bg: '#e6e6e6', color: '#718096', icon: <FaClock />,       label: 'Draft' }
    }[status] || { bg: '#e6e6e6', color: '#718096', icon: <FaClock />, label: 'Draft' });

    const getTypeBadge = (type) => ({
        'full-time':  { bg: '#e6f7ff', color: '#3182ce', label: 'Full Time' },
        'part-time':  { bg: '#fff7e6', color: '#ed8936', label: 'Part Time' },
        'contract':   { bg: '#f0e6ff', color: '#9f7aea', label: 'Contract' },
        'internship': { bg: '#e6ffe6', color: '#48bb78', label: 'Internship' },
        'temporary':  { bg: '#fff5e6', color: '#dd6b20', label: 'Temporary' }
    }[type] || { bg: '#e6f7ff', color: '#3182ce', label: 'Full Time' });

    const formatSalary = (job) => {
        if (!job.salary_min && !job.salary_max) return 'Not disclosed';
        const fmt = (n) => Number(n).toLocaleString();
        if (job.salary_min && job.salary_max)
            return `${job.salary_currency} ${fmt(job.salary_min)} – ${fmt(job.salary_max)}`;
        return job.salary_min
            ? `${job.salary_currency} ${fmt(job.salary_min)}+`
            : 'Negotiable';
    };

    if (loading) return <Loading />;

    return (
        <div className="jp-page">
            {/* ── Error popup modal ── */}
            <ErrorModal errors={modalErrors} onClose={() => setModalErrors([])} />

            {/* ── Page-load error banner ── */}
            {pageError && (
                <div className="jp-page-error">
                    <FaExclamationTriangle />
                    <div>
                        <strong>Failed to load job postings</strong>
                        <p>{pageError}</p>
                    </div>
                    <button className="jp-btn jp-btn--danger-sm" onClick={fetchJobs}>
                        Retry
                    </button>
                </div>
            )}

            {/* ── Header ── */}
            <div className="jp-header">
                <div>
                    <h1><FaBriefcase className="jp-header__icon" /> Job Postings</h1>
                    <p>Manage and track all your job openings</p>
                </div>
                <div className="jp-header__actions">
                    <div className="jp-view-toggle">
                        <button className={`jp-view-toggle__btn ${viewMode === 'grid'  ? 'active' : ''}`} onClick={() => setViewMode('grid')}>Grid</button>
                        <button className={`jp-view-toggle__btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')}>Table</button>
                    </div>
                    <button className="jp-btn jp-btn--primary" onClick={() => navigate('/hr/jobs/create')}>
                        <FaPlus /> New Job
                    </button>
                    {selectedJobs.length > 0 && (
                        <button className="jp-btn jp-btn--danger" onClick={handleBulkDelete}>
                            <FaTrash /> Delete ({selectedJobs.length})
                        </button>
                    )}
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="jp-filters">
                <div className="jp-search">
                    <FaSearch className="jp-search__icon" />
                    <input
                        type="text"
                        placeholder="Search by title, department, location…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="jp-filter-group">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="jp-select"
                    >
                        <option value="all">All Status</option>
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                        <option value="draft">Draft</option>
                    </select>
                    <select
                        value={filterDepartment}
                        onChange={(e) => setFilterDepartment(e.target.value)}
                        className="jp-select"
                    >
                        <option value="all">All Departments</option>
                        {departments.map((d) => (
                            // ✅ value = department NAME (matches job.department)
                            <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                    </select>
                    <button className="jp-btn jp-btn--secondary" onClick={() => window.print()}>
                        <FaPrint /> Print
                    </button>
                </div>
            </div>

            {/* ── Stats ── */}
            <div className="jp-stats">
                {[
                    { label: 'Total Jobs',     value: stats.total,             color: '#4299e1', icon: <FaBriefcase /> },
                    { label: 'Open',           value: stats.open,              color: '#48bb78', icon: <FaCheckCircle /> },
                    { label: 'Closed',         value: stats.closed,            color: '#f56565', icon: <FaTimesCircle /> },
                    { label: 'Draft',          value: stats.draft,             color: '#a0aec0', icon: <FaClock /> },
                    { label: 'Applications',   value: stats.totalApplications, color: '#9f7aea', icon: <FaUsers /> },
                    { label: 'Avg / Job',      value: stats.avgApplications,   color: '#f687b3', icon: <FaChartLine /> }
                ].map((s) => (
                    <div key={s.label} className="jp-stat-card">
                        <div className="jp-stat-card__icon" style={{ background: `${s.color}20`, color: s.color }}>
                            {s.icon}
                        </div>
                        <div>
                            <p className="jp-stat-card__label">{s.label}</p>
                            <p className="jp-stat-card__value">{s.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Bulk actions bar ── */}
            {selectedJobs.length > 0 && (
                <div className="jp-bulk-bar">
                    <span>{selectedJobs.length} selected</span>
                    <div className="jp-bulk-bar__actions">
                        <button className="jp-icon-btn" title="Mark Open"   onClick={() => selectedJobs.forEach((id) => handleStatusChange(id, 'open'))}>   <FaCheckCircle /></button>
                        <button className="jp-icon-btn" title="Mark Closed" onClick={() => selectedJobs.forEach((id) => handleStatusChange(id, 'closed'))}> <FaTimesCircle /></button>
                        <button className="jp-icon-btn jp-icon-btn--danger" title="Delete" onClick={handleBulkDelete}> <FaTrash /></button>
                    </div>
                </div>
            )}

            {/* ── Empty state ── */}
            {filteredJobs.length === 0 && !loading && (
                <div className="jp-empty">
                    <FaBriefcase size={48} />
                    <h3>No jobs found</h3>
                    <p>
                        {searchTerm || filterStatus !== 'all' || filterDepartment !== 'all'
                            ? 'Try adjusting your search or filter criteria'
                            : 'Create your first job posting to get started'}
                    </p>
                    {!searchTerm && filterStatus === 'all' && filterDepartment === 'all' && (
                        <button className="jp-btn jp-btn--primary" onClick={() => navigate('/hr/jobs/create')}>
                            <FaPlus /> Create New Job
                        </button>
                    )}
                </div>
            )}

            {/* ══════════════════ GRID VIEW ══════════════════ */}
            {filteredJobs.length > 0 && viewMode === 'grid' && (
                <div className="jp-grid">
                    {filteredJobs.map((job) => {
                        const sb = getStatusBadge(job.status);
                        const tb = getTypeBadge(job.type);
                        return (
                            <div key={job.id} className={`jp-card ${selectedJobs.includes(job.id) ? 'jp-card--selected' : ''}`}>
                                <div className="jp-card__head">
                                    <div className="jp-card__title-row">
                                        <input
                                            type="checkbox"
                                            checked={selectedJobs.includes(job.id)}
                                            onChange={() => handleSelectJob(job.id)}
                                        />
                                        <h3 onClick={() => navigate(`/hr/jobs/${job.id}`)}>{job.title}</h3>
                                    </div>
                                    <div className="jp-card__actions">
                                        <button className="jp-icon-btn" title="Duplicate" onClick={() => handleDuplicate(job)}><FaCopy /></button>
                                        <button className="jp-icon-btn" title="Share"     onClick={() => handleShare(job)}><FaShare /></button>
                                        <button className="jp-icon-btn" title="Edit"      onClick={() => navigate(`/hr/jobs/${job.id}/edit`)}><FaEdit /></button>
                                        <button className="jp-icon-btn jp-icon-btn--danger" title="Delete" onClick={() => handleDeleteJob(job.id)}><FaTrash /></button>
                                    </div>
                                </div>

                                <div className="jp-card__meta">
                                    <span><FaBuilding /> {job.department}</span>
                                    <span><FaMapMarkerAlt /> {job.location}{job.isRemote && ' 🌍'}</span>
                                    <span className="jp-type-badge" style={{ background: tb.bg, color: tb.color }}>{tb.label}</span>
                                </div>

                                <div className="jp-card__salary">
                                    <FaDollarSign /> {formatSalary(job)}
                                </div>

                                {job.description && (
                                    <p className="jp-card__desc">
                                        {job.description.length > 140
                                            ? `${job.description.slice(0, 140)}…`
                                            : job.description}
                                    </p>
                                )}

                                {job.skills.length > 0 && (
                                    <div className="jp-card__skills">
                                        {job.skills.slice(0, 4).map((s, i) => (
                                            <span key={i} className="jp-skill">{s}</span>
                                        ))}
                                        {job.skills.length > 4 && (
                                            <span className="jp-skill">+{job.skills.length - 4}</span>
                                        )}
                                    </div>
                                )}

                                <div className="jp-card__stats-row">
                                    <span><FaUsers /> {job.applications} applicants</span>
                                    <span><FaRegClock /> {new Date(job.postedDate).toLocaleDateString()}</span>
                                    {job.deadline && (
                                        <span><FaCalendarAlt /> {new Date(job.deadline).toLocaleDateString()}</span>
                                    )}
                                </div>

                                <div className="jp-card__footer">
                                    <span className="jp-status-badge" style={{ background: sb.bg, color: sb.color }}>
                                        {sb.icon} {sb.label}
                                    </span>
                                    <div className="jp-card__footer-actions">
                                        {job.status !== 'open' && (
                                            <button className="jp-btn-sm" onClick={() => handleStatusChange(job.id, 'open')}>Publish</button>
                                        )}
                                        {job.status === 'open' && (
                                            <button className="jp-btn-sm" onClick={() => handleStatusChange(job.id, 'closed')}>Close</button>
                                        )}
                                        <button className="jp-btn-sm jp-btn-sm--primary" onClick={() => navigate(`/hr/jobs/${job.id}`)}>
                                            <FaEye /> View
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ══════════════════ TABLE VIEW ══════════════════ */}
            {filteredJobs.length > 0 && viewMode === 'table' && (
                <div className="jp-table-wrap">
                    <table className="jp-table">
                        <thead>
                        <tr>
                            <th>
                                <input
                                    type="checkbox"
                                    checked={selectedJobs.length === filteredJobs.length && filteredJobs.length > 0}
                                    onChange={() => {
                                        if (selectedJobs.length === filteredJobs.length) setSelectedJobs([]);
                                        else setSelectedJobs(filteredJobs.map((j) => j.id));
                                    }}
                                />
                            </th>
                            {[
                                { key: 'title',       label: 'Job Title' },
                                { key: 'department',  label: 'Department' },
                                { key: 'location',    label: 'Location' },
                                { key: null,          label: 'Type' },
                                { key: 'applications',label: 'Apps' },
                                { key: 'status',      label: 'Status' },
                                { key: 'postedDate',  label: 'Posted' },
                                { key: null,          label: 'Actions' }
                            ].map(({ key, label }) => (
                                <th
                                    key={label}
                                    onClick={key ? () => handleSort(key) : undefined}
                                    style={key ? { cursor: 'pointer' } : {}}
                                >
                                    {label}
                                    {key && sortBy === key && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                                </th>
                            ))}
                        </tr>
                        </thead>
                        <tbody>
                        {filteredJobs.map((job) => {
                            const sb = getStatusBadge(job.status);
                            const tb = getTypeBadge(job.type);
                            return (
                                <tr key={job.id} className={selectedJobs.includes(job.id) ? 'jp-table__row--selected' : ''}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={selectedJobs.includes(job.id)}
                                            onChange={() => handleSelectJob(job.id)}
                                        />
                                    </td>
                                    <td>
                                            <span className="jp-table__link" onClick={() => navigate(`/hr/jobs/${job.id}`)}>
                                                {job.title}
                                            </span>
                                    </td>
                                    <td>{job.department}</td>
                                    <td>{job.location}{job.isRemote && ' 🌍'}</td>
                                    <td>
                                            <span className="jp-type-badge" style={{ background: tb.bg, color: tb.color }}>
                                                {tb.label}
                                            </span>
                                    </td>
                                    <td>{job.applications}</td>
                                    <td>
                                            <span className="jp-status-badge" style={{ background: sb.bg, color: sb.color }}>
                                                {sb.icon} {sb.label}
                                            </span>
                                    </td>
                                    <td>{new Date(job.postedDate).toLocaleDateString()}</td>
                                    <td>
                                        <div className="jp-table__actions">
                                            <button className="jp-icon-btn" title="View"      onClick={() => navigate(`/hr/jobs/${job.id}`)}><FaEye /></button>
                                            <button className="jp-icon-btn" title="Edit"      onClick={() => navigate(`/hr/jobs/${job.id}/edit`)}><FaEdit /></button>
                                            <button className="jp-icon-btn" title="Duplicate" onClick={() => handleDuplicate(job)}><FaCopy /></button>
                                            <button className="jp-icon-btn jp-icon-btn--danger" title="Delete" onClick={() => handleDeleteJob(job.id)}><FaTrash /></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            )}

            <style>{`
                .jp-page {
                    padding: 2rem;
                    max-width: 1600px;
                    margin: 0 auto;
                    font-family: 'Segoe UI', system-ui, sans-serif;
                }

                /* ── Overlay + Error Modal ─────────────────────────── */
                .jp-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.45);
                    z-index: 200;
                    animation: jp-fade-in 0.2s ease;
                }
                @keyframes jp-fade-in {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                .jp-error-modal {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 201;
                    background: white;
                    border-radius: 14px;
                    width: min(520px, 92vw);
                    box-shadow: 0 20px 50px rgba(0,0,0,0.25);
                    animation: jp-pop-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
                    overflow: hidden;
                }
                @keyframes jp-pop-in {
                    from { opacity: 0; transform: translate(-50%, -54%) scale(0.92); }
                    to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                }
                .jp-error-modal__header {
                    display: flex;
                    align-items: center;
                    gap: 0.9rem;
                    padding: 1.1rem 1.4rem;
                    background: linear-gradient(135deg, #fed7d7 0%, #fff5f5 100%);
                    border-bottom: 1px solid #fc8181;
                }
                .jp-error-modal__icon {
                    font-size: 1.5rem;
                    color: #c53030;
                    flex-shrink: 0;
                }
                .jp-error-modal__header h3 {
                    margin: 0 0 0.15rem;
                    color: #742a2a;
                    font-size: 1rem;
                    font-weight: 700;
                }
                .jp-error-modal__header p {
                    margin: 0;
                    color: #9b2c2c;
                    font-size: 0.82rem;
                }
                .jp-error-modal__close {
                    margin-left: auto;
                    background: none;
                    border: none;
                    color: #c53030;
                    font-size: 1.15rem;
                    cursor: pointer;
                    padding: 0.25rem;
                    border-radius: 4px;
                    transition: background 0.2s;
                }
                .jp-error-modal__close:hover { background: #feb2b2; }
                .jp-error-modal__list {
                    list-style: none;
                    margin: 0;
                    padding: 0.75rem 1.4rem;
                    max-height: 320px;
                    overflow-y: auto;
                }
                .jp-error-modal__item {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.7rem;
                    padding: 0.75rem 0;
                    border-bottom: 1px solid #fed7d7;
                }
                .jp-error-modal__item:last-child { border-bottom: none; }
                .jp-error-modal__item-icon {
                    color: #f56565;
                    margin-top: 2px;
                    flex-shrink: 0;
                }
                .jp-error-modal__item-body {
                    font-size: 0.875rem;
                    color: #2d3748;
                    flex: 1;
                }
                .jp-error-modal__item-body p { margin: 0 0 0.3rem; }
                .jp-error-modal__item-body code {
                    background: #f7fafc;
                    padding: 0.15rem 0.4rem;
                    border-radius: 4px;
                    font-size: 0.8rem;
                }
                .jp-error-modal__dept-hint {
                    margin-top: 0.5rem;
                    padding: 0.6rem 0.8rem;
                    background: #f7fafc;
                    border-radius: 6px;
                    font-size: 0.82rem;
                }
                .jp-error-modal__dept-hint ul {
                    margin: 0.25rem 0 0 1rem;
                    padding: 0;
                }
                .jp-error-modal__dept-hint li { margin: 0.15rem 0; }
                .jp-error-modal__footer {
                    padding: 0.9rem 1.4rem;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: flex-end;
                }

                /* ── Page error banner ─────────────────────────────── */
                .jp-page-error {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    background: #fff5f5;
                    border: 1px solid #feb2b2;
                    border-radius: 8px;
                    padding: 1rem 1.25rem;
                    margin-bottom: 1.5rem;
                    color: #742a2a;
                    font-size: 0.9rem;
                }
                .jp-page-error > svg { font-size: 1.25rem; color: #f56565; flex-shrink: 0; }
                .jp-page-error > div { flex: 1; }
                .jp-page-error strong { display: block; margin-bottom: 0.2rem; }
                .jp-page-error p { margin: 0; color: #9b2c2c; font-size: 0.82rem; }

                /* ── Header ─────────────────────────────────────────── */
                .jp-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 1.75rem;
                    flex-wrap: wrap;
                    gap: 1rem;
                }
                .jp-header h1 {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    font-size: 1.8rem;
                    font-weight: 700;
                    color: #2d3748;
                    margin: 0 0 0.3rem;
                }
                .jp-header__icon { color: #4299e1; }
                .jp-header p { margin: 0; color: #718096; font-size: 0.9rem; }
                .jp-header__actions {
                    display: flex;
                    gap: 0.75rem;
                    align-items: center;
                    flex-wrap: wrap;
                }

                /* ── View toggle ────────────────────────────────────── */
                .jp-view-toggle {
                    display: flex;
                    background: #f7fafc;
                    border-radius: 8px;
                    padding: 3px;
                    gap: 2px;
                }
                .jp-view-toggle__btn {
                    padding: 0.4rem 1rem;
                    border: none;
                    background: transparent;
                    border-radius: 6px;
                    color: #718096;
                    cursor: pointer;
                    font-size: 0.85rem;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                .jp-view-toggle__btn.active {
                    background: white;
                    color: #4299e1;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }

                /* ── Filters ────────────────────────────────────────── */
                .jp-filters {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1.75rem;
                    flex-wrap: wrap;
                }
                .jp-search {
                    flex: 1;
                    min-width: 260px;
                    position: relative;
                }
                .jp-search__icon {
                    position: absolute;
                    left: 0.9rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #a0aec0;
                    pointer-events: none;
                }
                .jp-search input {
                    width: 100%;
                    padding: 0.7rem 1rem 0.7rem 2.4rem;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 0.9rem;
                    box-sizing: border-box;
                }
                .jp-search input:focus {
                    outline: none;
                    border-color: #4299e1;
                    box-shadow: 0 0 0 3px rgba(66,153,225,0.15);
                }
                .jp-filter-group {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }
                .jp-select {
                    padding: 0.7rem 0.9rem;
                    border: 1.5px solid #e2e8f0;
                    border-radius: 8px;
                    background: white;
                    font-size: 0.9rem;
                    color: #2d3748;
                    min-width: 150px;
                }

                /* ── Stats ──────────────────────────────────────────── */
                .jp-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.75rem;
                }
                .jp-stat-card {
                    background: white;
                    border-radius: 12px;
                    padding: 1.25rem;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
                }
                .jp-stat-card__icon {
                    width: 46px;
                    height: 46px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.25rem;
                    flex-shrink: 0;
                }
                .jp-stat-card__label {
                    margin: 0 0 0.2rem;
                    font-size: 0.78rem;
                    color: #718096;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }
                .jp-stat-card__value {
                    margin: 0;
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #2d3748;
                }

                /* ── Bulk bar ───────────────────────────────────────── */
                .jp-bulk-bar {
                    background: #4299e1;
                    color: white;
                    padding: 0.75rem 1.25rem;
                    border-radius: 8px;
                    margin-bottom: 1rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    font-size: 0.9rem;
                    font-weight: 600;
                }
                .jp-bulk-bar__actions { display: flex; gap: 0.4rem; }

                /* ── Jobs grid ──────────────────────────────────────── */
                .jp-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
                    gap: 1.25rem;
                }
                .jp-card {
                    background: white;
                    border-radius: 12px;
                    padding: 1.4rem;
                    border: 1.5px solid #e2e8f0;
                    transition: box-shadow 0.2s, transform 0.2s;
                }
                .jp-card:hover {
                    box-shadow: 0 8px 20px rgba(0,0,0,0.08);
                    transform: translateY(-3px);
                }
                .jp-card--selected {
                    border-color: #4299e1;
                    box-shadow: 0 0 0 3px rgba(66,153,225,0.15);
                }
                .jp-card__head {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 0.9rem;
                }
                .jp-card__title-row {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    flex: 1;
                }
                .jp-card__title-row h3 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 700;
                    color: #2d3748;
                    cursor: pointer;
                    line-height: 1.3;
                }
                .jp-card__title-row h3:hover { color: #4299e1; }
                .jp-card__actions { display: flex; gap: 0.25rem; flex-shrink: 0; }
                .jp-card__meta {
                    display: flex;
                    gap: 0.75rem;
                    flex-wrap: wrap;
                    margin-bottom: 0.9rem;
                    font-size: 0.85rem;
                    color: #718096;
                }
                .jp-card__meta span {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }
                .jp-card__salary {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: #48bb78;
                    background: #f0fff4;
                    padding: 0.5rem 0.75rem;
                    border-radius: 6px;
                    margin-bottom: 0.9rem;
                }
                .jp-card__desc {
                    font-size: 0.85rem;
                    color: #4a5568;
                    line-height: 1.55;
                    margin: 0 0 0.9rem;
                }
                .jp-card__skills {
                    display: flex;
                    gap: 0.4rem;
                    flex-wrap: wrap;
                    margin-bottom: 0.9rem;
                }
                .jp-skill {
                    padding: 0.2rem 0.6rem;
                    background: #f7fafc;
                    color: #4a5568;
                    border-radius: 20px;
                    font-size: 0.78rem;
                    border: 1px solid #e2e8f0;
                }
                .jp-card__stats-row {
                    display: flex;
                    gap: 1.25rem;
                    flex-wrap: wrap;
                    font-size: 0.82rem;
                    color: #718096;
                    padding: 0.7rem 0;
                    border-top: 1px solid #e2e8f0;
                    border-bottom: 1px solid #e2e8f0;
                    margin-bottom: 0.9rem;
                }
                .jp-card__stats-row span {
                    display: flex;
                    align-items: center;
                    gap: 0.3rem;
                }
                .jp-card__footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .jp-card__footer-actions { display: flex; gap: 0.4rem; }

                /* ── Badges ─────────────────────────────────────────── */
                .jp-status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.3rem;
                    padding: 0.25rem 0.7rem;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 600;
                }
                .jp-type-badge {
                    padding: 0.2rem 0.6rem;
                    border-radius: 20px;
                    font-size: 0.78rem;
                    font-weight: 600;
                }

                /* ── Table ──────────────────────────────────────────── */
                .jp-table-wrap {
                    background: white;
                    border-radius: 12px;
                    overflow-x: auto;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
                }
                .jp-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .jp-table th {
                    padding: 0.9rem 1rem;
                    text-align: left;
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: #718096;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    border-bottom: 2px solid #e2e8f0;
                    white-space: nowrap;
                }
                .jp-table th:hover { color: #4299e1; }
                .jp-table td {
                    padding: 0.9rem 1rem;
                    border-bottom: 1px solid #e2e8f0;
                    font-size: 0.875rem;
                    color: #2d3748;
                }
                .jp-table__row--selected { background: #ebf8ff; }
                .jp-table__link {
                    color: #4299e1;
                    font-weight: 600;
                    cursor: pointer;
                }
                .jp-table__link:hover { text-decoration: underline; }
                .jp-table__actions { display: flex; gap: 0.25rem; }

                /* ── Buttons ────────────────────────────────────────── */
                .jp-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                    padding: 0.6rem 1.2rem;
                    border-radius: 8px;
                    font-size: 0.875rem;
                    font-weight: 600;
                    cursor: pointer;
                    border: none;
                    transition: all 0.2s;
                    white-space: nowrap;
                }
                .jp-btn--primary { background: #4299e1; color: white; }
                .jp-btn--primary:hover { background: #3182ce; }
                .jp-btn--secondary { background: white; color: #4a5568; border: 1.5px solid #e2e8f0; }
                .jp-btn--secondary:hover { background: #f7fafc; }
                .jp-btn--danger { background: #f56565; color: white; }
                .jp-btn--danger:hover { background: #e53e3e; }
                .jp-btn--danger-sm {
                    padding: 0.35rem 0.75rem;
                    background: #f56565;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 0.82rem;
                    font-weight: 600;
                    cursor: pointer;
                    flex-shrink: 0;
                }
                .jp-btn--danger-sm:hover { background: #e53e3e; }

                .jp-icon-btn {
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
                    font-size: 0.85rem;
                    transition: all 0.2s;
                }
                .jp-icon-btn:hover { background: #4299e1; color: white; }
                .jp-icon-btn--danger:hover { background: #f56565; color: white; }

                .jp-btn-sm {
                    padding: 0.25rem 0.65rem;
                    border: 1.5px solid #e2e8f0;
                    background: white;
                    border-radius: 5px;
                    font-size: 0.8rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    color: #4a5568;
                }
                .jp-btn-sm:hover { background: #f7fafc; border-color: #cbd5e0; }
                .jp-btn-sm--primary { background: #4299e1; color: white; border-color: #4299e1; display: inline-flex; align-items: center; gap: 0.3rem; }
                .jp-btn-sm--primary:hover { background: #3182ce; border-color: #3182ce; }

                /* ── Empty ──────────────────────────────────────────── */
                .jp-empty {
                    text-align: center;
                    padding: 4rem 2rem;
                    color: #a0aec0;
                }
                .jp-empty h3 { color: #4a5568; margin: 1rem 0 0.5rem; }
                .jp-empty p  { margin: 0 0 1.5rem; }

                /* ── Responsive ─────────────────────────────────────── */
                @media (max-width: 768px) {
                    .jp-page { padding: 1rem; }
                    .jp-header { flex-direction: column; }
                    .jp-filters { flex-direction: column; }
                    .jp-search { min-width: 100%; }
                    .jp-grid { grid-template-columns: 1fr; }
                    .jp-stats { grid-template-columns: repeat(2, 1fr); }
                }
            `}</style>
        </div>
    );
};

export default JobPostings;