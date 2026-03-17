import React, { useEffect, useState } from 'react';
import { FaCalendarAlt, FaVideo, FaUserCheck, FaClock } from 'react-icons/fa';
import api from '../../services/api';

const formatDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
};

const Interviews = () => {
    const [interviews, setInterviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchUpcoming = async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await api.get('/hr/interviews/upcoming');
            const rows = Array.isArray(data) ? data : data?.data || [];
            setInterviews(rows);
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to load interviews');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUpcoming();
    }, []);

    const markCompleted = async (interview) => {
        const feedback = window.prompt('Enter feedback notes:');
        if (!feedback) return;
        const ratingInput = window.prompt('Rating (1-5):');
        const rating = ratingInput ? Number(ratingInput) : null;
        const recommended = window.confirm('Recommend for next stage?');
        try {
            await api.post(`/hr/interviews/${interview.id}/feedback`, {
                feedback,
                rating: Number.isNaN(rating) ? undefined : rating,
                recommended_for_next: recommended
            });
            await fetchUpcoming();
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to submit feedback');
        }
    };

    const reschedule = async (interview) => {
        const nextDate = window.prompt('New date/time (YYYY-MM-DD HH:mm):');
        if (!nextDate) return;
        try {
            await api.patch(`/hr/interviews/${interview.id}`, {
                scheduled_at: new Date(nextDate).toISOString(),
                status: 'scheduled'
            });
            await fetchUpcoming();
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to reschedule interview');
        }
    };

    return (
        <div className="hr-page-content">
            <h1><FaCalendarAlt /> Interviews</h1>
            <p>Coordinate interview schedules, interviewer assignments, and candidate progression in one timeline.</p>

            {error && <div className="alert alert-error">{error}</div>}

            {loading ? (
                <p>Loading interviews…</p>
            ) : (
                <div className="hr-page-cards">
                    <article>
                        <h3><FaVideo /> Scheduling clarity</h3>
                        <p>
                            Manage interview type, location, and meeting links for smooth candidate and interviewer experiences.
                        </p>
                    </article>
                    <article>
                        <h3><FaUserCheck /> Hiring outcomes</h3>
                        <p>
                            Capture ratings and recommendations after each interview to support faster, better hiring decisions.
                        </p>
                    </article>
                </div>
            )}

            {!loading && (
                <div className="card" style={{ marginTop: '1.5rem', overflowX: 'auto' }}>
                    <div className="card-content">
                        <table className="table">
                            <thead>
                            <tr>
                                <th>Candidate</th>
                                <th>Job</th>
                                <th>Interviewer</th>
                                <th>Scheduled</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                            </thead>
                            <tbody>
                            {interviews.length === 0 ? (
                                <tr>
                                    <td colSpan="6">No upcoming interviews.</td>
                                </tr>
                            ) : (
                                interviews.map((interview) => (
                                    <tr key={interview.id}>
                                        <td>{interview.first_name} {interview.last_name}</td>
                                        <td>{interview.job_title || '—'}</td>
                                        <td>{interview.interviewer_name || 'TBD'}</td>
                                        <td><FaClock /> {formatDateTime(interview.scheduled_at)}</td>
                                        <td>{interview.status || 'scheduled'}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                <button className="btn btn-secondary btn-small" onClick={() => reschedule(interview)}>
                                                    Reschedule
                                                </button>
                                                <button className="btn btn-primary btn-small" onClick={() => markCompleted(interview)}>
                                                    Complete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Interviews;
