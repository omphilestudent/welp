import React, { useMemo, useState } from 'react';
import Modal from '../common/Modal';
import { addDays, format, startOfWeek } from 'date-fns';
import { formatAmountMinor } from '../../utils/currency';

const EmployeeVideoCallModal = ({
    open,
    onClose,
    availability,
    rates,
    weekStart,
    onWeekChange,
    onConfirm,
    hasSavedCard,
    loading
}) => {
    const [selectedRateId, setSelectedRateId] = useState('');
    const [selectedSlot, setSelectedSlot] = useState('');

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

    const activeRates = useMemo(() => (
        (rates || []).filter((rate) => rate.is_active ?? rate.isActive ?? true)
    ), [rates]);

    const selectedRate = useMemo(() => (
        activeRates.find((rate) => String(rate.id) === String(selectedRateId)) || activeRates[0] || null
    ), [activeRates, selectedRateId]);

    const handleConfirm = () => {
        if (!selectedSlot || !selectedRate) return;
        onConfirm({
            scheduledAt: selectedSlot,
            durationMinutes: Number(selectedRate.duration_minutes || 60),
            rateId: selectedRate.id
        });
    };

    return (
        <Modal isOpen={open} onClose={onClose} title="Schedule video call" size="large" className="msg-video-call-modal">
            <div className="msg-booking">
                {!hasSavedCard && (
                    <p className="msg-modal-hint">Add a saved card to schedule a paid video call.</p>
                )}
                <div className="msg-booking-block">
                    <h4>Session rates</h4>
                    {activeRates.length === 0 ? (
                        <p className="msg-modal-hint">No rates available yet.</p>
                    ) : (
                        <div className="msg-booking-rates">
                            {activeRates.map((rate) => (
                                <label key={rate.id} className={`msg-booking-rate ${String(rate.id) === String(selectedRate?.id) ? 'is-selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="rate"
                                        checked={String(rate.id) === String(selectedRate?.id)}
                                        onChange={() => setSelectedRateId(rate.id)}
                                    />
                                    <div>
                                        <strong>{rate.label || `${rate.duration_minutes} min session`}</strong>
                                        <div className="msg-booking-rate-meta">
                                            {formatAmountMinor(rate.amount_minor, rate.currency_code)} {rate.duration_minutes ? `${rate.duration_minutes} min` : ''}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
                <div className="msg-booking-block">
                    <h4>Select time</h4>
                    <div className="msg-week-nav">
                        <button type="button" className="msg-btn msg-btn-outline msg-btn-small" onClick={() => onWeekChange(addDays(weekStart, -7))}>
                            Previous
                        </button>
                        <span>{format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d')}</span>
                        <button type="button" className="msg-btn msg-btn-outline msg-btn-small" onClick={() => onWeekChange(addDays(weekStart, 7))}>
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
                                            className={`msg-week-grid__cell ${isAvailable ? 'is-available' : 'is-unavailable'} ${selectedSlot === localIso ? 'is-selected' : ''}`}
                                            onClick={() => isAvailable && setSelectedSlot(localIso)}
                                            disabled={!isAvailable}
                                        />
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="msg-booking-actions">
                <button type="button" className="msg-btn msg-btn-outline" onClick={onClose}>
                    Cancel
                </button>
                <button
                    type="button"
                    className="msg-btn msg-btn-primary"
                    onClick={handleConfirm}
                    disabled={!hasSavedCard || !selectedSlot || !selectedRate || loading}
                >
                    {loading ? 'Scheduling…' : 'Confirm & start call'}
                </button>
            </div>
        </Modal>
    );
};

EmployeeVideoCallModal.defaultProps = {
    availability: [],
    rates: [],
    weekStart: startOfWeek(new Date(), { weekStartsOn: 1 }),
    onWeekChange: () => {},
    onConfirm: () => {},
    hasSavedCard: false,
    loading: false
};

export default EmployeeVideoCallModal;
