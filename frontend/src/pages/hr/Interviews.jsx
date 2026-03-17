import React, { useEffect, useState, useCallback } from 'react';
import {
    FaCalendarAlt,
    FaVideo,
    FaUserCheck,
    FaClock,
    FaPlus,
    FaFilter,
    FaRedo,
    FaCheckCircle,
    FaTimesCircle,
    FaCalendarCheck,
    FaUserTie,
    FaBriefcase,
    FaStar,
    FaRegStar,
    FaRegClock,
    FaEnvelope,
    FaPhone,
    FaMapMarkerAlt,
    FaExternalLinkAlt,
    FaVideo as FaVideoIcon,
    FaRegCalendarAlt
} from 'react-icons/fa';
import { MdOutlineRateReview, MdSchedule, MdFeedback } from 'react-icons/md';
import api from '../../services/api';
import Loading from '../../components/common/Loading';
import Modal from '../../components/common/Modal';
import './Interviews.css';

// Interview status badges
const STATUS_CONFIG = {
    scheduled: { label: 'Scheduled', class: 'status-scheduled', icon: FaRegCalendarAlt },
    completed: { label: 'Completed', class: 'status-completed', icon: FaCheckCircle },
    cancelled: { label: 'Cancelled', class: 'status-cancelled', icon: FaTimesCircle },
    rescheduled: { label: 'Rescheduled', class: 'status-rescheduled', icon: FaClock },
    no_show: { label: 'No Show', class: 'status-no-show', icon: FaTimesCircle },
    pending: { label: 'Pending', class: 'status-pending', icon: FaRegClock }
};

// Interview type icons
const INTERVIEW_TYPE_CONFIG = {
    video: { icon: FaVideoIcon, label: 'Video Call', color: '#4f46e5' },
    phone: { icon: FaPhone, label: 'Phone Call', color: '#0891b2' },
    in_person: { icon: FaUserCheck, label: 'In Person', color: '#059669' },
    technical: { icon: FaBriefcase, label: 'Technical', color: '#b45309' },
    hr: { icon: FaUserTie, label: 'HR Interview', color: '#7c3aed' }
};

const formatDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const formatDateForInput = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 16);
};

const Interviews = () => {
    const [interviews, setInterviews] = useState([]);
    const [filteredInterviews, setFilteredInterviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Filter states
    const [statusFilter, setStatusFilter] = useState('scheduled');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [showFilters, setShowFilters] = useState(false);

    // Modal states
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showFeedbackModal, setShowFeedbackModal] = useState(false);
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [selectedInterview, setSelectedInterview] = useState(null);

    // Form states
    const [feedbackForm, setFeedbackForm] = useState({
        feedback: '',
        rating: 0,
        recommended_for_next: false,
        strengths: '',
        weaknesses: '',
        technical_skills: 0,
        communication_skills: 0,
        cultural_fit: 0
    });

    const [rescheduleForm, setRescheduleForm] = useState({
        scheduled_at: '',
        reason: '',
        interviewer_id: ''
    });

    const [scheduleForm, setScheduleForm] = useState({
        application_id: '',
        interviewer_id: '',
        scheduled_at: '',
        type: 'video',
        duration_minutes: 60,
        location: '',
        meeting_link: '',
        notes: ''
    });

    const [applications, setApplications] = useState([]);
    const [interviewers, setInterviewers] = useState([]);

    // Fetch interviews with filters
    const fetchInterviews = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
            if (searchTerm) params.append('search', searchTerm);
            if (dateRange.start) params.append('start_date', new Date(dateRange.start).toISOString());
            if (dateRange.end) params.append('end_date', new Date(dateRange.end).toISOString());

            const { data } = await api.get(`/hr/interviews?${params.toString()}`);
            const interviewsData = Array.isArray(data) ? data : data?.data || data?.interviews || [];
            setInterviews(interviewsData);
            applyLocalFilters(interviewsData);
        } catch (err) {
            console.error('Failed to fetch interviews:', err);
            setError(err?.response?.data?.error || 'Failed to load interviews');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, searchTerm, dateRange]);

    // Fetch applications for scheduling
    const fetchApplications = useCallback(async () => {
        try {
            const { data } = await api.get('/hr/applications?status=interview_scheduled,interview_pending');
            setApplications(data?.data || data || []);
        } catch (err) {
            console.error('Failed to fetch applications:', err);
        }
    }, []);

    // Fetch interviewers
    const fetchInterviewers = useCallback(async () => {
        try {
            const { data } = await api.get('/hr/interviewers');
            setInterviewers(data?.data || data || []);
        } catch (err) {
            console.error('Failed to fetch interviewers:', err);
        }
    }, []);

    useEffect(() => {
        fetchInterviews();
        fetchApplications();
        fetchInterviewers();
    }, [fetchInterviews, fetchApplications, fetchInterviewers]);

    // Apply local filters
    const applyLocalFilters = (interviewsData) => {
        let filtered = [...interviewsData];

        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(i =>
                i.first_name?.toLowerCase().includes(term) ||
                i.last_name?.toLowerCase().includes(term) ||
                i.job_title?.toLowerCase().includes(term) ||
                i.interviewer_name?.toLowerCase().includes(term)
            );
        }

        setFilteredInterviews(filtered);
    };

    const handleStatusFilterChange = (status) => {
        setStatusFilter(status);
        fetchInterviews();
    };

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
        fetchInterviews();
    };

    const clearFilters = () => {
        setStatusFilter('scheduled');
        setSearchTerm('');
        setDateRange({ start: '', end: '' });
        fetchInterviews();
    };

    const handleScheduleInterview = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                ...scheduleForm,
                scheduled_at: new Date(scheduleForm.scheduled_at).toISOString()
            };

            const { data } = await api.post('/hr/interviews', payload);
            setSuccess('Interview scheduled successfully');
            setShowScheduleModal(false);
            setScheduleForm({
                application_id: '',
                interviewer_id: '',
                scheduled_at: '',
                type: 'video',
                duration_minutes: 60,
                location: '',
                meeting_link: '',
                notes: ''
            });
            fetchInterviews();
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to schedule interview');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitFeedback = async (e) => {
        e.preventDefault();
        if (!selectedInterview) return;

        setLoading(true);
        try {
            await api.post(`/hr/interviews/${selectedInterview.id}/feedback`, {
                ...feedbackForm,
                rating: Number(feedbackForm.rating)
            });
            setSuccess('Feedback submitted successfully');
            setShowFeedbackModal(false);
            setSelectedInterview(null);
            setFeedbackForm({
                feedback: '',
                rating: 0,
                recommended_for_next: false,
                strengths: '',
                weaknesses: '',
                technical_skills: 0,
                communication_skills: 0,
                cultural_fit: 0
            });
            fetchInterviews();
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to submit feedback');
        } finally {
            setLoading(false);
        }
    };

    const handleReschedule = async (e) => {
        e.preventDefault();
        if (!selectedInterview) return;

        setLoading(true);
        try {
            const payload = {
                ...rescheduleForm,
                scheduled_at: new Date(rescheduleForm.scheduled_at).toISOString(),
                status: 'rescheduled'
            };

            await api.patch(`/hr/interviews/${selectedInterview.id}`, payload);
            setSuccess('Interview rescheduled successfully');
            setShowRescheduleModal(false);
            setSelectedInterview(null);
            setRescheduleForm({
                scheduled_at: '',
                reason: '',
                interviewer_id: ''
            });
            fetchInterviews();
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to reschedule interview');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelInterview = async (interview) => {
        if (!window.confirm('Are you sure you want to cancel this interview?')) return;

        setLoading(true);
        try {
            await api.patch(`/hr/interviews/${interview.id}`, {
                status: 'cancelled',
                reason: window.prompt('Reason for cancellation:') || 'Cancelled by HR'
            });
            setSuccess('Interview cancelled successfully');
            fetchInterviews();
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to cancel interview');
        } finally {
            setLoading(false);
        }
    };

    const handleSendReminder = async (interview) => {
        try {
            await api.post(`/hr/interviews/${interview.id}/reminder`);
            setSuccess('Reminder sent successfully');
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to send reminder');
        }
    };

    const openFeedbackModal = (interview) => {
        setSelectedInterview(interview);
        setShowFeedbackModal(true);
    };

    const openRescheduleModal = (interview) => {
        setSelectedInterview(interview);
        setRescheduleForm({
            scheduled_at: formatDateForInput(interview.scheduled_at),
            reason: '',
            interviewer_id: interview.interviewer_id || ''
        });
        setShowRescheduleModal(true);
    };

    const getStatusBadge = (status) => {
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;
        const Icon = config.icon;
        return (
            <span className={`status-badge ${config.class}`}>
                <Icon size={12} />
                {config.label}
            </span>
        );
    };

    const getInterviewTypeIcon = (type) => {
        const config = INTERVIEW_TYPE_CONFIG[type] || INTERVIEW_TYPE_CONFIG.video;
        const Icon = config.icon;
        return (
            <span className="interview-type" title={config.label}>
                <Icon size={14} color={config.color} />
            </span>
        );
    };

    const renderStars = (rating, onChange) => {
        return (
            <div className="star-rating">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => onChange(star)}
                        className="star-button"
                    >
                        {star <= rating ? <FaStar color="#fbbf24" /> : <FaRegStar />}
                    </button>
                ))}
            </div>
        );
    };

    return (
        <div className="interviews-page">
            {/* Header */}
            <div className="page-header">
                <div className="header-title">
                    <h1><FaCalendarAlt /> Interviews</h1>
                    <p>Coordinate interview schedules, interviewer assignments, and candidate progression</p>
                </div>
                <div className="header-actions">
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowScheduleModal(true)}
                    >
                        <FaPlus /> Schedule Interview
                    </button>
                </div>
            </div>

            {/* Alerts */}
            {error && (
                <div className="alert alert-error">
                    {error}
                    <button onClick={() => setError('')} className="alert-close">×</button>
                </div>
            )}

            {success && (
                <div className="alert alert-success">
                    {success}
                    <button onClick={() => setSuccess('')} className="alert-close">×</button>
                </div>
            )}

            {/* Filters */}
            <div className="filters-section">
                <div className="filter-tabs">
                    <button
                        className={`filter-tab ${statusFilter === 'scheduled' ? 'active' : ''}`}
                        onClick={() => handleStatusFilterChange('scheduled')}
                    >
                        <FaClock /> Upcoming
                    </button>
                    <button
                        className={`filter-tab ${statusFilter === 'completed' ? 'active' : ''}`}
                        onClick={() => handleStatusFilterChange('completed')}
                    >
                        <FaCheckCircle /> Completed
                    </button>
                    <button
                        className={`filter-tab ${statusFilter === 'all' ? 'active' : ''}`}
                        onClick={() => handleStatusFilterChange('all')}
                    >
                        All Interviews
                    </button>
                </div>

                <div className="filter-controls">
                    <div className="search-box">
                        <input
                            type="text"
                            placeholder="Search candidates, jobs, interviewers..."
                            value={searchTerm}
                            onChange={handleSearch}
                            className="search-input"
                        />
                    </div>

                    <button
                        className="btn btn-secondary btn-icon"
                        onClick={() => setShowFilters(!showFilters)}
                        title="Toggle filters"
                    >
                        <FaFilter /> Filters
                    </button>

                    <button
                        className="btn btn-secondary btn-icon"
                        onClick={fetchInterviews}
                        title="Refresh"
                    >
                        <FaRedo />
                    </button>
                </div>

                {showFilters && (
                    <div className="advanced-filters">
                        <div className="filter-row">
                            <div className="filter-group">
                                <label>Date Range</label>
                                <div className="date-range">
                                    <input
                                        type="date"
                                        value={dateRange.start}
                                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                        className="filter-input"
                                    />
                                    <span>to</span>
                                    <input
                                        type="date"
                                        value={dateRange.end}
                                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                        className="filter-input"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="filter-actions">
                            <button className="btn btn-secondary" onClick={clearFilters}>
                                Clear Filters
                            </button>
                            <button className="btn btn-primary" onClick={fetchInterviews}>
                                Apply Filters
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Interviews Table */}
            {loading ? (
                <Loading />
            ) : (
                <div className="interviews-table-container">
                    <table className="interviews-table">
                        <thead>
                        <tr>
                            <th>Candidate</th>
                            <th>Job</th>
                            <th>Interviewer</th>
                            <th>Date & Time</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {filteredInterviews.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="no-results">
                                    <FaCalendarAlt size={48} />
                                    <h3>No interviews found</h3>
                                    <p>Try adjusting your filters or schedule a new interview</p>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => setShowScheduleModal(true)}
                                    >
                                        <FaPlus /> Schedule Interview
                                    </button>
                                </td>
                            </tr>
                        ) : (
                            filteredInterviews.map((interview) => (
                                <tr key={interview.id} className="interview-row">
                                    <td>
                                        <div className="candidate-info">
                                            <div className="candidate-avatar">
                                                {interview.first_name?.[0]}{interview.last_name?.[0]}
                                            </div>
                                            <div>
                                                <div className="candidate-name">
                                                    {interview.first_name} {interview.last_name}
                                                </div>
                                                <div className="candidate-email">
                                                    {interview.email}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className="job-info">
                                            <div className="job-title">{interview.job_title || '—'}</div>
                                            <div className="job-department">{interview.department || ''}</div>
                                        </div>
                                    </td>
                                    <td>
                                        {interview.interviewer_name ? (
                                            <div className="interviewer-info">
                                                <div className="interviewer-name">
                                                    {interview.interviewer_name}
                                                </div>
                                                {interview.interviewer_email && (
                                                    <div className="interviewer-email">
                                                        {interview.interviewer_email}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-muted">Not assigned</span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="datetime-info">
                                            <FaClock className="datetime-icon" />
                                            <div>
                                                <div className="date">
                                                    {formatDateTime(interview.scheduled_at)}
                                                </div>
                                                {interview.duration_minutes && (
                                                    <div className="duration">
                                                        {interview.duration_minutes} minutes
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        {getInterviewTypeIcon(interview.type)}
                                    </td>
                                    <td>
                                        {getStatusBadge(interview.status)}
                                    </td>
                                    <td>
                                        <div className="action-buttons">
                                            {interview.status === 'scheduled' && (
                                                <>
                                                    <button
                                                        className="btn btn-icon"
                                                        onClick={() => openRescheduleModal(interview)}
                                                        title="Reschedule"
                                                    >
                                                        <FaClock />
                                                    </button>
                                                    <button
                                                        className="btn btn-icon"
                                                        onClick={() => openFeedbackModal(interview)}
                                                        title="Complete & Feedback"
                                                    >
                                                        <MdFeedback />
                                                    </button>
                                                    <button
                                                        className="btn btn-icon"
                                                        onClick={() => handleSendReminder(interview)}
                                                        title="Send Reminder"
                                                    >
                                                        <FaEnvelope />
                                                    </button>
                                                    {interview.meeting_link && (
                                                        <a
                                                            href={interview.meeting_link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="btn btn-icon"
                                                            title="Join Meeting"
                                                        >
                                                            <FaExternalLinkAlt />
                                                        </a>
                                                    )}
                                                    <button
                                                        className="btn btn-icon danger"
                                                        onClick={() => handleCancelInterview(interview)}
                                                        title="Cancel"
                                                    >
                                                        <FaTimesCircle />
                                                    </button>
                                                </>
                                            )}
                                            {interview.status === 'completed' && (
                                                <button
                                                    className="btn btn-icon"
                                                    onClick={() => {
                                                        setSelectedInterview(interview);
                                                        setShowFeedbackModal(true);
                                                    }}
                                                    title="View Feedback"
                                                >
                                                    <MdOutlineRateReview />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Schedule Interview Modal */}
            <Modal
                isOpen={showScheduleModal}
                onClose={() => setShowScheduleModal(false)}
                title="Schedule New Interview"
                size="large"
            >
                <form onSubmit={handleScheduleInterview} className="interview-form">
                    <div className="form-group">
                        <label>Application *</label>
                        <select
                            value={scheduleForm.application_id}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, application_id: e.target.value })}
                            required
                        >
                            <option value="">Select application</option>
                            {applications.map(app => (
                                <option key={app.id} value={app.id}>
                                    {app.first_name} {app.last_name} - {app.job_title}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Interviewer</label>
                        <select
                            value={scheduleForm.interviewer_id}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, interviewer_id: e.target.value })}
                        >
                            <option value="">Select interviewer</option>
                            {interviewers.map(interviewer => (
                                <option key={interviewer.id} value={interviewer.id}>
                                    {interviewer.name} - {interviewer.department}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Date & Time *</label>
                            <input
                                type="datetime-local"
                                value={scheduleForm.scheduled_at}
                                onChange={(e) => setScheduleForm({ ...scheduleForm, scheduled_at: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Duration (minutes)</label>
                            <input
                                type="number"
                                value={scheduleForm.duration_minutes}
                                onChange={(e) => setScheduleForm({ ...scheduleForm, duration_minutes: parseInt(e.target.value) })}
                                min="15"
                                step="15"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Interview Type</label>
                        <div className="interview-type-options">
                            {Object.entries(INTERVIEW_TYPE_CONFIG).map(([type, config]) => {
                                const Icon = config.icon;
                                return (
                                    <label key={type} className={`type-option ${scheduleForm.type === type ? 'selected' : ''}`}>
                                        <input
                                            type="radio"
                                            name="type"
                                            value={type}
                                            checked={scheduleForm.type === type}
                                            onChange={(e) => setScheduleForm({ ...scheduleForm, type: e.target.value })}
                                        />
                                        <Icon /> {config.label}
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Location / Meeting Link</label>
                        <input
                            type="url"
                            value={scheduleForm.meeting_link}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, meeting_link: e.target.value })}
                            placeholder="https://meet.google.com/... or office location"
                        />
                    </div>

                    <div className="form-group">
                        <label>Notes / Instructions</label>
                        <textarea
                            value={scheduleForm.notes}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                            rows="3"
                            placeholder="Any special instructions for the candidate..."
                        />
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setShowScheduleModal(false)}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Scheduling...' : 'Schedule Interview'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Feedback Modal */}
            <Modal
                isOpen={showFeedbackModal}
                onClose={() => {
                    setShowFeedbackModal(false);
                    setSelectedInterview(null);
                }}
                title={`Interview Feedback - ${selectedInterview?.first_name} ${selectedInterview?.last_name}`}
                size="large"
            >
                <form onSubmit={handleSubmitFeedback} className="feedback-form">
                    <div className="ratings-section">
                        <h4>Ratings</h4>

                        <div className="rating-group">
                            <label>Overall Rating (1-5)</label>
                            {renderStars(feedbackForm.rating, (rating) =>
                                setFeedbackForm({ ...feedbackForm, rating })
                            )}
                        </div>

                        <div className="rating-group">
                            <label>Technical Skills</label>
                            {renderStars(feedbackForm.technical_skills, (rating) =>
                                setFeedbackForm({ ...feedbackForm, technical_skills: rating })
                            )}
                        </div>

                        <div className="rating-group">
                            <label>Communication Skills</label>
                            {renderStars(feedbackForm.communication_skills, (rating) =>
                                setFeedbackForm({ ...feedbackForm, communication_skills: rating })
                            )}
                        </div>

                        <div className="rating-group">
                            <label>Cultural Fit</label>
                            {renderStars(feedbackForm.cultural_fit, (rating) =>
                                setFeedbackForm({ ...feedbackForm, cultural_fit: rating })
                            )}
                        </div>
                    </div>

                    <div className="feedback-section">
                        <h4>Feedback</h4>

                        <div className="form-group">
                            <label>Strengths</label>
                            <textarea
                                value={feedbackForm.strengths}
                                onChange={(e) => setFeedbackForm({ ...feedbackForm, strengths: e.target.value })}
                                rows="2"
                                placeholder="What went well?"
                            />
                        </div>

                        <div className="form-group">
                            <label>Areas for Improvement</label>
                            <textarea
                                value={feedbackForm.weaknesses}
                                onChange={(e) => setFeedbackForm({ ...feedbackForm, weaknesses: e.target.value })}
                                rows="2"
                                placeholder="What could be improved?"
                            />
                        </div>

                        <div className="form-group">
                            <label>Detailed Feedback *</label>
                            <textarea
                                value={feedbackForm.feedback}
                                onChange={(e) => setFeedbackForm({ ...feedbackForm, feedback: e.target.value })}
                                rows="4"
                                required
                                placeholder="Provide detailed feedback about the interview..."
                            />
                        </div>

                        <div className="checkbox-group">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={feedbackForm.recommended_for_next}
                                    onChange={(e) => setFeedbackForm({ ...feedbackForm, recommended_for_next: e.target.checked })}
                                />
                                <span>Recommended for next stage</span>
                            </label>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setShowFeedbackModal(false)}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Submitting...' : 'Submit Feedback'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Reschedule Modal */}
            <Modal
                isOpen={showRescheduleModal}
                onClose={() => {
                    setShowRescheduleModal(false);
                    setSelectedInterview(null);
                }}
                title={`Reschedule Interview - ${selectedInterview?.first_name} ${selectedInterview?.last_name}`}
            >
                <form onSubmit={handleReschedule} className="reschedule-form">
                    <div className="form-group">
                        <label>New Date & Time *</label>
                        <input
                            type="datetime-local"
                            value={rescheduleForm.scheduled_at}
                            onChange={(e) => setRescheduleForm({ ...rescheduleForm, scheduled_at: e.target.value })}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Reason for Rescheduling *</label>
                        <textarea
                            value={rescheduleForm.reason}
                            onChange={(e) => setRescheduleForm({ ...rescheduleForm, reason: e.target.value })}
                            rows="3"
                            required
                            placeholder="Provide reason for rescheduling..."
                        />
                    </div>

                    <div className="form-group">
                        <label>Interviewer</label>
                        <select
                            value={rescheduleForm.interviewer_id}
                            onChange={(e) => setRescheduleForm({ ...rescheduleForm, interviewer_id: e.target.value })}
                        >
                            <option value="">Keep current interviewer</option>
                            {interviewers.map(interviewer => (
                                <option key={interviewer.id} value={interviewer.id}>
                                    {interviewer.name} - {interviewer.department}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setShowRescheduleModal(false)}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Rescheduling...' : 'Reschedule Interview'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Interviews;