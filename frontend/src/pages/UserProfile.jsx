import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { addDays, addHours, format, startOfWeek } from 'date-fns';
import api from '../services/api';
import Loading from '../components/common/Loading';
import AvatarImage from '../components/common/AvatarImage';
import { useAuth } from '../hooks/useAuth';
import PsychologistBookingModal from '../components/messages/PsychologistBookingModal';
import { formatAmountMinor } from '../utils/currency';
import Modal from '../components/common/Modal';

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
    const [scheduleView, setScheduleView] = useState('availability');
    const [events, setEvents] = useState([]);
    const [eventModalOpen, setEventModalOpen] = useState(false);
    const [eventSaving, setEventSaving] = useState(false);
    const [eventDraft, setEventDraft] = useState({
        title: '',
        description: '',
        invitees: '',
        eventType: 'meeting',
        isVideoCall: true,
        startsAt: '',
        endsAt: '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Johannesburg'
    });

    useEffect(() => {
        const loadProfile = async () => {
            setLoading(true);
            setError('');
            try {
                const { data } = await api.get(`/users/public/${id}`);
                setProfile(data);
                setEvents(data?.events || []);
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
    const availabilityMap = useMemo(() => {
        const map = new Map();
        availabilitySlots.forEach((slot) => {
            if (!slot?.isAvailable) return;
            if (slot.dayOfWeek == null || slot.hour == null) return;
            map.set(`${slot.dayOfWeek}-${slot.hour}`, true);
        });
        return map;
    }, [availabilitySlots]);
    const activeRate = rates.find((rate) => rate.is_active ?? rate.isActive) || rates[0];
    const handleBack = () => {
        if (location.key !== 'default') {
            navigate(-1);
        } else {
            navigate('/messages');
        }
    };

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, idx) => addDays(weekStart, idx));
    const hours = Array.from({ length: 24 }, (_, idx) => idx);

    const combinedAgenda = useMemo(() => {
        const agenda = [
            ...events.map((event) => ({
                id: event.id,
                title: event.title,
                startsAt: event.starts_at,
                endsAt: event.ends_at,
                type: event.event_type || 'Session',
                source: 'internal'
            })),
            ...schedule.map((item) => ({
                id: item.id,
                title: item.title,
                startsAt: item.scheduled_for,
                endsAt: item.scheduled_for,
                type: item.type || 'meeting',
                source: 'schedule'
            })),
            ...externalEvents.map((item, index) => ({
                id: `${item.title}-${index}`,
                title: item.title,
                startsAt: item.starts_at,
                endsAt: item.ends_at,
                type: item.location || 'External calendar',
                source: 'external'
            }))
        ];
        return agenda
            .filter((item) => item.startsAt)
            .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    }, [events, schedule, externalEvents]);

    const openEventModal = (slotDate) => {
        const start = slotDate;
        const end = addHours(start, 1);
        setEventDraft((prev) => ({
            ...prev,
            title: prev.title || `Session with ${user.display_name || 'psychologist'}`,
            startsAt: start.toISOString().slice(0, 16),
            endsAt: end.toISOString().slice(0, 16)
        }));
        setEventModalOpen(true);
    };

    const handleEventSave = async () => {
        if (!eventDraft.title || !eventDraft.startsAt || !eventDraft.endsAt) {
            setError('Please provide a title and start/end time.');
            return;
        }
        setEventSaving(true);
        try {
            const payload = {
                title: eventDraft.title,
                description: eventDraft.description,
                startsAt: new Date(eventDraft.startsAt).toISOString(),
                endsAt: new Date(eventDraft.endsAt).toISOString(),
                timezone: eventDraft.timezone,
                eventType: eventDraft.eventType,
                isVideoCall: eventDraft.isVideoCall,
                invitees: eventDraft.invitees
            };
            const { data } = await api.post(`/psychologists/${user.id}/events`, payload);
            if (data?.event) {
                setEvents((prev) => [...prev, data.event]);
            }
            setEventModalOpen(false);
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to create event');
        } finally {
            setEventSaving(false);
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

                    <section className="profile-section-card profile-schedule-card">
                        <div className="profile-schedule-header">
                            <div>
                                <h3>Scheduling</h3>
                                <p>Pick a slot to create a meeting invite.</p>
                            </div>
                            <div className="profile-schedule-toggle">
                                <button
                                    type="button"
                                    className={`btn btn-small ${scheduleView === 'availability' ? 'btn-primary' : 'btn-outline'}`}
                                    onClick={() => setScheduleView('availability')}
                                >
                                    Availability
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-small ${scheduleView === 'agenda' ? 'btn-primary' : 'btn-outline'}`}
                                    onClick={() => setScheduleView('agenda')}
                                >
                                    Agenda
                                </button>
                            </div>
                        </div>

                        {scheduleView === 'availability' ? (
                            <div className="profile-calendar">
                                <div className="profile-calendar__header">
                                    <span>{format(weekStart, 'MMMM d')} – {format(addDays(weekStart, 6), 'MMMM d')}</span>
                                </div>
                                <div className="profile-calendar__grid">
                                    <div className="profile-calendar__row profile-calendar__row--header">
                                        <span />
                                        {weekDays.map((day) => (
                                            <div key={day.toISOString()} className="profile-calendar__day-label">
                                                <strong>{format(day, 'EEE')}</strong>
                                                <span>{format(day, 'd')}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {hours.map((hour) => (
                                        <div key={hour} className="profile-calendar__row">
                                            <span className="profile-calendar__hour">{String(hour).padStart(2, '0')}:00</span>
                                            {weekDays.map((day) => {
                                                const dayIndex = day.getDay();
                                                const key = `${dayIndex}-${hour}`;
                                                const isAvailable = availabilityMap.get(key);
                                                const slotDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0);
                                                return (
                                                    <button
                                                        key={`${key}-${day.toISOString()}`}
                                                        type="button"
                                                        className={`profile-calendar__cell ${isAvailable ? 'is-available' : 'is-unavailable'}`}
                                                        onClick={() => isAvailable && openEventModal(slotDate)}
                                                        disabled={!isAvailable}
                                                        title={isAvailable ? 'Schedule a session' : 'Unavailable'}
                                                    />
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="schedule-list">
                                {combinedAgenda.length > 0 ? (
                                    combinedAgenda.map((item) => (
                                        <div key={item.id} className="schedule-item">
                                            <div>
                                                <strong>{item.title}</strong>
                                                <span>{item.type}</span>
                                            </div>
                                            <span>{formatDateTime(item.startsAt)}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p>No upcoming schedule items.</p>
                                )}
                            </div>
                        )}
                    </section>
                </>
            )}
            <PsychologistBookingModal
                open={bookingOpen}
                psychologist={user.role === 'psychologist' ? user : null}
                onClose={() => setBookingOpen(false)}
            />
            <Modal
                isOpen={eventModalOpen}
                onClose={() => setEventModalOpen(false)}
                title="Schedule a session"
                size="lg"
                className="profile-schedule-modal"
            >
                <div className="profile-schedule-modal__body">
                    <div className="form-group">
                        <label>Title</label>
                        <input
                            type="text"
                            value={eventDraft.title}
                            onChange={(e) => setEventDraft((prev) => ({ ...prev, title: e.target.value }))}
                            placeholder="Session title"
                        />
                    </div>
                    <div className="form-group">
                        <label>Invitees (email)</label>
                        <input
                            type="text"
                            value={eventDraft.invitees}
                            onChange={(e) => setEventDraft((prev) => ({ ...prev, invitees: e.target.value }))}
                            placeholder="client@example.com, colleague@example.com"
                        />
                    </div>
                    <div className="profile-schedule-modal__grid">
                        <div className="form-group">
                            <label>Start</label>
                            <input
                                type="datetime-local"
                                value={eventDraft.startsAt}
                                onChange={(e) => setEventDraft((prev) => ({ ...prev, startsAt: e.target.value }))}
                            />
                        </div>
                        <div className="form-group">
                            <label>End</label>
                            <input
                                type="datetime-local"
                                value={eventDraft.endsAt}
                                onChange={(e) => setEventDraft((prev) => ({ ...prev, endsAt: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div className="profile-schedule-modal__grid">
                        <div className="form-group">
                            <label>Event type</label>
                            <select
                                value={eventDraft.eventType}
                                onChange={(e) => setEventDraft((prev) => ({ ...prev, eventType: e.target.value }))}
                            >
                                <option value="meeting">Meeting</option>
                                <option value="video_call">Video call</option>
                                <option value="consultation">Consultation</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Timezone</label>
                            <input
                                type="text"
                                value={eventDraft.timezone}
                                onChange={(e) => setEventDraft((prev) => ({ ...prev, timezone: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            rows="3"
                            value={eventDraft.description}
                            onChange={(e) => setEventDraft((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="Add notes for this session"
                        />
                    </div>
                    <label className="profile-schedule-modal__toggle">
                        <input
                            type="checkbox"
                            checked={eventDraft.isVideoCall}
                            onChange={(e) => setEventDraft((prev) => ({ ...prev, isVideoCall: e.target.checked }))}
                        />
                        Video call
                    </label>
                </div>
                <div className="profile-schedule-modal__actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setEventModalOpen(false)}>
                        Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={handleEventSave} disabled={eventSaving}>
                        {eventSaving ? 'Saving...' : 'Send invite'}
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default UserProfile;


