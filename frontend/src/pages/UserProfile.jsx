import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { addDays, addHours, format, startOfDay, startOfWeek } from 'date-fns';
import api from '../services/api';
import Loading from '../components/common/Loading';
import AvatarImage from '../components/common/AvatarImage';
import { useAuth } from '../hooks/useAuth';
import PsychologistBookingModal from '../components/messages/PsychologistBookingModal';
import { formatMoneyForUser } from '../utils/currency';
import Modal from '../components/common/Modal';
import outlookHeader from '../../../salesforce images/outlook.png';
import toast from 'react-hot-toast';

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
    const [scheduleView, setScheduleView] = useState('week');
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [events, setEvents] = useState([]);
    const [eventModalOpen, setEventModalOpen] = useState(false);
    const [eventSaving, setEventSaving] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [eventError, setEventError] = useState('');
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

    const { user, psychologistProfile, schedule = [], externalEvents = [] } = profile || {};
    const availabilitySlots = Array.isArray(psychologistProfile?.availability)
        ? psychologistProfile.availability
        : [];
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

    const weekStart = startOfWeek(calendarDate, { weekStartsOn: 1 });
    const weekDays = Array.from({ length: 7 }, (_, idx) => addDays(weekStart, idx));
    const hours = Array.from({ length: 24 }, (_, idx) => idx);

    const weekStartDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate(), 0, 0, 0);
    const weekEndDate = addDays(weekStartDate, 7);
    const viewStartDate = scheduleView === 'day' ? startOfDay(calendarDate) : weekStartDate;
    const viewEndDate = addDays(viewStartDate, scheduleView === 'day' ? 1 : 7);
    const viewDays = scheduleView === 'day'
        ? [startOfDay(calendarDate)]
        : weekDays;
    const rangeLabel = scheduleView === 'day'
        ? format(calendarDate, 'MMM d, yyyy')
        : `${format(weekStart, 'MMM d')} – ${format(addDays(weekStart, 6), 'MMM d')}`;

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

    const viewAgenda = useMemo(() => combinedAgenda.filter((item) => {
        const start = new Date(item.startsAt);
        if (Number.isNaN(start.getTime())) return false;
        return start >= viewStartDate && start < viewEndDate;
    }), [combinedAgenda, viewStartDate, viewEndDate]);

    const eventSlotMap = useMemo(() => {
        const map = new Map();
        viewAgenda.forEach((item) => {
            const start = new Date(item.startsAt);
            if (Number.isNaN(start.getTime())) return;
            const dayKey = format(start, 'yyyy-MM-dd');
            const hourKey = start.getHours();
            const key = `${dayKey}-${hourKey}`;
            const list = map.get(key) || [];
            list.push(item);
            map.set(key, list);
        });
        return map;
    }, [viewAgenda]);

    const openEventModal = (slotDate) => {
        const start = slotDate;
        const end = addHours(start, 1);
        setSelectedSlot(start);
        setEventError('');
        setEventDraft((prev) => ({
            ...prev,
            title: prev.title || `Session with ${user.display_name || 'psychologist'}`,
            startsAt: start.toISOString().slice(0, 16),
            endsAt: end.toISOString().slice(0, 16)
        }));
        setEventModalOpen(true);
    };

    const isEmailListValid = (value) => {
        if (!value) return true;
        const emails = value.split(/[,;]+/).map((item) => item.trim()).filter(Boolean);
        if (emails.length === 0) return true;
        return emails.every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    };

    const hasOverlap = (startsAt, endsAt) => {
        const start = new Date(startsAt);
        const end = new Date(endsAt);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
        return combinedAgenda.some((item) => {
            const existingStart = new Date(item.startsAt);
            const existingEnd = item.endsAt ? new Date(item.endsAt) : addHours(existingStart, 1);
            if (Number.isNaN(existingStart.getTime()) || Number.isNaN(existingEnd.getTime())) return false;
            return start < existingEnd && end > existingStart;
        });
    };

    const handleEventSave = async () => {
        if (!eventDraft.title || !eventDraft.startsAt || !eventDraft.endsAt) {
            setEventError('Please provide a title and start/end time.');
            return;
        }
        if (!isEmailListValid(eventDraft.invitees)) {
            setEventError('Please enter valid invitee email addresses.');
            return;
        }
        if (new Date(eventDraft.endsAt) <= new Date(eventDraft.startsAt)) {
            setEventError('End time must be after the start time.');
            return;
        }
        if (hasOverlap(eventDraft.startsAt, eventDraft.endsAt)) {
            setEventError('That time overlaps an existing booking.');
            return;
        }
        setEventSaving(true);
        setEventError('');
        try {
            const payload = {
                title: eventDraft.title,
                description: eventDraft.description,
                startsAt: new Date(eventDraft.startsAt).toISOString(),
                endsAt: new Date(eventDraft.endsAt).toISOString(),
                timezone: eventDraft.timezone,
                eventType: eventDraft.isVideoCall ? 'video_call' : eventDraft.eventType,
                isVideoCall: eventDraft.isVideoCall,
                invitees: eventDraft.invitees
            };
            const { data } = await api.post(`/psychologists/${user.id}/events`, payload);
            if (data?.event) setEvents((prev) => [...prev, data.event]);
            toast.success('Invite sent and event scheduled.');
            closeEventModal();
        } catch (err) {
            setEventError(err?.response?.data?.error || 'Failed to create event');
        } finally {
            setEventSaving(false);
        }
    };

    const closeEventModal = () => {
        setEventModalOpen(false);
        setSelectedSlot(null);
        setEventError('');
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

    if (loading) return <Loading />;
    if (error) return <div className="alert alert-error">{error}</div>;
    if (!profile?.user) return null;

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
                                            {formatMoneyForUser(rate.amount_minor, currentUser) || '—'} {rate.duration_minutes ? `${rate.duration_minutes} min` : (rate.duration_type === 'per_minute' ? 'per minute' : 'per hour')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p>No rates published yet.</p>
                        )}
                        {activeRate && (
                            <p className="profile-rate-note">
                                Active rate: {formatMoneyForUser(activeRate.amount_minor, currentUser)} {activeRate.duration_minutes ? `${activeRate.duration_minutes} min` : (activeRate.duration_type === 'per_minute' ? 'per minute' : 'per hour')}.
                            </p>
                        )}
                    </section>

                                        <section className="profile-section-card profile-schedule-card">
                        <div className="profile-calendar-shell">
                            <div className="profile-calendar-header">
                                <div className="profile-calendar-title">
                                    <h3>Scheduling</h3>
                                    <span className="profile-calendar-range">
                                        {rangeLabel}
                                    </span>
                                    <p>Click a time block to create an invite.</p>
                                </div>
                                <div className="profile-calendar-controls">
                                    <div className="profile-calendar-nav">
                                        <button type="button" className="btn btn-secondary btn-small" onClick={() => setCalendarDate(addDays(calendarDate, scheduleView === 'day' ? -1 : -7))}>
                                            Prev
                                        </button>
                                        <button type="button" className="btn btn-outline btn-small" onClick={() => setCalendarDate(new Date())}>
                                            Today
                                        </button>
                                        <button type="button" className="btn btn-secondary btn-small" onClick={() => setCalendarDate(addDays(calendarDate, scheduleView === 'day' ? 1 : 7))}>
                                            Next
                                        </button>
                                    </div>
                                    <div className="profile-calendar-view-toggle" role="group" aria-label="Calendar view">
                                        <button
                                            type="button"
                                            className={`btn btn-small ${scheduleView === 'week' ? 'btn-primary' : 'btn-outline'}`}
                                            onClick={() => setScheduleView('week')}
                                        >
                                            Week
                                        </button>
                                        <button
                                            type="button"
                                            className={`btn btn-small ${scheduleView === 'day' ? 'btn-primary' : 'btn-outline'}`}
                                            onClick={() => setScheduleView('day')}
                                        >
                                            Day
                                        </button>
                                    </div>
                                </div>
                                <div className="profile-calendar-brand" aria-hidden="true">
                                    <img src={outlookHeader} alt="" />
                                </div>
                            </div>
                            <div className="profile-calendar-legend">
                                <span className="profile-calendar-legend__item is-available">Available</span>
                                <span className="profile-calendar-legend__item is-unavailable">Unavailable</span>
                                <span className="profile-calendar-legend__item is-booked">Booked</span>
                            </div>

                            <div className="profile-calendar-body">
                                {scheduleView === 'week' || scheduleView === 'day' ? (
                                    <div className={`profile-calendar ${scheduleView === 'day' ? 'profile-calendar--day' : ''}`}>
                                        <div className="profile-calendar__grid">
                                            <div className="profile-calendar__row profile-calendar__row--header">
                                                <span className="profile-calendar__corner" />
                                                {viewDays.map((day) => (
                                                    <div key={day.toISOString()} className="profile-calendar__day-label">
                                                        <strong>{format(day, 'EEE')}</strong>
                                                        <span>{format(day, scheduleView === 'day' ? 'MMM d' : 'd')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            {hours.map((hour) => (
                                                <div key={hour} className="profile-calendar__row">
                                                    <span className="profile-calendar__hour">{String(hour).padStart(2, '0')}:00</span>
                                                    {viewDays.map((day) => {
                                                        const dayIndex = day.getDay();
                                                        const key = `${dayIndex}-${hour}`;
                                                        const isAvailable = availabilityMap.get(key);
                                                        const slotDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0);
                                                        const slotKey = `${format(slotDate, 'yyyy-MM-dd')}-${hour}`;
                                                        const eventsForSlot = eventSlotMap.get(slotKey) || [];
                                                        return (
                                                            <button
                                                                key={`${key}-${day.toISOString()}`}
                                                                type="button"
                                                                className={`profile-calendar__cell ${isAvailable ? 'is-available' : 'is-unavailable'} ${selectedSlot && slotDate.getTime() === selectedSlot.getTime() ? 'is-selected' : ''}`}
                                                                onClick={() => isAvailable && openEventModal(slotDate)}
                                                                disabled={!isAvailable}
                                                                title={isAvailable ? 'Schedule a session' : 'Unavailable'}
                                                            >
                                                                {eventsForSlot.slice(0, 2).map((item) => (
                                                                    <span key={item.id} className={`profile-calendar__event profile-calendar__event--${item.source}`}>
                                                                        {item.title}
                                                                    </span>
                                                                ))}
                                                                {eventsForSlot.length > 2 && (
                                                                    <span className="profile-calendar__event profile-calendar__event--more">+{eventsForSlot.length - 2} more</span>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="schedule-list">
                                        {viewAgenda.length > 0 ? (
                                            viewAgenda.map((item) => (
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
                            </div>
                        </div>
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
                onClose={closeEventModal}
                title="Schedule a session"
                size="lg"
                className="profile-schedule-modal"
            >
                <div className="profile-event-modal">
                    <div className="profile-event-modal__header">
                        <div>
                            <h4>{selectedSlot ? 'New session' : 'Schedule a session'}</h4>
                            <span>{selectedSlot ? format(selectedSlot, 'EEEE, MMM d • HH:mm') : 'Pick a slot in the calendar'}</span>
                        </div>
                        <div className="profile-event-modal__timezone">
                            Timezone: {eventDraft.timezone}
                        </div>
                    </div>
                    {eventError && <div className="alert alert-error">{eventError}</div>}
                    <div className="profile-event-modal__body">
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
                                    disabled={eventDraft.isVideoCall}
                                >
                                    <option value="meeting">Meeting</option>
                                    <option value="video_call">Video call</option>
                                    <option value="consultation">Consultation</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Video call</label>
                                <label className="profile-schedule-modal__toggle">
                                    <input
                                        type="checkbox"
                                        checked={eventDraft.isVideoCall}
                                        onChange={(e) => setEventDraft((prev) => ({ ...prev, isVideoCall: e.target.checked }))}
                                    />
                                    Create a scheduled video session
                                </label>
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
                    </div>
                    <div className="profile-event-modal__actions">
                        <button type="button" className="btn btn-secondary" onClick={closeEventModal}>
                            Cancel
                        </button>
                        <button type="button" className="btn btn-primary" onClick={handleEventSave} disabled={eventSaving}>
                            {eventSaving ? 'Saving...' : 'Send invite'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default UserProfile;







