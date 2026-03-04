// frontend/src/pages/hr/Applications.jsx
import React, { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';

const STORAGE_KEY = 'hrApplications';

const EMPTY_FORM = {
    jobTitle: '',
    department: '',
    position: '',
    description: '',
    requirements: '',
    responsibilities: '',
    location: '',
    employmentType: 'full-time',
    experienceLevel: 'entry',
    salaryMin: '',
    salaryMax: '',
    currency: 'USD',
    applicationDeadline: '',
    status: 'active',
    questions: []
};

const Applications = () => {
    const [applications, setApplications] = useState([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedApplication, setSelectedApplication] = useState(null);
    const [viewMode, setViewMode] = useState('create'); // create | edit | view
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        try {
            const savedApplications = localStorage.getItem(STORAGE_KEY);
            if (!savedApplications) return;
            const parsed = JSON.parse(savedApplications);
            if (Array.isArray(parsed)) {
                setApplications(parsed);
            }
        } catch (err) {
            console.error('Failed to load applications from storage', err);
            setError('Could not load saved applications.');
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
    }, [applications]);

    const filteredApplications = useMemo(() => {
        return applications.filter((app) => {
            const matchesSearch =
                app.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                app.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                app.position?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = statusFilter === 'all' ? true : app.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [applications, searchTerm, statusFilter]);

    const stats = useMemo(() => {
        const total = applications.length;
        const active = applications.filter((app) => app.status === 'active').length;
        const applicants = applications.reduce((sum, app) => sum + Number(app.applicants || 0), 0);
        return { total, active, applicants };
    }, [applications]);

    const handleOpenDialog = (mode, application = null) => {
        setError('');
        setSuccessMessage('');
        setViewMode(mode);

        if (application) {
            setSelectedApplication(application);
            setFormData({ ...EMPTY_FORM, ...application });
        } else {
            setSelectedApplication(null);
            setFormData(EMPTY_FORM);
        }

        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setSelectedApplication(null);
        setViewMode('create');
        setFormData(EMPTY_FORM);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const validateForm = () => {
        if (!formData.jobTitle || !formData.department || !formData.position) {
            return 'Please fill in all required fields.';
        }

        if (formData.salaryMin && formData.salaryMax && Number(formData.salaryMin) > Number(formData.salaryMax)) {
            return 'Salary min cannot be greater than salary max.';
        }

        if (formData.applicationDeadline) {
            const chosenDate = new Date(formData.applicationDeadline);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (chosenDate < today && viewMode === 'create') {
                return 'Application deadline must be today or a future date.';
            }
        }

        return null;
    };

    const handleSubmit = () => {
        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        const generatedId = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : Date.now().toString();

        const updatedApplication = {
            ...formData,
            id: selectedApplication?.id || generatedId,
            createdAt: selectedApplication?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: selectedApplication?.createdBy || 'Current HR User',
            applicants: selectedApplication?.applicants || 0
        };

        if (viewMode === 'edit' && selectedApplication) {
            setApplications((prev) =>
                prev.map((app) => (app.id === selectedApplication.id ? updatedApplication : app))
            );
            setSuccessMessage('Application updated successfully.');
        } else {
            setApplications((prev) => [...prev, updatedApplication]);
            setSuccessMessage('Job application created successfully.');
        }

        handleCloseDialog();
    };

    const handleDelete = (id) => {
        if (!window.confirm('Are you sure you want to delete this job application?')) return;

        setApplications((prev) => prev.filter((app) => app.id !== id));
        setSuccessMessage('Job application deleted successfully.');
        setError('');
    };

    return (
        <div className="dashboard-page">
            <div className="container">
                <div className="dashboard-header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <h1 className="dashboard-title">Job Applications Management</h1>
                    <button className="btn btn-primary" onClick={() => handleOpenDialog('create')}>
                        + Create New Application
                    </button>
                </div>

                {(error || successMessage) && (
                    <div style={{ marginBottom: '1rem' }}>
                        {error && <div className="alert alert-error">{error}</div>}
                        {successMessage && <div className="alert alert-success">{successMessage}</div>}
                    </div>
                )}

                <div className="companies-grid" style={{ marginBottom: '1rem' }}>
                    <div className="card"><div className="card-content"><h3>Total Applications</h3><p>{stats.total}</p></div></div>
                    <div className="card"><div className="card-content"><h3>Active Jobs</h3><p>{stats.active}</p></div></div>
                    <div className="card"><div className="card-content"><h3>Total Applicants</h3><p>{stats.applicants}</p></div></div>
                    <div className="card"><div className="card-content"><h3>Open Positions</h3><p>{stats.active}</p></div></div>
                </div>

                <div className="card" style={{ marginBottom: '1rem' }}>
                    <div className="card-content" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <input
                            className="form-input"
                            placeholder="Search job title, department, or position..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ maxWidth: '420px' }}
                        />
                        <select
                            className="form-input"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{ maxWidth: '220px' }}
                        >
                            <option value="all">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="closed">Closed</option>
                            <option value="draft">Draft</option>
                        </select>
                    </div>
                </div>

                <div className="card">
                    <div className="card-content" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Job Title</th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Department</th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Position</th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Type</th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Status</th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Applicants</th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Created</th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredApplications.map((app) => (
                                    <tr key={app.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '0.5rem' }}>{app.jobTitle}</td>
                                        <td style={{ padding: '0.5rem' }}>{app.department}</td>
                                        <td style={{ padding: '0.5rem' }}>{app.position}</td>
                                        <td style={{ padding: '0.5rem' }}>{app.employmentType}</td>
                                        <td style={{ padding: '0.5rem' }}>{app.status}</td>
                                        <td style={{ padding: '0.5rem' }}>{app.applicants || 0}</td>
                                        <td style={{ padding: '0.5rem' }}>
                                            {app.createdAt ? format(new Date(app.createdAt), 'MM/dd/yyyy') : '-'}
                                        </td>
                                        <td style={{ padding: '0.5rem', display: 'flex', gap: '0.35rem' }}>
                                            <button className="btn btn-small" onClick={() => handleOpenDialog('view', app)}>View</button>
                                            <button className="btn btn-small btn-secondary" onClick={() => handleOpenDialog('edit', app)}>Edit</button>
                                            <button className="btn btn-small btn-danger" onClick={() => handleDelete(app.id)}>Delete</button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredApplications.length === 0 && (
                                    <tr>
                                        <td colSpan={8} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            No job applications found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {openDialog && (
                <div className="modal-overlay" role="dialog" aria-modal="true">
                    <div className="modal-content" style={{ width: 'min(920px, 95vw)' }}>
                        <h3 style={{ marginBottom: '1rem' }}>
                            {viewMode === 'create' && 'Create New Job Application'}
                            {viewMode === 'edit' && 'Edit Job Application'}
                            {viewMode === 'view' && 'View Job Application'}
                        </h3>

                        <div className="companies-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <input className="form-input" name="jobTitle" placeholder="Job Title *" value={formData.jobTitle} onChange={handleInputChange} disabled={viewMode === 'view'} />
                            <input className="form-input" name="department" placeholder="Department *" value={formData.department} onChange={handleInputChange} disabled={viewMode === 'view'} />
                            <input className="form-input" name="position" placeholder="Position *" value={formData.position} onChange={handleInputChange} disabled={viewMode === 'view'} />
                            <input className="form-input" name="location" placeholder="Location" value={formData.location} onChange={handleInputChange} disabled={viewMode === 'view'} />

                            <select className="form-input" name="employmentType" value={formData.employmentType} onChange={handleInputChange} disabled={viewMode === 'view'}>
                                <option value="full-time">Full Time</option>
                                <option value="part-time">Part Time</option>
                                <option value="contract">Contract</option>
                                <option value="internship">Internship</option>
                            </select>

                            <select className="form-input" name="experienceLevel" value={formData.experienceLevel} onChange={handleInputChange} disabled={viewMode === 'view'}>
                                <option value="entry">Entry Level</option>
                                <option value="mid">Mid Level</option>
                                <option value="senior">Senior Level</option>
                                <option value="lead">Lead / Manager</option>
                            </select>

                            <input className="form-input" type="number" name="salaryMin" placeholder="Salary Min" value={formData.salaryMin} onChange={handleInputChange} disabled={viewMode === 'view'} />
                            <input className="form-input" type="number" name="salaryMax" placeholder="Salary Max" value={formData.salaryMax} onChange={handleInputChange} disabled={viewMode === 'view'} />

                            <select className="form-input" name="currency" value={formData.currency} onChange={handleInputChange} disabled={viewMode === 'view'}>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                            </select>

                            <input className="form-input" type="date" name="applicationDeadline" value={formData.applicationDeadline} onChange={handleInputChange} disabled={viewMode === 'view'} />

                            <select className="form-input" name="status" value={formData.status} onChange={handleInputChange} disabled={viewMode === 'view'}>
                                <option value="active">Active</option>
                                <option value="closed">Closed</option>
                                <option value="draft">Draft</option>
                            </select>
                        </div>

                        <textarea className="form-textarea" name="description" placeholder="Job Description" value={formData.description} onChange={handleInputChange} disabled={viewMode === 'view'} rows={4} style={{ marginTop: '0.75rem' }} />
                        <textarea className="form-textarea" name="requirements" placeholder="Requirements" value={formData.requirements} onChange={handleInputChange} disabled={viewMode === 'view'} rows={4} style={{ marginTop: '0.75rem' }} />
                        <textarea className="form-textarea" name="responsibilities" placeholder="Responsibilities" value={formData.responsibilities} onChange={handleInputChange} disabled={viewMode === 'view'} rows={4} style={{ marginTop: '0.75rem' }} />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                            <button className="btn btn-secondary" onClick={handleCloseDialog}>Cancel</button>
                            {viewMode !== 'view' && (
                                <button className="btn btn-primary" onClick={handleSubmit}>
                                    {viewMode === 'create' ? 'Create' : 'Save Changes'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Applications;
