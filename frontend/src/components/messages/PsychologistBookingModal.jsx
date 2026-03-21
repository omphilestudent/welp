import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../common/Modal';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatAmountMinor } from '../../utils/currency';
import { addDays, startOfWeek, format } from 'date-fns';

const DEFAULT_DURATION_OPTIONS = [30, 45, 60, 90];
const WELP_FEE_MINOR = 200 * 100;

const formatDateTime = (value) => {
    if (!value) return '';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleString();
};

const deriveBaseAmountMinor = (rate, durationMinutes) => {
    if (!rate) return 0;
    const amountMinor = Number(rate.amount_minor || rate.amountMinor || 0);
    const duration = Number(durationMinutes || 0);
    if (rate.duration_type === 'per_minute') {
        return amountMinor * duration;
    }
    return Math.round(amountMinor * (duration / 60));
};

const PsychologistBookingModal = ({ open, psychologist, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [rates, setRates] = useState([]);
    const [availability, setAvailability] = useState([]);
    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [selectedRateId, setSelectedRateId] = useState('');
    const [scheduledAt, setScheduledAt] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [step, setStep] = useState('select');
    const [booking, setBooking] = useState(null);
    const [payment, setPayment] = useState(null);

    useEffect(() => {
        if (!open || !psychologist?.id) return;
        setLoading(true);
        setRates([]);
        setAvailability([]);
        setSelectedRateId('');
        setScheduledAt('');
        setDurationMinutes(60);
        setStep('select');
        setBooking(null);
        setPayment(null);
        Promise.all([
            api.get(`/psychologists/${psychologist.id}/rates`),
            api.get(`/psychologists/${psychologist.id}/availability`, {
                params: { weekStart: weekStart.toISOString().slice(0, 10) }
            })
        ])
            .then(([ratesRes, availabilityRes]) => {
                setRates(ratesRes.data?.rates || []);
                setAvailability(availabilityRes.data?.availability || []);
            })
            .catch((error) => {
                console.error('Failed to load booking data', error);
                toast.error('Failed to load booking details');
            })
            .finally(() => setLoading(false));
    }, [open, psychologist?.id, weekStart]);

    const availabilityMap = useMemo(() => {
        const map = new Map();
        availability.forEach((slot) => {
            map.set(`${slot.dayOfWeek}-${slot.hour}`, slot.isAvailable);
        });
        return map;
    }, [availability]);

    const weekDays = useMemo(
        () => Array.from({ length: 7 }, (_, idx) => addDays(weekStart, idx)),
        [weekStart]
    );

    const activeRates = useMemo(
        () => rates.filter((rate) => rate.is_active ?? rate.isActive ?? true),
        [rates]
    );

    const selectedRate = useMemo(
        () => activeRates.find((rate) => String(rate.id) === String(selectedRateId)) || activeRates[0] || null,
        [activeRates, selectedRateId]
    );

    useEffect(() => {
        if (activeRates.length && !selectedRateId) {
            setSelectedRateId(activeRates[0].id);
        }
    }, [activeRates, selectedRateId]);

    const baseAmountMinor = deriveBaseAmountMinor(selectedRate, durationMinutes);
    const totalAmountMinor = baseAmountMinor + WELP_FEE_MINOR;

    const handleSelectSlot = (slot) => {
        if (!slot?.scheduled_for) return;
        const dt = new Date(slot.scheduled_for);
        if (Number.isNaN(dt.getTime())) return;
        const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        setScheduledAt(localIso);
    };

    const handleContinue = async () => {
        if (!selectedRate) {
            toast.error('Select a rate to continue');
            return;
        }
        if (!scheduledAt) {
            toast.error('Select a booking time');
            return;
        }
        setLoading(true);
        try {
            const { data } = await api.post(`/psychologists/${psychologist.id}/bookings`, {
                rateId: selectedRate.id,
                scheduledAt: new Date(scheduledAt).toISOString(),
                durationMinutes: Number(durationMinutes) || 60
            });
            setBooking(data?.booking || null);
            setStep('checkout');
        } catch (error) {
            const message = error?.response?.data?.error || 'Failed to create booking';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckout = async () => {
        if (!booking?.id) return;
        setLoading(true);
        try {
            const { data } = await api.post(`/psychologists/bookings/${booking.id}/checkout`);
            setPayment(data?.payment || null);
            setStep('confirmed');
            toast.success('Payment completed');
        } catch (error) {
            const message = error?.response?.data?.error || 'Payment failed';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const renderSelectStep = () => (
        <div className="msg-booking">
            <div className="msg-booking-block">
                <h4>Rates</h4>
                {activeRates.length === 0 ? (
                    <p>No active rates available yet.</p>
                ) : (
                    <div className="msg-booking-rates">
                        {activeRates.map((rate) => (
                            <label key={rate.id} className={`msg-booking-rate ${String(rate.id) === String(selectedRateId) ? 'is-selected' : ''}`}>
                                <input
                                    type="radio"
                                    name="rate"
                                    checked={String(rate.id) === String(selectedRateId)}
                                    onChange={() => setSelectedRateId(rate.id)}
                                />
                                <div>
                                    <strong>{rate.label || 'Session rate'}</strong>
                                    <div className="msg-booking-rate-meta">
                                        {formatAmountMinor(rate.amount_minor, rate.currency_code)} {rate.duration_type === 'per_minute' ? 'per minute' : 'per hour'}
                                    </div>
                                </div>
                            </label>
                        ))}
                    </div>
                )}
            </div>

            <div className="msg-booking-block">
                <h4>Session length</h4>
                <div className="msg-booking-duration">
                    {DEFAULT_DURATION_OPTIONS.map((option) => (
                        <button
                            type="button"
                            key={option}
                            className={`msg-chip ${durationMinutes === option ? 'is-active' : ''}`}
                            onClick={() => setDurationMinutes(option)}
                        >
                            {option} min
                        </button>
                    ))}
                </div>
            </div>

            <div className="msg-booking-block">
                <h4>Pick a time</h4>
                <div className="msg-week-nav">
                    <button type="button" className="msg-btn msg-btn-outline msg-btn-small" onClick={() => setWeekStart(addDays(weekStart, -7))}>
                        Previous
                    </button>
                    <span>{format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d')}</span>
                    <button type="button" className="msg-btn msg-btn-outline msg-btn-small" onClick={() => setWeekStart(addDays(weekStart, 7))}>
                        Next
                    </button>
                </div>
                <div className="msg-week-grid">
                    <div className="msg-week-grid__row msg-week-grid__header">
                        <span />
                        {weekDays.map((day) => (
                            <span key={day.toISOString()}>{format(day, 'EEE d')}</span>
                        ))}
                    </div>
                    {Array.from({ length: 24 }, (_, hour) => (
                        <div key={hour} className="msg-week-grid__row">
                            <span className="msg-week-grid__hour">{String(hour).padStart(2, '0')}:00</span>
                            {weekDays.map((day) => {
                                const dayOfWeek = day.getDay();
                                const key = `${dayOfWeek}-${hour}`;
                                const isAvailable = availabilityMap.get(key);
                                const slotDate = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), hour));
                                const localIso = new Date(slotDate.getTime() - slotDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                                return (
                                    <button
                                        type="button"
                                        key={`${key}-${day.toISOString()}`}
                                        className={`msg-week-grid__cell ${isAvailable ? 'is-available' : 'is-unavailable'} ${scheduledAt === localIso ? 'is-selected' : ''}`}
                                        onClick={() => isAvailable && setScheduledAt(localIso)}
                                        disabled={!isAvailable}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
                <label className="msg-booking-field">
                    Choose date & time
                    <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(event) => setScheduledAt(event.target.value)}
                    />
                </label>
            </div>

            <div className="msg-booking-summary">
                <div>
                    <span>Psychologist fee</span>
                    <strong>{formatAmountMinor(baseAmountMinor, selectedRate?.currency_code || 'USD') || '—'}</strong>
                </div>
                <div>
                    <span>Welp processing fee</span>
                    <strong>{formatAmountMinor(WELP_FEE_MINOR, selectedRate?.currency_code || 'USD') || '—'}</strong>
                </div>
                <div className="msg-booking-total">
                    <span>Total</span>
                    <strong>{formatAmountMinor(totalAmountMinor, selectedRate?.currency_code || 'USD') || '—'}</strong>
                </div>
            </div>
        </div>
    );

    const renderCheckoutStep = () => (
        <div className="msg-booking">
            <div className="msg-booking-block">
                <h4>Booking summary</h4>
                <p><strong>Psychologist:</strong> {psychologist?.display_name || 'Psychologist'}</p>
                <p><strong>Scheduled for:</strong> {scheduledAt ? new Date(scheduledAt).toLocaleString() : '—'}</p>
                <p><strong>Session length:</strong> {durationMinutes} minutes</p>
                <p><strong>Rate:</strong> {selectedRate?.label || 'Session rate'}</p>
            </div>
            <div className="msg-booking-summary">
                <div>
                    <span>Psychologist fee</span>
                    <strong>{formatAmountMinor(baseAmountMinor, selectedRate?.currency_code || 'USD')}</strong>
                </div>
                <div>
                    <span>Welp processing fee</span>
                    <strong>{formatAmountMinor(WELP_FEE_MINOR, selectedRate?.currency_code || 'USD')}</strong>
                </div>
                <div className="msg-booking-total">
                    <span>Total due</span>
                    <strong>{formatAmountMinor(totalAmountMinor, selectedRate?.currency_code || 'USD')}</strong>
                </div>
            </div>
        </div>
    );

    const renderConfirmedStep = () => (
        <div className="msg-booking">
            <div className="msg-booking-block">
                <h4>Payment confirmed</h4>
                <p>Your session is booked. Weâ€™ll notify the psychologist and send a calendar reminder.</p>
                {payment && (
                    <div className="msg-booking-summary">
                        <div>
                            <span>Paid</span>
                            <strong>{formatAmountMinor(payment.total_amount_minor, payment.currency_code || 'USD')}</strong>
                        </div>
                        <div>
                            <span>Booking ID</span>
                            <strong>{payment.booking_id}</strong>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={`Book a session${psychologist?.display_name ? ` with ${psychologist.display_name}` : ''}`}
            size="large"
            className="msg-booking-modal"
        >
            {loading && <p className="msg-loading-inline">Loading...</p>}
            {!loading && step === 'select' && renderSelectStep()}
            {!loading && step === 'checkout' && renderCheckoutStep()}
            {!loading && step === 'confirmed' && renderConfirmedStep()}
            <div className="msg-booking-actions">
                {step !== 'confirmed' && (
                    <>
                        {step === 'select' && (
                            <button type="button" className="msg-btn msg-btn-primary" onClick={handleContinue} disabled={loading}>
                                Continue to checkout
                            </button>
                        )}
                        {step === 'checkout' && (
                            <>
                                <button type="button" className="msg-btn msg-btn-outline" onClick={() => setStep('select')} disabled={loading}>
                                    Back
                                </button>
                                <button type="button" className="msg-btn msg-btn-primary" onClick={handleCheckout} disabled={loading}>
                                    Pay now
                                </button>
                            </>
                        )}
                    </>
                )}
                {step === 'confirmed' && (
                    <button type="button" className="msg-btn msg-btn-primary" onClick={onClose}>
                        Close
                    </button>
                )}
            </div>
        </Modal>
    );
};

export default PsychologistBookingModal;
