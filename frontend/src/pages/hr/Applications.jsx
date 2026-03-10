import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import {
    FiCheckCircle, FiXCircle, FiClock, FiUser, FiMail, FiPhone,
    FiMapPin, FiBriefcase, FiDownload, FiStar, FiMessageSquare,
    FiCalendar, FiArrowRight, FiChevronDown, FiFilter, FiSearch,
    FiEye, FiThumbsUp, FiThumbsDown, FiUpload, FiFileText, FiAward,
    FiRefreshCw, FiAlertCircle
} from 'react-icons/fi';

// ─── Config ────────────────────────────────────────────────────────────────────
const API_BASE = '/api/hr';   // adjust to your actual base path

// Application stages for the workflow
const APPLICATION_STAGES = [
    { id: 'pending',     label: 'New',        color: '#3498db', icon: FiClock },
    { id: 'reviewed',    label: 'Screening',  color: '#f39c12', icon: FiUser },
    { id: 'interviewed', label: 'Interview',  color: '#9b59b6', icon: FiCalendar },
    { id: 'shortlisted', label: 'Technical',  color: '#e74c3c', icon: FiBriefcase },
    { id: 'offered',     label: 'Offer',      color: '#2ecc71', icon: FiAward },
    { id: 'hired',       label: 'Hired',      color: '#27ae60', icon: FiCheckCircle },
    { id: 'rejected',    label: 'Rejected',   color: '#e74c3c', icon: FiXCircle }
];

// Map API status → stage id (in case values differ slightly)
const STATUS_TO_STAGE = {
    pending:     'pending',
    reviewed:    'reviewed',
    shortlisted: 'shortlisted',
    interviewed: 'interviewed',
    offered:     'offered',
    hired:       'hired',
    rejected:    'rejected'
};

// ─── API helpers ───────────────────────────────────────────────────────────────
const apiFetch = async (path, options = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        ...options
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
};

// Normalise an API application record to the shape the UI expects
const normaliseApp = (app) => ({
    id: app.id,
    jobTitle:       app.job_title        || '',
    department:     app.department_name  || '',
    jobId:          app.job_id           || '',
    firstName:      app.first_name       || '',
    lastName:       app.last_name        || '',
    email:          app.email            || '',
    phone:          app.phone            || '',
    location:       app.location         || '',
    experience:     app.years_experience != null ? `${app.years_experience} years` : '',
    education:      app.education        || '',
    skills:         Array.isArray(app.skills) ? app.skills : [],
    expectedSalary: app.salary_expectation || '',
    currentCompany: app.current_company  || '',
    currentPosition:app.current_position || '',
    noticePeriod:   app.available_start_date ? `From ${app.available_start_date}` : '',
    coverLetter:    app.cover_letter     || '',
    resumeUrl:      app.resume_url       || '',
    portfolioUrl:   app.portfolio_url    || '',
    linkedInUrl:    app.linkedin_url     || '',
    githubUrl:      app.github_url       || '',
    currentStage:   STATUS_TO_STAGE[app.status] || 'pending',
    priority:       app.priority         || 'medium',
    tags:           app.tags             || [],
    notes:          app.notes_list       || (app.notes ? [{ id: 1, author: app.reviewer_name || 'HR', content: app.notes, date: app.updated_at }] : []),
    ratings:        app.ratings          || {},
    interviews:     app.interviews       || [],
    stageHistory:   app.stage_history    || [],
    status:         'active',
    appliedDate:    app.created_at       || new Date().toISOString(),
    createdAt:      app.created_at       || new Date().toISOString(),
    updatedAt:      app.updated_at       || new Date().toISOString(),
    createdBy:      app.reviewer_name    || 'Applicant',
    _raw:           app
});

const Applications = () => {
    const [applications, setApplications]           = useState([]);
    const [loading, setLoading]                     = useState(true);
    const [openDialog, setOpenDialog]               = useState(false);
    const [selectedApplication, setSelectedApplication] = useState(null);
    const [searchTerm, setSearchTerm]               = useState('');
    const [stageFilter, setStageFilter]             = useState('all');
    const [departmentFilter, setDepartmentFilter]   = useState('all');
    const [priorityFilter, setPriorityFilter]       = useState('all');
    const [error, setError]                         = useState('');
    const [successMessage, setSuccessMessage]       = useState('');
    const [activeTab, setActiveTab]                 = useState('details');
    const [newNote, setNewNote]                     = useState('');
    const [rating, setRating]                       = useState({ category: '', score: 0, comment: '' });
    const [savingNote, setSavingNote]               = useState(false);
    const [savingStage, setSavingStage]             = useState(false);

    // Auto-dismiss success messages
    useEffect(() => {
        if (!successMessage) return;
        const t = setTimeout(() => setSuccessMessage(''), 3000);
        return () => clearTimeout(t);
    }, [successMessage]);

    // ── Fetch all applications across all jobs ────────────────────────────────
    const fetchApplications = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            // 1. Get all job postings so we can pull their applications
            const jobs = await apiFetch('/jobs').catch(() => []);

            if (!jobs.length) {
                setApplications([]);
                return;
            }

            // 2. Fetch applications for every job in parallel
            const perJob = await Promise.all(
                jobs.map(job =>
                    apiFetch(`/jobs/${job.id}/applications`)
                        .then(apps => apps.map(a => ({ ...a, job_title: job.title, department_name: job.department_name || a.department_name })))
                        .catch(() => [])
                )
            );

            const all = perJob.flat().map(normaliseApp);
            setApplications(all);
        } catch (err) {
            console.error('Failed to load applications:', err);
            setError('Failed to load applications. ' + err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchApplications(); }, [fetchApplications]);

    // ── Filtered list ─────────────────────────────────────────────────────────
    const filteredApplications = useMemo(() => {
        return applications.filter((app) => {
            const fullName  = `${app.firstName} ${app.lastName}`.toLowerCase();
            const matchesSearch = !searchTerm ||
                fullName.includes(searchTerm.toLowerCase()) ||
                app.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                app.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
                app.email.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStage      = stageFilter      === 'all' || app.currentStage === stageFilter;
            const matchesDepartment = departmentFilter === 'all' || app.department    === departmentFilter;
            const matchesPriority   = priorityFilter   === 'all' || app.priority      === priorityFilter;

            return matchesSearch && matchesStage && matchesDepartment && matchesPriority;
        });
    }, [applications, searchTerm, stageFilter, departmentFilter, priorityFilter]);

    // ── Stats ─────────────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const s = { total: applications.length };
        APPLICATION_STAGES.forEach(st => {
            s[st.id] = applications.filter(a => a.currentStage === st.id).length;
        });
        s.highPriority = applications.filter(a => a.priority === 'high').length;
        return s;
    }, [applications]);

    const departments = useMemo(() =>
            [...new Set(applications.map(a => a.department))].filter(Boolean),
        [applications]
    );

    // ── Stage change (calls updateApplicationStatus) ──────────────────────────
    const handleStageChange = async (applicationId, newStage) => {
        if (!newStage) return;
        setSavingStage(true);
        try {
            await apiFetch(`/applications/${applicationId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStage })
            });

            setApplications(prev => prev.map(app =>
                app.id === applicationId
                    ? { ...app, currentStage: STATUS_TO_STAGE[newStage] || newStage, updatedAt: new Date().toISOString() }
                    : app
            ));

            if (selectedApplication?.id === applicationId) {
                setSelectedApplication(prev => ({
                    ...prev,
                    currentStage: STATUS_TO_STAGE[newStage] || newStage,
                    updatedAt: new Date().toISOString()
                }));
            }

            const stageLabel = APPLICATION_STAGES.find(s => s.id === (STATUS_TO_STAGE[newStage] || newStage))?.label || newStage;
            setSuccessMessage(`Application moved to ${stageLabel}`);
        } catch (err) {
            setError('Failed to update stage: ' + err.message);
        } finally {
            setSavingStage(false);
        }
    };

    // ── Open detail modal (optionally re-fetch full details) ──────────────────
    const handleOpenApplication = async (application) => {
        setSelectedApplication(application);
        setActiveTab('details');
        setOpenDialog(true);

        // Optionally enrich with full details
        try {
            const full = await apiFetch(`/applications/${application.id}`);
            setSelectedApplication(normaliseApp({ ...full, job_title: application.jobTitle, department_name: application.department }));
        } catch (_) { /* use what we already have */ }
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setSelectedApplication(null);
        setNewNote('');
        setActiveTab('details');
    };

    // ── Notes ─────────────────────────────────────────────────────────────────
    const handleAddNote = async () => {
        if (!newNote.trim() || !selectedApplication) return;
        setSavingNote(true);
        try {
            const updated = await apiFetch(`/applications/${selectedApplication.id}/notes`, {
                method: 'POST',
                body: JSON.stringify({ notes: newNote })
            });

            const newNoteObj = {
                id: Date.now(),
                author: 'HR User',
                content: newNote,
                date: new Date().toISOString()
            };

            const updatedNotes = [...(selectedApplication.notes || []), newNoteObj];

            setApplications(prev => prev.map(app =>
                app.id === selectedApplication.id ? { ...app, notes: updatedNotes } : app
            ));
            setSelectedApplication(prev => ({ ...prev, notes: updatedNotes }));
            setNewNote('');
            setSuccessMessage('Note added successfully');
        } catch (err) {
            setError('Failed to add note: ' + err.message);
        } finally {
            setSavingNote(false);
        }
    };

    // ── Ratings (local only — extend with your own endpoint if needed) ────────
    const handleAddRating = () => {
        if (!rating.category || !rating.score || !selectedApplication) return;
        const updatedRatings = { ...(selectedApplication.ratings || {}), [rating.category]: rating.score };
        setApplications(prev => prev.map(app =>
            app.id === selectedApplication.id ? { ...app, ratings: updatedRatings } : app
        ));
        setSelectedApplication(prev => ({ ...prev, ratings: updatedRatings }));
        setRating({ category: '', score: 0, comment: '' });
        setSuccessMessage('Rating saved');
    };

    // ── Approve / Reject helpers ──────────────────────────────────────────────
    const handleApprove = () => {
        if (!selectedApplication) return;
        const idx = APPLICATION_STAGES.findIndex(s => s.id === selectedApplication.currentStage);
        if (idx < APPLICATION_STAGES.length - 2) {
            handleStageChange(selectedApplication.id, APPLICATION_STAGES[idx + 1].id);
        }
    };

    const handleReject = () => {
        if (!selectedApplication) return;
        handleStageChange(selectedApplication.id, 'rejected');
    };

    // ── Stage progress bar ────────────────────────────────────────────────────
    const StageProgress = ({ currentStage }) => {
        const currentIndex = APPLICATION_STAGES.findIndex(s => s.id === currentStage);
        return (
            <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '1rem', background: 'var(--bg-secondary)',
                borderRadius: '0.5rem', overflowX: 'auto', marginBottom: '1rem'
            }}>
                {APPLICATION_STAGES.map((stage, index) => {
                    const StageIcon = stage.icon;
                    const isCompleted = index < currentIndex;
                    const isCurrent   = index === currentIndex;
                    const isRejected  = stage.id === 'rejected';

                    return (
                        <React.Fragment key={stage.id}>
                            <div
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    minWidth: '80px', cursor: 'pointer',
                                    opacity: isRejected && currentStage !== 'rejected' ? 0.4 : 1
                                }}
                                onClick={() => !savingStage && handleStageChange(selectedApplication.id, stage.id)}
                            >
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '50%',
                                    background: isCompleted || isCurrent ? stage.color : 'var(--bg-tertiary)',
                                    color: isCompleted || isCurrent ? 'white' : 'var(--text-muted)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: isCurrent ? `3px solid ${stage.color}` : 'none',
                                    boxShadow: isCurrent ? '0 0 0 2px var(--bg-primary)' : 'none',
                                    transition: 'background 0.2s'
                                }}>
                                    <StageIcon size={20} />
                                </div>
                                <span style={{
                                    fontSize: '0.75rem', marginTop: '0.25rem',
                                    fontWeight: isCurrent ? 'bold' : 'normal',
                                    color: isCurrent ? stage.color : 'var(--text-muted)'
                                }}>
                                    {stage.label}
                                </span>
                            </div>
                            {index < APPLICATION_STAGES.length - 1 && (
                                <FiArrowRight style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="dashboard-page">
            <div className="container">
                {/* Header */}
                <div className="dashboard-header" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <h1 className="dashboard-title">Applicant Tracking System</h1>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            Manage and review candidate applications
                        </p>
                    </div>
                    <button className="btn btn-secondary" onClick={fetchApplications} disabled={loading}>
                        <FiRefreshCw size={14} style={{ marginRight: '0.4rem' }} />
                        {loading ? 'Loading…' : 'Refresh'}
                    </button>
                </div>

                {/* Error / success banners */}
                {error && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: '#fde8e8', color: '#c0392b', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                        <FiAlertCircle /> {error}
                        <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#c0392b' }}>✕</button>
                    </div>
                )}
                {successMessage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: '#e8f8f5', color: '#27ae60', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                        <FiCheckCircle /> {successMessage}
                    </div>
                )}

                {/* Stage stats */}
                <div className="companies-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginBottom: '1.5rem' }}>
                    {APPLICATION_STAGES.map(stage => {
                        const StageIcon = stage.icon;
                        return (
                            <div key={stage.id} className="card" style={{ borderLeft: `4px solid ${stage.color}` }}>
                                <div className="card-content" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ background: stage.color, width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                        <StageIcon size={18} />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.25rem', margin: 0 }}>{stats[stage.id] || 0}</h3>
                                        <p style={{ fontSize: '0.85rem', margin: 0, color: 'var(--text-muted)' }}>{stage.label}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Filters */}
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <div className="card-content">
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <div style={{ position: 'relative', flex: '1', minWidth: '250px' }}>
                                <FiSearch style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input className="form-input" placeholder="Search candidates, jobs, or departments…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ paddingLeft: '2.25rem', width: '100%' }} />
                            </div>
                            <select className="form-input" value={stageFilter} onChange={e => setStageFilter(e.target.value)} style={{ minWidth: '140px' }}>
                                <option value="all">All Stages</option>
                                {APPLICATION_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                            <select className="form-input" value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} style={{ minWidth: '140px' }}>
                                <option value="all">All Departments</option>
                                {departments.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <select className="form-input" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} style={{ minWidth: '140px' }}>
                                <option value="all">All Priorities</option>
                                <option value="high">High Priority</option>
                                <option value="medium">Medium Priority</option>
                                <option value="low">Low Priority</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="card">
                    <div className="card-content" style={{ overflowX: 'auto' }}>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                <FiRefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }} />
                                <p>Loading applications…</p>
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                <tr style={{ background: 'var(--bg-secondary)' }}>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Candidate</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Job / Department</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Stage</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Priority</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Applied</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Actions</th>
                                </tr>
                                </thead>
                                <tbody>
                                {filteredApplications.map(app => {
                                    const stage = APPLICATION_STAGES.find(s => s.id === app.currentStage) || APPLICATION_STAGES[0];
                                    const StageIcon = stage.icon;
                                    const nextStage = APPLICATION_STAGES[APPLICATION_STAGES.findIndex(s => s.id === app.currentStage) + 1];

                                    return (
                                        <tr key={app.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '0.75rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>
                                                        {app.firstName?.[0]}{app.lastName?.[0]}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 500 }}>{app.firstName} {app.lastName}</div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{app.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <div><strong>{app.jobTitle}</strong></div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{app.department}</div>
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem', background: stage.color + '20', color: stage.color, borderRadius: '1rem', fontSize: '0.85rem' }}>
                                                    <StageIcon size={14} /> <span>{stage.label}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: app.priority === 'high' ? '#e74c3c' : app.priority === 'medium' ? '#f39c12' : '#95a5a6', marginRight: '0.5rem' }} />
                                                {app.priority?.charAt(0).toUpperCase() + app.priority?.slice(1) || 'Normal'}
                                            </td>
                                            <td style={{ padding: '0.75rem', fontSize: '0.9rem' }}>
                                                {format(new Date(app.appliedDate), 'MMM dd, yyyy')}
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <div style={{ display: 'flex', gap: '0.35rem' }}>
                                                    <button className="btn btn-small" onClick={() => handleOpenApplication(app)} title="View">
                                                        <FiEye size={14} />
                                                    </button>
                                                    <button
                                                        className="btn btn-small btn-success"
                                                        onClick={() => nextStage && handleStageChange(app.id, nextStage.id)}
                                                        disabled={!nextStage || app.currentStage === 'hired' || app.currentStage === 'rejected' || savingStage}
                                                        title="Advance stage"
                                                    >
                                                        <FiThumbsUp size={14} />
                                                    </button>
                                                    <button
                                                        className="btn btn-small btn-danger"
                                                        onClick={() => handleStageChange(app.id, 'rejected')}
                                                        disabled={app.currentStage === 'rejected' || savingStage}
                                                        title="Reject"
                                                    >
                                                        <FiThumbsDown size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredApplications.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            No applications found. Applications submitted via the job board will appear here.
                                        </td>
                                    </tr>
                                )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Detail Modal ─────────────────────────────────────────────── */}
            {openDialog && selectedApplication && (
                <div className="modal-overlay" role="dialog" aria-modal="true">
                    <div className="modal-content" style={{ width: 'min(1200px, 95vw)', maxHeight: '90vh', overflowY: 'auto' }}>
                        {/* Modal header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border-color)', position: 'sticky', top: 0, background: 'var(--bg-primary)', zIndex: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 'bold' }}>
                                    {selectedApplication.firstName?.[0]}{selectedApplication.lastName?.[0]}
                                </div>
                                <div>
                                    <h2 style={{ margin: 0 }}>{selectedApplication.firstName} {selectedApplication.lastName}</h2>
                                    <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>
                                        {selectedApplication.jobTitle} • {selectedApplication.department}
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-success" onClick={handleApprove} disabled={savingStage}>
                                    <FiCheckCircle /> Approve
                                </button>
                                <button className="btn btn-danger" onClick={handleReject} disabled={savingStage}>
                                    <FiXCircle /> Reject
                                </button>
                                <button className="btn btn-secondary" onClick={handleCloseDialog}>Close</button>
                            </div>
                        </div>

                        {/* Stage progress */}
                        <div style={{ padding: '1rem 1rem 0' }}>
                            <StageProgress currentStage={selectedApplication.currentStage} />
                        </div>

                        {/* Tabs */}
                        <div style={{ display: 'flex', gap: '0.5rem', padding: '0 1rem', borderBottom: '1px solid var(--border-color)' }}>
                            {['details', 'notes', 'interviews', 'reviews'].map(tab => (
                                <button key={tab} className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab(tab)}
                                        style={{ borderRadius: 0, borderBottom: activeTab === tab ? '2px solid var(--primary)' : 'none' }}>
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>

                        {/* Tab content */}
                        <div style={{ padding: '1.5rem' }}>
                            {activeTab === 'details' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    <div>
                                        <h3 style={{ marginBottom: '1rem' }}>Personal Information</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {selectedApplication.email    && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FiMail style={{ color: 'var(--text-muted)' }} /><span>{selectedApplication.email}</span></div>}
                                            {selectedApplication.phone    && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FiPhone style={{ color: 'var(--text-muted)' }} /><span>{selectedApplication.phone}</span></div>}
                                            {selectedApplication.location && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FiMapPin style={{ color: 'var(--text-muted)' }} /><span>{selectedApplication.location}</span></div>}
                                            {(selectedApplication.currentCompany || selectedApplication.experience) && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <FiBriefcase style={{ color: 'var(--text-muted)' }} />
                                                    <span>{[selectedApplication.currentCompany, selectedApplication.currentPosition, selectedApplication.experience].filter(Boolean).join(' • ')}</span>
                                                </div>
                                            )}
                                        </div>

                                        {selectedApplication.skills?.length > 0 && (
                                            <>
                                                <h3 style={{ margin: '1.5rem 0 1rem' }}>Skills</h3>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                    {selectedApplication.skills.map((skill, i) => (
                                                        <span key={i} style={{ padding: '0.25rem 0.75rem', background: 'var(--bg-secondary)', borderRadius: '1rem', fontSize: '0.85rem' }}>{skill}</span>
                                                    ))}
                                                </div>
                                            </>
                                        )}

                                        {selectedApplication.education && (
                                            <>
                                                <h3 style={{ margin: '1.5rem 0 1rem' }}>Education</h3>
                                                <p>{selectedApplication.education}</p>
                                            </>
                                        )}
                                    </div>

                                    <div>
                                        <h3 style={{ marginBottom: '1rem' }}>Application Details</h3>
                                        <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                <div><div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Applied Date</div><div>{format(new Date(selectedApplication.appliedDate), 'MMM dd, yyyy')}</div></div>
                                                {selectedApplication.expectedSalary && <div><div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Expected Salary</div><div>{selectedApplication.expectedSalary}</div></div>}
                                                {selectedApplication.noticePeriod    && <div><div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Available From</div><div>{selectedApplication.noticePeriod}</div></div>}
                                                <div>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Priority</div>
                                                    <div style={{ color: selectedApplication.priority === 'high' ? '#e74c3c' : selectedApplication.priority === 'medium' ? '#f39c12' : 'inherit' }}>
                                                        {selectedApplication.priority?.toUpperCase()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {selectedApplication.coverLetter && (
                                            <>
                                                <h3 style={{ margin: '1.5rem 0 1rem' }}>Cover Letter</h3>
                                                <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>{selectedApplication.coverLetter}</p>
                                            </>
                                        )}

                                        <h3 style={{ margin: '1.5rem 0 1rem' }}>Links</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {selectedApplication.resumeUrl   && <a href={selectedApplication.resumeUrl}   target="_blank" rel="noopener noreferrer"><FiDownload /> Resume</a>}
                                            {selectedApplication.linkedInUrl && <a href={selectedApplication.linkedInUrl} target="_blank" rel="noopener noreferrer">LinkedIn Profile</a>}
                                            {selectedApplication.githubUrl   && <a href={selectedApplication.githubUrl}   target="_blank" rel="noopener noreferrer">GitHub Profile</a>}
                                            {selectedApplication.portfolioUrl && <a href={selectedApplication.portfolioUrl} target="_blank" rel="noopener noreferrer">Portfolio</a>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'notes' && (
                                <div>
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <h3>Add Note</h3>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            <textarea className="form-textarea" value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note about this candidate…" rows={3} style={{ flex: 1 }} />
                                            <button className="btn btn-primary" onClick={handleAddNote} disabled={savingNote || !newNote.trim()}>
                                                {savingNote ? 'Saving…' : 'Add Note'}
                                            </button>
                                        </div>
                                    </div>
                                    <h3>Notes History</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                                        {(selectedApplication.notes || []).length === 0 && <p style={{ color: 'var(--text-muted)' }}>No notes yet.</p>}
                                        {(selectedApplication.notes || []).map((note, i) => (
                                            <div key={note.id || i} style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                    <span style={{ fontWeight: 500 }}>{note.author}</span>
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{format(new Date(note.date), 'MMM dd, yyyy HH:mm')}</span>
                                                </div>
                                                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{note.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'interviews' && (
                                <div>
                                    <h3>Scheduled Interviews</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                                        {(selectedApplication.interviews || []).length === 0 && <p style={{ color: 'var(--text-muted)' }}>No interviews scheduled yet.</p>}
                                        {(selectedApplication.interviews || []).map((interview, i) => (
                                            <div key={interview.id || i} style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <h4 style={{ margin: '0 0 0.25rem' }}>{interview.type || interview.interview_type}</h4>
                                                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>with {interview.interviewer || interview.interviewer_name}</p>
                                                    </div>
                                                    <span style={{ padding: '0.25rem 0.5rem', background: interview.status === 'scheduled' ? '#f39c12' : '#2ecc71', color: 'white', borderRadius: '1rem', fontSize: '0.85rem' }}>
                                                        {interview.status}
                                                    </span>
                                                </div>
                                                {(interview.date || interview.scheduled_at) && (
                                                    <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                                                        <FiCalendar style={{ marginRight: '0.35rem' }} />
                                                        {format(new Date(interview.date || interview.scheduled_at), 'MMM dd, yyyy HH:mm')}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'reviews' && (
                                <div>
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <h3>Add Rating</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            <select className="form-input" value={rating.category} onChange={e => setRating({ ...rating, category: e.target.value })}>
                                                <option value="">Select Category</option>
                                                <option value="technical">Technical Skills</option>
                                                <option value="communication">Communication</option>
                                                <option value="experience">Experience</option>
                                                <option value="culture">Culture Fit</option>
                                                <option value="leadership">Leadership</option>
                                            </select>
                                            <select className="form-input" value={rating.score} onChange={e => setRating({ ...rating, score: parseInt(e.target.value) })}>
                                                <option value="0">Select Rating</option>
                                                {[1, 2, 3, 4, 5].map(s => <option key={s} value={s}>{s} Star{s > 1 ? 's' : ''}</option>)}
                                            </select>
                                            <button className="btn btn-primary" onClick={handleAddRating} disabled={!rating.category || !rating.score}>Add Rating</button>
                                        </div>
                                    </div>
                                    <h3>Ratings</h3>
                                    {Object.keys(selectedApplication.ratings || {}).length === 0 && <p style={{ color: 'var(--text-muted)' }}>No ratings yet.</p>}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                                        {Object.entries(selectedApplication.ratings || {}).map(([cat, score]) => (
                                            <div key={cat} style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem', textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</div>
                                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{score}/5</div>
                                                <div style={{ color: '#f39c12' }}>{'★'.repeat(score)}{'☆'.repeat(5 - score)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default Applications;