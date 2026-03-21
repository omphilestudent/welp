import React, { useMemo, useState } from 'react';
import Modal from '../common/Modal';
import { formatAmountMinor } from '../../utils/currency';

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

const CallDurationModal = ({ open, onClose, onConfirm, entitlement, callFeeMinor }) => {
    const [selectedMinutes, setSelectedMinutes] = useState(30);
    const planTier = entitlement?.plan_tier || 'free';
    const remaining = Number(entitlement?.minutes_remaining ?? 0);
    const canConfirm = planTier !== 'premium' || remaining <= 0 || selectedMinutes <= remaining;
    const feeLabel = useMemo(() => {
        if (!callFeeMinor) return null;
        return formatAmountMinor(callFeeMinor, entitlement?.currency_code || 'USD');
    }, [callFeeMinor, entitlement?.currency_code]);

    return (
        <Modal isOpen={open} onClose={onClose} title="Select call duration" size="medium" className="msg-call-duration-modal">
            <div className="msg-booking">
                <p>Select how long you want to call this client.</p>
                {planTier === 'premium' && (
                    <p className="msg-modal-hint">Remaining minutes for this client: {remaining}</p>
                )}
                {planTier === 'free' && feeLabel && (
                    <p className="msg-modal-hint">Free plan call fee for this client: {feeLabel}</p>
                )}
                <div className="msg-booking-duration">
                    {DURATION_OPTIONS.map((option) => (
                        <button
                            type="button"
                            key={option}
                            className={`msg-chip ${selectedMinutes === option ? 'is-active' : ''}`}
                            onClick={() => setSelectedMinutes(option)}
                        >
                            {option} min
                        </button>
                    ))}
                </div>
            </div>
            <div className="msg-booking-actions">
                <button type="button" className="msg-btn msg-btn-outline" onClick={onClose}>
                    Cancel
                </button>
                <button
                    type="button"
                    className="msg-btn msg-btn-primary"
                    onClick={() => onConfirm(selectedMinutes)}
                    disabled={!canConfirm}
                >
                    Start call
                </button>
            </div>
        </Modal>
    );
};

export default CallDurationModal;
