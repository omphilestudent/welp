import React, { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
    FiCheckCircle,
    FiXCircle,
    FiClock,
    FiUser,
    FiMail,
    FiPhone,
    FiMapPin,
    FiBriefcase,
    FiDownload,
    FiStar,
    FiMessageSquare,
    FiCalendar,
    FiArrowRight,
    FiChevronDown,
    FiFilter,
    FiSearch,
    FiEye,
    FiThumbsUp,
    FiThumbsDown,
    FiUpload,
    FiFileText,
    FiAward
} from 'react-icons/fi';
import api from '../../services/api';

// Application stages for the workflow
const APPLICATION_STAGES = [
    { id: 'new', label: 'New', color: '#3498db', icon: FiClock },
    { id: 'screening', label: 'Screening', color: '#f39c12', icon: FiUser },
    { id: 'interview', label: 'Interview', color: '#9b59b6', icon: FiCalendar },
    { id: 'technical', label: 'Technical', color: '#e74c3c', icon: FiBriefcase },
    { id: 'offer', label: 'Offer', color: '#2ecc71', icon: FiAward },
    { id: 'hired', label: 'Hired', color: '#27ae60', icon: FiCheckCircle },
    { id: 'rejected', label: 'Rejected', color: '#e74c3c', icon: FiXCircle }
];

const STATUS_TO_STAGE = {
    pending: 'new',
    reviewed: 'screening',
    shortlisted: 'interview',
    interviewed: 'technical',
    hired: 'hired',
    rejected: 'rejected'
};

const STAGE_TO_STATUS = {
    new: 'pending',
    screening: 'reviewed',
    interview: 'shortlisted',
    technical: 'interviewed',
    offer: 'interviewed',
    hired: 'hired',
    rejected: 'rejected'
};

const EMPTY_FORM = {
    // Job Details
    jobTitle: '',
    department: '',
    position: '',

    // Applicant Personal Details
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    location: '',

    // Professional Details
    experience: '',
    education: '',
    skills: [],
    expectedSalary: '',
    currentCompany: '',
    noticePeriod: '',

    // Application Details
    coverLetter: '',
    resumeUrl: '',
    portfolioUrl: '',
    linkedInUrl: '',
    githubUrl: '',

    // Workflow
    currentStage: 'new',
    stageHistory: [],
    priority: 'medium',
    tags: [],

    // Review
    notes: [],
    ratings: {},
    interviews: [],

    status: 'active',
    appliedDate: new Date().toISOString(),

    // Metadata
    createdBy: 'Current HR User',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
};

const Applications = () => {
    const [applications, setApplications] = useState([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedApplication, setSelectedApplication] = useState(null);
    const [viewMode, setViewMode] = useState('view'); // view, edit, review
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [searchTerm, setSearchTerm] = useState('');
    const [stageFilter, setStageFilter] = useState('all');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [activeTab, setActiveTab] = useState('details'); // details, notes, interviews, reviews
    const [newNote, setNewNote] = useState('');
    const [rating, setRating] = useState({ category: '', score: 0, comment: '' });

    const parseNotes = (notes) => {
        if (!notes) return [];
        if (Array.isArray(notes)) return notes;
        return String(notes)
            .split('\n')
            .filter((line) => line.trim())
            .map((line, index) => ({
                id: `${index}-${Date.now()}`,
                author: 'HR',
                content: line,
                date: new Date().toISOString()
            }));
    };

    const normalizeApplication = (app = {}) => {
        const status = String(app.status || 'pending').toLowerCase();
        const currentStage = STATUS_TO_STAGE[status] || 'new';
        return {
            id: app.id,
            jobTitle: app.job_title || app.jobTitle || '',
            department: app.department_name || app.department || '',
            position: app.current_position || app.position || app.job_title || '',
            firstName: app.first_name || app.firstName || '',
            lastName: app.last_name || app.lastName || '',
            email: app.email || '',
            phone: app.phone || '',
            location: app.location || '',
            experience: app.years_experience ? `${app.years_experience} years` : app.experience || '',
            education: app.education || '',
            skills: Array.isArray(app.skills) ? app.skills : [],
            expectedSalary: app.salary_expectation || app.expectedSalary || '',
            currentCompany: app.current_company || app.currentCompany || '',
            noticePeriod: app.available_start_date || app.noticePeriod || '',
            coverLetter: app.cover_letter || app.coverLetter || '',
            resumeUrl: app.resume_url || app.resumeUrl || '',
            linkedInUrl: app.linkedin_url || app.linkedInUrl || '',
            githubUrl: app.github_url || app.githubUrl || '',
            portfolioUrl: app.portfolio_url || app.portfolioUrl || '',
            currentStage,
            stageHistory: Array.isArray(app.stageHistory) ? app.stageHistory : [],
            priority: app.priority || 'medium',
            tags: Array.isArray(app.tags) ? app.tags : [],
            notes: parseNotes(app.notes),
            ratings: app.ratings || {},
            interviews: Array.isArray(app.interviews) ? app.interviews : [],
            status: app.status || 'pending',
            appliedDate: app.created_at || app.appliedDate || new Date().toISOString(),
            createdAt: app.created_at || app.createdAt || new Date().toISOString(),
            updatedAt: app.updated_at || app.updatedAt || new Date().toISOString(),
            createdBy: app.created_by || app.createdBy || 'HR System'
        };
    };

    const fetchApplications = async () => {
        try {
            const { data } = await api.get('/hr/applications');
            const rows = Array.isArray(data) ? data : data?.data || [];
            setApplications(rows.map(normalizeApplication));
        } catch (err) {
            console.error('Failed to load applications', err);
            setError(err?.response?.data?.error || 'Could not load applications.');
        }
    };

    useEffect(() => {
        fetchApplications();
    }, []);

    // Filter applications based on search and filters
    const filteredApplications = useMemo(() => {
        return applications.filter((app) => {
            const fullName = `${app.firstName || ''} ${app.lastName || ''}`.toLowerCase();
            const jobTitle = (app.jobTitle || '').toLowerCase();
            const department = (app.department || '').toLowerCase();
            const email = (app.email || '').toLowerCase();

            const matchesSearch = searchTerm === '' ||
                fullName.includes(searchTerm.toLowerCase()) ||
                jobTitle.includes(searchTerm.toLowerCase()) ||
                department.includes(searchTerm.toLowerCase()) ||
                email.includes(searchTerm.toLowerCase());

            const matchesStage = stageFilter === 'all' || app.currentStage === stageFilter;
            const matchesDepartment = departmentFilter === 'all' || app.department === departmentFilter;
            const matchesPriority = priorityFilter === 'all' || app.priority === priorityFilter;

            return matchesSearch && matchesStage && matchesDepartment && matchesPriority;
        });
    }, [applications, searchTerm, stageFilter, departmentFilter, priorityFilter]);

    // Calculate statistics
    const stats = useMemo(() => {
        return {
            total: applications.length,
            new: applications.filter(app => app.currentStage === 'new').length,
            screening: applications.filter(app => app.currentStage === 'screening').length,
            interview: applications.filter(app => app.currentStage === 'interview').length,
            technical: applications.filter(app => app.currentStage === 'technical').length,
            offer: applications.filter(app => app.currentStage === 'offer').length,
            hired: applications.filter(app => app.currentStage === 'hired').length,
            rejected: applications.filter(app => app.currentStage === 'rejected').length,
            highPriority: applications.filter(app => app.priority === 'high').length
        };
    }, [applications]);

    // Get unique departments for filter
    const departments = useMemo(() => {
        return [...new Set(applications.map(app => app.department))].filter(Boolean);
    }, [applications]);

    const handleOpenApplication = (application) => {
        setSelectedApplication(application);
        setFormData({ ...EMPTY_FORM, ...application });
        setViewMode('view');
        setActiveTab('details');
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setSelectedApplication(null);
        setFormData(EMPTY_FORM);
        setNewNote('');
        setActiveTab('details');
    };

    // Update application stage
    const handleStageChange = async (applicationId, newStage) => {
        const application = applications.find(app => app.id === applicationId);
        if (!application) return;

        const status = STAGE_TO_STATUS[newStage] || 'pending';
        try {
            const { data } = await api.patch(`/hr/applications/${applicationId}/status`, {
                status,
                notes: `Moved to ${APPLICATION_STAGES.find(s => s.id === newStage)?.label || newStage} stage`
            });
            const normalized = normalizeApplication(data);
            setApplications(prev => prev.map(app =>
                app.id === applicationId ? { ...normalized, currentStage: newStage } : app
            ));
            setSuccessMessage(`Application moved to ${APPLICATION_STAGES.find(s => s.id === newStage)?.label} stage`);
            if (selectedApplication?.id === applicationId) {
                setSelectedApplication({ ...normalized, currentStage: newStage });
            }
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to update status');
        }
    };

    // Add note to application
    const handleAddNote = async () => {
        if (!newNote.trim() || !selectedApplication) return;

        try {
            const { data } = await api.post(`/hr/applications/${selectedApplication.id}/notes`, {
                notes: newNote.trim()
            });
            const normalized = normalizeApplication(data);
            setApplications(prev => prev.map(app =>
                app.id === selectedApplication.id ? normalized : app
            ));
            setSelectedApplication(normalized);
            setNewNote('');
            setSuccessMessage('Note added successfully');
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to add note');
        }
    };

    // Add rating
    const handleAddRating = () => {
        if (!rating.category || !rating.score || !selectedApplication) return;

        const updatedRatings = {
            ...(selectedApplication.ratings || {}),
            [rating.category]: rating.score
        };

        setApplications(prev => prev.map(app =>
            app.id === selectedApplication.id
                ? { ...app, ratings: updatedRatings }
                : app
        ));

        setSelectedApplication(prev => ({ ...prev, ratings: updatedRatings }));
        setRating({ category: '', score: 0, comment: '' });
        setSuccessMessage('Rating added successfully');
    };

    // Approve application (move to next stage)
    const handleApprove = () => {
        if (!selectedApplication) return;

        const currentStageIndex = APPLICATION_STAGES.findIndex(s => s.id === selectedApplication.currentStage);
        if (currentStageIndex < APPLICATION_STAGES.length - 2) { // Don't go beyond offer
            const nextStage = APPLICATION_STAGES[currentStageIndex + 1].id;
            handleStageChange(selectedApplication.id, nextStage);
        }
    };

    // Reject application
    const handleReject = () => {
        if (!selectedApplication) return;
        handleStageChange(selectedApplication.id, 'rejected');
    };

    // Schedule interview
    const handleScheduleInterview = async () => {
        if (!selectedApplication) return;

        const interviewType = prompt('Enter interview type (e.g., HR Screen, Technical):') || 'Interview';
        const interviewDate = prompt('Enter date (YYYY-MM-DD HH:mm):');
        if (!interviewDate) return;
        const interviewer = prompt('Enter interviewer name (optional):') || '';

        try {
            const { data } = await api.post(`/hr/applications/${selectedApplication.id}/interviews`, {
                interview_type: interviewType,
                scheduled_at: new Date(interviewDate).toISOString(),
                duration_minutes: 60,
                location: '',
                meeting_link: '',
                interviewer_id: null
            });
            const updatedInterviews = [
                ...(selectedApplication.interviews || []),
                {
                    id: data.id,
                    type: interviewType,
                    date: data.scheduled_at || new Date(interviewDate).toISOString(),
                    interviewer: interviewer || data.interviewer_name || 'TBD',
                    status: data.status || 'scheduled'
                }
            ];
            setApplications(prev => prev.map(app =>
                app.id === selectedApplication.id
                    ? { ...app, interviews: updatedInterviews }
                    : app
            ));
            setSelectedApplication(prev => ({ ...prev, interviews: updatedInterviews }));
            setSuccessMessage('Interview scheduled successfully');
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to schedule interview');
        }
    };

    // Stage Progress Component
    const StageProgress = ({ currentStage }) => {
        const currentIndex = APPLICATION_STAGES.findIndex(s => s.id === currentStage);

        return (
            <div className="stage-progress" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '1rem',
                background: 'var(--bg-secondary)',
                borderRadius: '0.5rem',
                overflowX: 'auto',
                marginBottom: '1rem'
            }}>
                {APPLICATION_STAGES.map((stage, index) => {
                    const StageIcon = stage.icon;
                    const isCompleted = index < currentIndex;
                    const isCurrent = index === currentIndex;
                    const isRejected = stage.id === 'rejected';

                    return (
                        <React.Fragment key={stage.id}>
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    minWidth: '80px',
                                    cursor: 'pointer',
                                    opacity: isRejected && currentStage !== 'rejected' ? 0.5 : 1
                                }}
                                onClick={() => !isRejected && handleStageChange(selectedApplication.id, stage.id)}
                            >
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    background: isCompleted ? stage.color : isCurrent ? stage.color : 'var(--bg-tertiary)',
                                    color: isCompleted || isCurrent ? 'white' : 'var(--text-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: isCurrent ? `3px solid ${stage.color}` : 'none',
                                    boxShadow: isCurrent ? '0 0 0 2px var(--bg-primary)' : 'none'
                                }}>
                                    <StageIcon size={20} />
                                </div>
                                <span style={{
                                    fontSize: '0.75rem',
                                    marginTop: '0.25rem',
                                    fontWeight: isCurrent ? 'bold' : 'normal',
                                    color: isCurrent ? stage.color : 'var(--text-muted)'
                                }}>
                                    {stage.label}
                                </span>
                            </div>
                            {index < APPLICATION_STAGES.length - 1 && (
                                <FiArrowRight style={{ color: 'var(--text-muted)' }} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="dashboard-page">
            <div className="container">
                <div className="dashboard-header" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <h1 className="dashboard-title">Applicant Tracking System</h1>
                        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            Manage and review candidate applications
                        </p>
                    </div>
                </div>

                {/* Statistics Cards */}
                <div className="companies-grid" style={{
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    marginBottom: '1.5rem'
                }}>
                    {APPLICATION_STAGES.map(stage => {
                        const StageIcon = stage.icon;
                        const count = stats[stage.id] || 0;
                        return (
                            <div key={stage.id} className="card" style={{ borderLeft: `4px solid ${stage.color}` }}>
                                <div className="card-content" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                        background: stage.color,
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white'
                                    }}>
                                        <StageIcon size={18} />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.25rem', margin: 0 }}>{count}</h3>
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
                                <input
                                    className="form-input"
                                    placeholder="Search candidates, jobs, or departments..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ paddingLeft: '2.25rem', width: '100%' }}
                                />
                            </div>

                            <select
                                className="form-input"
                                value={stageFilter}
                                onChange={(e) => setStageFilter(e.target.value)}
                                style={{ minWidth: '140px' }}
                            >
                                <option value="all">All Stages</option>
                                {APPLICATION_STAGES.map(stage => (
                                    <option key={stage.id} value={stage.id}>{stage.label}</option>
                                ))}
                            </select>

                            <select
                                className="form-input"
                                value={departmentFilter}
                                onChange={(e) => setDepartmentFilter(e.target.value)}
                                style={{ minWidth: '140px' }}
                            >
                                <option value="all">All Departments</option>
                                {departments.map(dept => (
                                    <option key={dept} value={dept}>{dept}</option>
                                ))}
                            </select>

                            <select
                                className="form-input"
                                value={priorityFilter}
                                onChange={(e) => setPriorityFilter(e.target.value)}
                                style={{ minWidth: '140px' }}
                            >
                                <option value="all">All Priorities</option>
                                <option value="high">High Priority</option>
                                <option value="medium">Medium Priority</option>
                                <option value="low">Low Priority</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Applications Table */}
                <div className="card">
                    <div className="card-content" style={{ overflowX: 'auto' }}>
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
                            {filteredApplications.map((app) => {
                                const stage = APPLICATION_STAGES.find(s => s.id === app.currentStage) || APPLICATION_STAGES[0];
                                const StageIcon = stage.icon;

                                return (
                                    <tr key={app.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: '50%',
                                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                    color: 'white',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontWeight: 'bold'
                                                }}>
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
                                            <div style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.25rem',
                                                padding: '0.25rem 0.5rem',
                                                background: stage.color + '20',
                                                color: stage.color,
                                                borderRadius: '1rem',
                                                fontSize: '0.85rem'
                                            }}>
                                                <StageIcon size={14} />
                                                <span>{stage.label}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                                <span style={{
                                                    display: 'inline-block',
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    background: app.priority === 'high' ? '#e74c3c' : app.priority === 'medium' ? '#f39c12' : '#95a5a6',
                                                    marginRight: '0.5rem'
                                                }} />
                                            {app.priority?.charAt(0).toUpperCase() + app.priority?.slice(1) || 'Normal'}
                                        </td>
                                        <td style={{ padding: '0.75rem', fontSize: '0.9rem' }}>
                                            {format(new Date(app.appliedDate), 'MMM dd, yyyy')}
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                                                <button
                                                    className="btn btn-small"
                                                    onClick={() => handleOpenApplication(app)}
                                                    title="View Application"
                                                >
                                                    <FiEye size={14} />
                                                </button>
                                                <button
                                                    className="btn btn-small btn-success"
                                                    onClick={() => handleStageChange(app.id, APPLICATION_STAGES[APPLICATION_STAGES.findIndex(s => s.id === app.currentStage) + 1]?.id)}
                                                    disabled={app.currentStage === 'hired' || app.currentStage === 'rejected'}
                                                    title="Approve"
                                                >
                                                    <FiThumbsUp size={14} />
                                                </button>
                                                <button
                                                    className="btn btn-small btn-danger"
                                                    onClick={() => handleStageChange(app.id, 'rejected')}
                                                    disabled={app.currentStage === 'rejected'}
                                                    title="Reject"
                                                >
                                                    <FiThumbsDown size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredApplications.length === 0 && (
                                <tr>
                                    <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        No applications found. Start by adding candidates or sync with your job board.
                                    </td>
                                </tr>
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Application Detail Modal */}
            {openDialog && selectedApplication && (
                <div className="modal-overlay" role="dialog" aria-modal="true">
                    <div className="modal-content" style={{ width: 'min(1200px, 95vw)', maxHeight: '90vh', overflowY: 'auto' }}>
                        {/* Header */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '1rem',
                            borderBottom: '1px solid var(--border-color)',
                            position: 'sticky',
                            top: 0,
                            background: 'var(--bg-primary)',
                            zIndex: 10
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.25rem',
                                    fontWeight: 'bold'
                                }}>
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
                                <button className="btn btn-success" onClick={handleApprove}>
                                    <FiCheckCircle /> Approve
                                </button>
                                <button className="btn btn-danger" onClick={handleReject}>
                                    <FiXCircle /> Reject
                                </button>
                                <button className="btn btn-secondary" onClick={handleCloseDialog}>Close</button>
                            </div>
                        </div>

                        {/* Stage Progress */}
                        <StageProgress currentStage={selectedApplication.currentStage} />

                        {/* Tabs */}
                        <div style={{ display: 'flex', gap: '0.5rem', padding: '0 1rem', borderBottom: '1px solid var(--border-color)' }}>
                            {['details', 'notes', 'interviews', 'reviews'].map(tab => (
                                <button
                                    key={tab}
                                    className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-ghost'}`}
                                    onClick={() => setActiveTab(tab)}
                                    style={{ borderRadius: 0, borderBottom: activeTab === tab ? '2px solid var(--primary)' : 'none' }}
                                >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div style={{ padding: '1.5rem' }}>
                            {activeTab === 'details' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                    {/* Left Column - Personal Info */}
                                    <div>
                                        <h3 style={{ marginBottom: '1rem' }}>Personal Information</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <FiMail style={{ color: 'var(--text-muted)' }} />
                                                <span>{selectedApplication.email}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <FiPhone style={{ color: 'var(--text-muted)' }} />
                                                <span>{selectedApplication.phone}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <FiMapPin style={{ color: 'var(--text-muted)' }} />
                                                <span>{selectedApplication.location}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <FiBriefcase style={{ color: 'var(--text-muted)' }} />
                                                <span>{selectedApplication.currentCompany} • {selectedApplication.experience}</span>
                                            </div>
                                        </div>

                                        <h3 style={{ margin: '1.5rem 0 1rem' }}>Skills</h3>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {selectedApplication.skills?.map((skill, index) => (
                                                <span key={index} style={{
                                                    padding: '0.25rem 0.75rem',
                                                    background: 'var(--bg-secondary)',
                                                    borderRadius: '1rem',
                                                    fontSize: '0.85rem'
                                                }}>
                                                    {skill}
                                                </span>
                                            ))}
                                        </div>

                                        <h3 style={{ margin: '1.5rem 0 1rem' }}>Education</h3>
                                        <p>{selectedApplication.education}</p>
                                    </div>

                                    {/* Right Column - Application Details */}
                                    <div>
                                        <h3 style={{ marginBottom: '1rem' }}>Application Details</h3>
                                        <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '0.5rem' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Applied Date</div>
                                                    <div>{format(new Date(selectedApplication.appliedDate), 'MMM dd, yyyy')}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Expected Salary</div>
                                                    <div>{selectedApplication.expectedSalary}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Notice Period</div>
                                                    <div>{selectedApplication.noticePeriod}</div>
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Priority</div>
                                                    <div style={{
                                                        color: selectedApplication.priority === 'high' ? '#e74c3c' :
                                                            selectedApplication.priority === 'medium' ? '#f39c12' : 'inherit'
                                                    }}>
                                                        {selectedApplication.priority?.toUpperCase()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <h3 style={{ margin: '1.5rem 0 1rem' }}>Cover Letter</h3>
                                        <p style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                                            {selectedApplication.coverLetter}
                                        </p>

                                        <h3 style={{ margin: '1.5rem 0 1rem' }}>Links</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            {selectedApplication.resumeUrl && (
                                                <a href={selectedApplication.resumeUrl} target="_blank" rel="noopener noreferrer">
                                                    <FiDownload /> Resume
                                                </a>
                                            )}
                                            {selectedApplication.linkedInUrl && (
                                                <a href={selectedApplication.linkedInUrl} target="_blank" rel="noopener noreferrer">
                                                    LinkedIn Profile
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'notes' && (
                                <div>
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <h3>Add Note</h3>
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            <textarea
                                                className="form-textarea"
                                                value={newNote}
                                                onChange={(e) => setNewNote(e.target.value)}
                                                placeholder="Add a note about this candidate..."
                                                rows={3}
                                                style={{ flex: 1 }}
                                            />
                                            <button className="btn btn-primary" onClick={handleAddNote}>
                                                Add Note
                                            </button>
                                        </div>
                                    </div>

                                    <h3>Notes History</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                                        {selectedApplication.notes?.map((note, index) => (
                                            <div key={note.id || index} style={{
                                                padding: '1rem',
                                                background: 'var(--bg-secondary)',
                                                borderRadius: '0.5rem'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                    <span style={{ fontWeight: 500 }}>{note.author}</span>
                                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                        {format(new Date(note.date), 'MMM dd, yyyy HH:mm')}
                                                    </span>
                                                </div>
                                                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{note.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'interviews' && (
                                <div>
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <button className="btn btn-primary" onClick={handleScheduleInterview}>
                                            <FiCalendar /> Schedule Interview
                                        </button>
                                    </div>

                                    <h3>Scheduled Interviews</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                                        {selectedApplication.interviews?.map((interview, index) => (
                                            <div key={interview.id || index} style={{
                                                padding: '1rem',
                                                background: 'var(--bg-secondary)',
                                                borderRadius: '0.5rem'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <h4 style={{ margin: '0 0 0.25rem' }}>{interview.type}</h4>
                                                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                                            with {interview.interviewer}
                                                        </p>
                                                    </div>
                                                    <span style={{
                                                        padding: '0.25rem 0.5rem',
                                                        background: interview.status === 'scheduled' ? '#f39c12' : '#2ecc71',
                                                        color: 'white',
                                                        borderRadius: '1rem',
                                                        fontSize: '0.85rem'
                                                    }}>
                                                        {interview.status}
                                                    </span>
                                                </div>
                                                <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                                                    <FiCalendar /> {format(new Date(interview.date), 'MMM dd, yyyy HH:mm')}
                                                </div>
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
                                            <select
                                                className="form-input"
                                                value={rating.category}
                                                onChange={(e) => setRating({ ...rating, category: e.target.value })}
                                            >
                                                <option value="">Select Category</option>
                                                <option value="technical">Technical Skills</option>
                                                <option value="communication">Communication</option>
                                                <option value="experience">Experience</option>
                                                <option value="culture">Culture Fit</option>
                                                <option value="leadership">Leadership</option>
                                            </select>
                                            <select
                                                className="form-input"
                                                value={rating.score}
                                                onChange={(e) => setRating({ ...rating, score: parseInt(e.target.value) })}
                                            >
                                                <option value="0">Select Rating</option>
                                                {[1, 2, 3, 4, 5].map(score => (
                                                    <option key={score} value={score}>{score} Star{score > 1 ? 's' : ''}</option>
                                                ))}
                                            </select>
                                            <button className="btn btn-primary" onClick={handleAddRating}>
                                                Add Rating
                                            </button>
                                        </div>
                                    </div>

                                    <h3>Ratings</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                                        {Object.entries(selectedApplication.ratings || {}).map(([category, score]) => (
                                            <div key={category} style={{
                                                padding: '1rem',
                                                background: 'var(--bg-secondary)',
                                                borderRadius: '0.5rem',
                                                textAlign: 'center'
                                            }}>
                                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                                                    {category.charAt(0).toUpperCase() + category.slice(1)}
                                                </div>
                                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                                    {score}/5
                                                </div>
                                                <div style={{ color: '#f39c12' }}>
                                                    {'★'.repeat(score)}{'☆'.repeat(5 - score)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Applications;
