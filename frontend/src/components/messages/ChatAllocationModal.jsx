import React, { useEffect, useMemo, useState } from 'react';

const PRESETS = [10, 20, 30];

const ChatAllocationModal = ({
    open,
    onClose,
    onConfirm,
    psychologist,
    remainingMinutes = 30,
    dailyLimit = 30,
    loading = false
}) => {
    const [minutes, setMinutes] = useState(10);
    const [customValue, setCustomValue] = useState('');

    const safeRemaining = Math.max(0, Number(remainingMinutes) || 0);
    const safeLimit = Math.max(0, Number(dailyLimit) || safeRemaining || 30);
    const computedLimit = safeLimit || safeRemaining || 30;
    const computedRemaining = safeRemaining || computedLimit;
    const maxAllowed = Math.max(0, Math.min(computedRemaining, computedLimit));
    const disabled = minutes <= 0 || minutes > maxAllowed || loading;

    useEffect(() => {
        if (!open) {
            return;
        }
        const fallback = Math.min(PRESETS[0], maxAllowed || PRESETS[0]);
        const nextMinutes = fallback > 0 ? fallback : 1;
        setMinutes(nextMinutes);
        setCustomValue('');
    }, [open, maxAllowed]);

    const handlePreset = (value) => {
        setMinutes(value);
        setCustomValue('');
    };

    const handleCustomChange = (event) => {
        const value = Number(event.target.value);
        setCustomValue(event.target.value);
        if (Number.isFinite(value)) {
            setMinutes(value);
        }
    };

    const title = useMemo(() => {
        if (!psychologist) return 'Allocate minutes';
        return `Allocate minutes for ${psychologist.display_name || 'support session'}`;
    }, [psychologist]);

    if (!open) {
        return null;
    }

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal-card">
                <div className="modal-header">
                    <h3>{title}</h3>
                    <button
                        type="button"
                        className="modal-close"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>
                <div className="modal-body">
                    <p className="modal-subtitle">
                        You have <strong>{safeRemaining}</strong> minutes available today.
                        Choose how many you'd like to spend on this session.
                    </p>
                    <div className="allocation-presets">
                        {PRESETS.map((value) => (
                            <button
                                key={value}
                                type="button"
                                className={`allocation-chip ${minutes === value ? 'active' : ''}`}
                                onClick={() => handlePreset(value)}
                                disabled={value > maxAllowed}
                            >
                                {value} min
                            </button>
                        ))}
                        <div className="allocation-custom">
                            <label htmlFor="custom-minutes">Custom</label>
                            <input
                                id="custom-minutes"
                                type="number"
                                min="1"
                                max={computedLimit || 30}
                                step="5"
                                value={customValue}
                                onChange={handleCustomChange}
                                placeholder="Enter minutes"
                            />
                        </div>
                    </div>
                    <p className="modal-hint">
                        Sessions end automatically when allocated minutes expire (daily max {safeLimit} min).
                    </p>
                </div>
                <div className="modal-actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary"
                        disabled={disabled}
                        onClick={() => onConfirm(Math.min(minutes, maxAllowed))}
                    >
                        {loading ? 'Allocating...' : `Start ${minutes}-min chat`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatAllocationModal;
