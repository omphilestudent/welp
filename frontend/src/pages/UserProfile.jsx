import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import Loading from '../components/common/Loading';
import AvatarImage from '../components/common/AvatarImage';
import { useAuth } from '../hooks/useAuth';
import PsychologistBookingModal from '../components/messages/PsychologistBookingModal';
import { formatAmountMinor } from '../utils/currency';

const formatDateTime = (value) => {
    if (!value) return '';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleString();
};

const UserProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user: currentUser } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [messaging, setMessaging] = useState(false);
    const [rates, setRates] = useState([]);
    const [ratesLoading, setRatesLoading] = useState(false);
    const [bookingOpen, setBookingOpen] = useState(false);

    useEffect(() => {
        const loadProfile = async () => {
            setLoading(true);
            setError('');
            try {
                const { data } = await api.get(`/users/public/${id}`);
                setProfile(data);
            } catch (err) {
                setError(err?.response?.data?.error || 'Failed to load profile');
            } finally {
                setLoading(false);
            }
        };
        loadProfile();
    }, [id]);

    useEffect(() => {
        if (!profile?.user || profile.user.role !== 'psychologist') return;
        setRatesLoading(true);
        api.get(`/psychologists/${profile.user.id}/rates`)
            .then(({ data }) => setRates(data?.rates || []))
            .catch(() => setRates([]))
            .finally(() => setRatesLoading(false));
    }, [profile?.user]);

    if (loading) return <Loading />;
    if (error) return <div className="alert alert-error">{error}</div>;
    if (!profile?.user) return null;

    const { user, psychologistProfile, schedule = [], externalEvents = [] } = profile;
    const availabilitySlots = Array.isArray(psychologistProfile?.availability)
        ? psychologistProfile.availability
        : [];
    const availabilityByDay = availabilitySlots.reduce((acc, slot) => {
        if (!slot?.isAvailable) return acc;
        const dayKey = Number.isFinite(slot.dayOfWeek) ? slot.dayOfWeek : null;
        if (dayKey == null) return acc;
        acc[dayKey] = acc[dayKey] || [];
        acc[dayKey].push(slot.hour);
        return acc;
    }, {});
    const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const activeRate = rates.find((rate) => rate.is_active ?? rate.isActive) || rates[0];
    const handleBack = () => {
        if (location.key !== 'default') {
            navigate(-1);
        } else {
            navigate('/messages');
        }
    };

    const handleMessageUser = async () => {
        if (!user?.id || currentUser?.role !== 'psychologist') return;
        setMessaging(true);
        try {
            const { data } = await api.post('/messages/conversations/request', {
                employeeId: user.id,
                initialMessage: 'Hello, I am available to support you whenever you are ready to talk.'
            });
            const conversationId = data?.id || data?.conversation?.id || null;
            if (conversationId) {
                navigate(`/messages?conversation=${conversationId}`);
            } else {
                navigate(`/messages?employee=${user.id}`);
            }
        } catch (err) {
            const msg = err?.response?.data?.error || 'Failed to start a conversation';
            setError(msg);
        } finally {
            setMessaging(false);
        }
    };

    return (
        <div className="user-profile-page">
            <button type="button" className="profile-back-btn" onClick={handleBack}>
                Back to chat
            </button>
            <div className="user-profile-header">
                <div className="user-profile-avatar">
                    {user.avatar_url ? (
                        <AvatarImage src={user.avatar_url} alt={user.display_name} />
                    ) : (
                        <div className="avatar-placeholder">
                            {user.display_name?.charAt(0) || 'U'}
                        </div>
                    )}
                </div>
                <div className="user-profile-meta">
                    <h2>{user.display_name || 'User'}</h2>
                    <p>{user.role}</p>
                    {user.occupation && <p>{user.occupation}</p>}
                    {user.workplace?.name && <p>{user.workplace.name}</p>}
                    {user.location && <p>{user.location}</p>}
                    {currentUser?.role === 'psychologist' && user.role === 'employee' && (
                        <button
                            type="button"
                            className="btn btn-primary btn-small"
                            onClick={handleMessageUser}
                            disabled={messaging}
                        >
                            {messaging ? 'Opening chat...' : 'Message'}
                        </button>
                    )}
                </div>
            </div>

            {user.bio && (
                <section className="profile-section-card">
                    <h3>About</h3>
                    <p>{user.bio}</p>
                </section>
            )}

            {user.role === 'psychologist' && (
                <>
                    <section className="profile-section-card">
                        <div className="profile-rate-header">
                            <h3>Session rates</h3>
                            {currentUser?.role === 'employee' && (
                                <button
                                    type="button"
                                    className="btn btn-primary btn-small"
                                    onClick={() => setBookingOpen(true)}
                                >
                                    Book a session
                                </button>
                            )}
                        </div>
                        {ratesLoading ? (
                            <p>Loading rates...</p>
                        ) : rates.length > 0 ? (
                            <div className="profile-rate-list">
                                {rates.map((rate) => (
                                    <div key={rate.id} className={`profile-rate-card ${rate.is_active ? 'is-active' : ''}`}>
                                        <div>
                                            <strong>{rate.label || 'Session rate'}</strong>
                                            <span>{rate.is_active ? 'Active' : 'Available'}</span>
                                        </div>
                                        <div className="profile-rate-amount">
                                            {formatAmountMinor(rate.amount_minor, rate.currency_code) || '—'} {rate.duration_minutes ? `${rate.duration_minutes} min` : (rate.duration_type === 'per_minute' ? 'per minute' : 'per hour')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p>No rates published yet.</p>
                        )}
                        {activeRate && (
                            <p className="profile-rate-note">
                                Active rate: {formatAmountMinor(activeRate.amount_minor, activeRate.currency_code)} {activeRate.duration_minutes ? `${activeRate.duration_minutes} min` : (activeRate.duration_type === 'per_minute' ? 'per minute' : 'per hour')}.
                            </p>
                        )}
                    </section>

                    <section className="profile-section-card">
                        <h3>Availability</h3>
                        {Object.keys(availabilityByDay).length > 0 ? (
                            <div className="availability-grid">
                                {Object.entries(availabilityByDay)
                                    .sort(([a], [b]) => Number(a) - Number(b))
                                    .map(([dayKey, hours]) => {
                                    const label = dayLabels[Number(dayKey)] || `Day ${dayKey}`;
                                    const formatted = (hours || [])
                                        .sort((a, b) => a - b)
                                        .map((hour) => `${String(hour).padStart(2, '0')}:00`)
                                        .join(', ');
                                    return (
                                        <div key={dayKey} className="availability-card">
                                            <strong>{label}</strong>
                                            <div>{formatted || 'No slots'}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p>No availability shared yet.</p>
                        )}
                    </section>

                    <section className="profile-section-card">
                        <h3>Calendar</h3>
                        {schedule.length > 0 ? (
                            <div className="schedule-list">
                                {schedule.map((item) => (
                                    <div key={item.id} className="schedule-item">
                                        <div>
                                            <strong>{item.title}</strong>
                                            <span>{item.location || item.type}</span>
                                        </div>
                                        <span>{formatDateTime(item.scheduled_for)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p>No upcoming schedule items.</p>
                        )}
                    </section>

                    <section className="profile-section-card">
                        <h3>External Calendar Events</h3>
                        {externalEvents.length > 0 ? (
                            <div className="schedule-list">
                                {externalEvents.map((item, index) => (
                                    <div key={`${item.title}-${index}`} className="schedule-item">
                                        <div>
                                            <strong>{item.title}</strong>
                                            <span>{item.location || 'External calendar'}</span>
                                        </div>
                                        <span>{formatDateTime(item.starts_at)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p>No external events synced.</p>
                        )}
                    </section>
                </>
            )}
            <PsychologistBookingModal
                open={bookingOpen}
                psychologist={user.role === 'psychologist' ? user : null}
                onClose={() => setBookingOpen(false)}
            />
        </div>
    );
};

export default UserProfile;


