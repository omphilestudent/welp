// frontend/src/pages/hr/Applications.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';

const STORAGE_KEYS = {
    jobs: 'hrJobs',
    external: 'hrExternalApplications',
    internal: 'hrInternalApplications'
};

const PIPELINE_STAGES = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];

const EMPTY_JOB = {
    title: '',
    department: '',
    location: '',
    employmentType: 'full-time',
    description: '',
    status: 'active'
};

const EMPTY_EXTERNAL_APPLICATION = {
    candidateName: '',
    email: '',
    phone: '',
    jobId: '',
    notes: ''
};

const EMPTY_INTERNAL_APPLICATION = {
    employeeName: '',
    employeeId: '',
    currentDepartment: '',
    currentRole: '',
    jobId: '',
    managerApproval: 'pending',
    notes: ''
};

const safeParseArray = (value) => {
    if (!value) return [];

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
};

const Applications = () => {
    const [activeTab, setActiveTab] = useState('jobs');

    const [jobs, setJobs] = useState([]);
    const [externalApplications, setExternalApplications] = useState([]);
    const [internalApplications, setInternalApplications] = useState([]);

    const [jobModalOpen, setJobModalOpen] = useState(false);
    const [editingJob, setEditingJob] = useState(null);
    const [jobForm, setJobForm] = useState(EMPTY_JOB);

    const [externalModalOpen, setExternalModalOpen] = useState(false);
    const [externalForm, setExternalForm] = useState(EMPTY_EXTERNAL_APPLICATION);

    const [internalModalOpen, setInternalModalOpen] = useState(false);
    const [internalForm, setInternalForm] = useState(EMPTY_INTERNAL_APPLICATION);

    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        const savedJobs = safeParseArray(localStorage.getItem(STORAGE_KEYS.jobs));
        const savedExternal = safeParseArray(localStorage.getItem(STORAGE_KEYS.external));
        const savedInternal = safeParseArray(localStorage.getItem(STORAGE_KEYS.internal));

        setJobs(savedJobs);
        setExternalApplications(savedExternal);
        setInternalApplications(savedInternal);
    }, []);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.jobs, JSON.stringify(jobs));
    }, [jobs]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.external, JSON.stringify(externalApplications));
    }, [externalApplications]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEYS.internal, JSON.stringify(internalApplications));
    }, [internalApplications]);

    const stats = useMemo(() => ({
        totalJobs: jobs.length,
        activeJobs: jobs.filter((job) => job.status === 'active').length,
        externalCount: externalApplications.length,
        internalCount: internalApplications.length,
        hiredCount: [...externalApplications, ...internalApplications].filter((app) => app.stage === 'Hired').length
    }), [jobs, externalApplications, internalApplications]);

    const jobsById = useMemo(() => {
        return jobs.reduce((acc, job) => {
            acc[job.id] = job;
            return acc;
        }, {});
    }, [jobs]);

    const setNotification = (message, type = 'success') => {
        setError(type === 'error' ? message : '');
        setSuccessMessage(type === 'success' ? message : '');
    };

    const createId = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `${Date.now()}-${Math.round(Math.random() * 10000)}`;
    };

    const handleJobSubmit = () => {
        if (!jobForm.title || !jobForm.department || !jobForm.location) {
            setNotification('Please complete required job fields.', 'error');
            return;
        }

        const payload = {
            ...jobForm,
            id: editingJob?.id || createId(),
            createdAt: editingJob?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            applicants: editingJob?.applicants || 0
        };

        if (editingJob) {
            setJobs((prev) => prev.map((job) => (job.id === editingJob.id ? payload : job)));
            setNotification('Job posting updated.');
        } else {
            setJobs((prev) => [payload, ...prev]);
            setNotification('Job posting created.');
        }

        setJobForm(EMPTY_JOB);
        setEditingJob(null);
        setJobModalOpen(false);
    };

    const openJobModal = (job = null) => {
        setError('');
        setSuccessMessage('');

        if (job) {
            setEditingJob(job);
            setJobForm({ ...job });
        } else {
            setEditingJob(null);
            setJobForm(EMPTY_JOB);
        }

        setJobModalOpen(true);
    };

    const handleDeleteJob = (jobId) => {
        if (!window.confirm('Delete this job posting?')) return;

        setJobs((prev) => prev.filter((job) => job.id !== jobId));
        setExternalApplications((prev) => prev.filter((app) => app.jobId !== jobId));
        setInternalApplications((prev) => prev.filter((app) => app.jobId !== jobId));
        setNotification('Job posting and related applications removed.');
    };

    const handleExternalSubmit = () => {
        if (!externalForm.candidateName || !externalForm.email || !externalForm.jobId) {
            setNotification('Please complete required external applicant fields.', 'error');
            return;
        }

        const payload = {
            ...externalForm,
            id: createId(),
            source: 'external',
            stage: 'Applied',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        setExternalApplications((prev) => [payload, ...prev]);
        setExternalForm(EMPTY_EXTERNAL_APPLICATION);
        setExternalModalOpen(false);
        setNotification('External application added.');
    };

    const handleInternalSubmit = () => {
        if (!internalForm.employeeName || !internalForm.employeeId || !internalForm.jobId) {
            setNotification('Please complete required internal applicant fields.', 'error');
            return;
        }

        const payload = {
            ...internalForm,
            id: createId(),
            source: 'internal',
            stage: 'Applied',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        setInternalApplications((prev) => [payload, ...prev]);
        setInternalForm(EMPTY_INTERNAL_APPLICATION);
        setInternalModalOpen(false);
        setNotification('Internal employee application added.');
    };

    const advanceStage = (listType, applicationId, direction = 'next') => {
        const setter = listType === 'external' ? setExternalApplications : setInternalApplications;

        setter((prev) => prev.map((app) => {
            if (app.id !== applicationId) return app;

            const currentIndex = PIPELINE_STAGES.indexOf(app.stage || 'Applied');
            const nextIndex = direction === 'next'
                ? Math.min(currentIndex + 1, PIPELINE_STAGES.length - 1)
                : Math.max(currentIndex - 1, 0);

            return {
                ...app,
                stage: PIPELINE_STAGES[nextIndex],
                updatedAt: new Date().toISOString()
            };
        }));
    };

    const updateStageFromPicklist = (listType, applicationId, stage) => {
        const setter = listType === 'external' ? setExternalApplications : setInternalApplications;

        setter((prev) => prev.map((app) => (
            app.id === applicationId
                ? { ...app, stage, updatedAt: new Date().toISOString() }
                : app
        )));
    };

    const renderStagePath = (application, listType) => {
        const currentIndex = PIPELINE_STAGES.indexOf(application.stage || 'Applied');

        return (
            <div style={{ marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                    {PIPELINE_STAGES.map((stage, idx) => (
                        <span
                            key={stage}
                            style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '999px',
                                fontSize: '0.75rem',
                                border: '1px solid var(--border-color)',
                                background: idx <= currentIndex ? 'var(--accent-color)' : 'var(--bg-secondary)',
                                color: idx <= currentIndex ? 'var(--button-text)' : 'var(--text-secondary)'
                            }}
                        >
                            {stage}{idx < PIPELINE_STAGES.length - 1 ? ' →' : ''}
                        </span>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-small btn-secondary" onClick={() => advanceStage(listType, application.id, 'prev')}>
                        ← Back
                    </button>

                    <select
                        className="form-input"
                        style={{ maxWidth: '220px', padding: '0.35rem 0.5rem' }}
                        value={application.stage || 'Applied'}
                        onChange={(e) => updateStageFromPicklist(listType, application.id, e.target.value)}
                    >
                        {PIPELINE_STAGES.map((stage) => (
                            <option key={stage} value={stage}>{stage}</option>
                        ))}
                    </select>

                    <button className="btn btn-small btn-primary" onClick={() => advanceStage(listType, application.id, 'next')}>
                        Next →
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="dashboard-page">
            <div className="container">
                <div className="dashboard-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1 className="dashboard-title">HR Hiring Workspace</h1>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary" onClick={() => setActiveTab('jobs')}>Job Postings</button>
                        <button className="btn btn-secondary" onClick={() => setActiveTab('external')}>External Candidates</button>
                        <button className="btn btn-secondary" onClick={() => setActiveTab('internal')}>Internal Employees</button>
                    </div>
                </div>

                {(error || successMessage) && (
                    <div style={{ marginBottom: '1rem' }}>
                        {error && <div className="alert alert-error">{error}</div>}
                        {successMessage && <div className="alert alert-success">{successMessage}</div>}
                    </div>
                )}

                <div className="companies-grid" style={{ marginBottom: '1rem' }}>
                    <div className="card"><div className="card-content"><h3>Total Jobs</h3><p>{stats.totalJobs}</p></div></div>
                    <div className="card"><div className="card-content"><h3>Active Jobs</h3><p>{stats.activeJobs}</p></div></div>
                    <div className="card"><div className="card-content"><h3>External Applications</h3><p>{stats.externalCount}</p></div></div>
                    <div className="card"><div className="card-content"><h3>Internal Applications</h3><p>{stats.internalCount}</p></div></div>
                    <div className="card"><div className="card-content"><h3>Hired (Pipeline)</h3><p>{stats.hiredCount}</p></div></div>
                </div>

                {activeTab === 'jobs' && (
                    <div className="card">
                        <div className="card-content">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <h3>Job Postings</h3>
                                <button className="btn btn-primary" onClick={() => openJobModal()}>+ New Job Posting</button>
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Title</th>
                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Department</th>
                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Location</th>
                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Type</th>
                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Status</th>
                                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {jobs.map((job) => (
                                        <tr key={job.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '0.5rem' }}>{job.title}</td>
                                            <td style={{ padding: '0.5rem' }}>{job.department}</td>
                                            <td style={{ padding: '0.5rem' }}>{job.location}</td>
                                            <td style={{ padding: '0.5rem' }}>{job.employmentType}</td>
                                            <td style={{ padding: '0.5rem' }}>{job.status}</td>
                                            <td style={{ padding: '0.5rem', display: 'flex', gap: '0.4rem' }}>
                                                <button className="btn btn-small btn-secondary" onClick={() => openJobModal(job)}>Edit</button>
                                                <button className="btn btn-small btn-danger" onClick={() => handleDeleteJob(job.id)}>Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {jobs.length === 0 && (
                                        <tr>
                                            <td colSpan={6} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                No jobs yet. Create your first job posting.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'external' && (
                    <div className="card">
                        <div className="card-content">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <h3>External Candidate Applications</h3>
                                <button className="btn btn-primary" onClick={() => setExternalModalOpen(true)}>+ Add External Application</button>
                            </div>

                            {externalApplications.map((app) => (
                                <div key={app.id} className="request-card" style={{ marginBottom: '0.75rem' }}>
                                    <div className="request-info">
                                        <h4>{app.candidateName}</h4>
                                        <p>{app.email} {app.phone ? `• ${app.phone}` : ''}</p>
                                        <p className="request-date">
                                            Applied for: <strong>{jobsById[app.jobId]?.title || 'Unknown Role'}</strong> • {format(new Date(app.createdAt), 'PPpp')}
                                        </p>
                                    </div>
                                    {renderStagePath(app, 'external')}
                                </div>
                            ))}

                            {externalApplications.length === 0 && (
                                <p className="empty-message">No external applications yet.</p>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'internal' && (
                    <div className="card">
                        <div className="card-content">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <h3>Internal Employee Applications</h3>
                                <button className="btn btn-primary" onClick={() => setInternalModalOpen(true)}>+ Add Internal Application</button>
                            </div>

                            {internalApplications.map((app) => (
                                <div key={app.id} className="request-card" style={{ marginBottom: '0.75rem' }}>
                                    <div className="request-info">
                                        <h4>{app.employeeName} ({app.employeeId})</h4>
                                        <p>{app.currentRole} • {app.currentDepartment}</p>
                                        <p className="request-date">
                                            Applied for: <strong>{jobsById[app.jobId]?.title || 'Unknown Role'}</strong> • Manager approval: <strong>{app.managerApproval}</strong>
                                        </p>
                                    </div>
                                    {renderStagePath(app, 'internal')}
                                </div>
                            ))}

                            {internalApplications.length === 0 && (
                                <p className="empty-message">No internal applications yet.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {jobModalOpen && (
                <div className="modal-overlay" role="dialog" aria-modal="true">
                    <div className="modal-content" style={{ width: 'min(760px, 95vw)' }}>
                        <h3>{editingJob ? 'Edit Job Posting' : 'Create Job Posting'}</h3>
                        <div className="companies-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                            <input className="form-input" placeholder="Job Title *" value={jobForm.title} onChange={(e) => setJobForm((p) => ({ ...p, title: e.target.value }))} />
                            <input className="form-input" placeholder="Department *" value={jobForm.department} onChange={(e) => setJobForm((p) => ({ ...p, department: e.target.value }))} />
                            <input className="form-input" placeholder="Location *" value={jobForm.location} onChange={(e) => setJobForm((p) => ({ ...p, location: e.target.value }))} />
                            <select className="form-input" value={jobForm.employmentType} onChange={(e) => setJobForm((p) => ({ ...p, employmentType: e.target.value }))}>
                                <option value="full-time">Full Time</option>
                                <option value="part-time">Part Time</option>
                                <option value="contract">Contract</option>
                                <option value="internship">Internship</option>
                            </select>
                            <select className="form-input" value={jobForm.status} onChange={(e) => setJobForm((p) => ({ ...p, status: e.target.value }))}>
                                <option value="active">Active</option>
                                <option value="closed">Closed</option>
                                <option value="draft">Draft</option>
                            </select>
                        </div>
                        <textarea className="form-textarea" rows={4} placeholder="Job description" value={jobForm.description} onChange={(e) => setJobForm((p) => ({ ...p, description: e.target.value }))} style={{ marginTop: '0.75rem' }} />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                            <button className="btn btn-secondary" onClick={() => setJobModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleJobSubmit}>{editingJob ? 'Save' : 'Create'}</button>
                        </div>
                    </div>
                </div>
            )}

            {externalModalOpen && (
                <div className="modal-overlay" role="dialog" aria-modal="true">
                    <div className="modal-content" style={{ width: 'min(720px, 95vw)' }}>
                        <h3>Add External Candidate Application</h3>
                        <div className="companies-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                            <input className="form-input" placeholder="Candidate Name *" value={externalForm.candidateName} onChange={(e) => setExternalForm((p) => ({ ...p, candidateName: e.target.value }))} />
                            <input className="form-input" placeholder="Email *" value={externalForm.email} onChange={(e) => setExternalForm((p) => ({ ...p, email: e.target.value }))} />
                            <input className="form-input" placeholder="Phone" value={externalForm.phone} onChange={(e) => setExternalForm((p) => ({ ...p, phone: e.target.value }))} />
                            <select className="form-input" value={externalForm.jobId} onChange={(e) => setExternalForm((p) => ({ ...p, jobId: e.target.value }))}>
                                <option value="">Select Job *</option>
                                {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
                            </select>
                        </div>
                        <textarea className="form-textarea" rows={3} placeholder="Notes" value={externalForm.notes} onChange={(e) => setExternalForm((p) => ({ ...p, notes: e.target.value }))} style={{ marginTop: '0.75rem' }} />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                            <button className="btn btn-secondary" onClick={() => setExternalModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleExternalSubmit}>Add Application</button>
                        </div>
                    </div>
                </div>
            )}

            {internalModalOpen && (
                <div className="modal-overlay" role="dialog" aria-modal="true">
                    <div className="modal-content" style={{ width: 'min(760px, 95vw)' }}>
                        <h3>Add Internal Employee Application</h3>
                        <div className="companies-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                            <input className="form-input" placeholder="Employee Name *" value={internalForm.employeeName} onChange={(e) => setInternalForm((p) => ({ ...p, employeeName: e.target.value }))} />
                            <input className="form-input" placeholder="Employee ID *" value={internalForm.employeeId} onChange={(e) => setInternalForm((p) => ({ ...p, employeeId: e.target.value }))} />
                            <input className="form-input" placeholder="Current Department" value={internalForm.currentDepartment} onChange={(e) => setInternalForm((p) => ({ ...p, currentDepartment: e.target.value }))} />
                            <input className="form-input" placeholder="Current Role" value={internalForm.currentRole} onChange={(e) => setInternalForm((p) => ({ ...p, currentRole: e.target.value }))} />
                            <select className="form-input" value={internalForm.jobId} onChange={(e) => setInternalForm((p) => ({ ...p, jobId: e.target.value }))}>
                                <option value="">Select Job *</option>
                                {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
                            </select>
                            <select className="form-input" value={internalForm.managerApproval} onChange={(e) => setInternalForm((p) => ({ ...p, managerApproval: e.target.value }))}>
                                <option value="pending">Manager Approval Pending</option>
                                <option value="approved">Manager Approved</option>
                                <option value="rejected">Manager Rejected</option>
                            </select>
                        </div>
                        <textarea className="form-textarea" rows={3} placeholder="Notes" value={internalForm.notes} onChange={(e) => setInternalForm((p) => ({ ...p, notes: e.target.value }))} style={{ marginTop: '0.75rem' }} />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                            <button className="btn btn-secondary" onClick={() => setInternalModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleInternalSubmit}>Add Internal Application</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Applications;
