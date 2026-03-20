import React, { useMemo, useState } from 'react';
import { FaStar } from 'react-icons/fa';

const starValues = [1, 2, 3, 4, 5];

const SessionRatingModal = ({ session, open, onSubmit, onSkip, submitting }) => {
    const [ratingValue, setRatingValue] = useState(0);
    const [hovered, setHovered] = useState(0);
    const [feedback, setFeedback] = useState('');

    const psychologistName = session?.psychologist?.display_name || 'Psychologist';
    const sessionDate = session?.ended_at ? new Date(session.ended_at).toLocaleString() : null;

    const effectiveRating = hovered || ratingValue;
    const canSubmit = ratingValue > 0 && !submitting;

    const title = useMemo(() => {
        if (sessionDate) return `How was your session on ${sessionDate}?`;
        return 'How was your session?';
    }, [sessionDate]);

    if (!open || !session) return null;

    const handleSubmit = () => {
        if (!canSubmit) return;
        onSubmit?.({ ratingValue, feedback });
    };

    return (
        <div className="msg-modal-overlay" role="dialog" aria-modal="true">
            <div className="msg-modal-content msg-rating-modal">
                <div className="msg-modal-header">
                    <h3 className="msg-modal-title">Rate your session</h3>
                    <button className="msg-modal-close" type="button" onClick={onSkip} aria-label="Close">
                        ×
                    </button>
                </div>
                <div className="msg-modal-body">
                    <p className="msg-rating-title">{title}</p>
                    <p className="msg-rating-subtitle">Psychologist: {psychologistName}</p>
                    <div className="msg-rating-stars">
                        {starValues.map((value) => (
                            <button
                                key={value}
                                type="button"
                                className={`msg-rating-star ${effectiveRating >= value ? 'is-active' : ''}`}
                                onMouseEnter={() => setHovered(value)}
                                onMouseLeave={() => setHovered(0)}
                                onClick={() => setRatingValue(value)}
                                aria-label={`Rate ${value} star`}
                            >
                                <FaStar />
                            </button>
                        ))}
                    </div>
                    <textarea
                        className="msg-textarea msg-rating-textarea"
                        placeholder="Optional feedback..."
                        value={feedback}
                        onChange={(event) => setFeedback(event.target.value)}
                        rows={4}
                    />
                </div>
                <div className="msg-modal-footer">
                    <button type="button" className="msg-btn msg-btn-outline" onClick={onSkip} disabled={submitting}>
                        Remind me later
                    </button>
                    <button type="button" className="msg-btn msg-btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
                        {submitting ? 'Submitting…' : 'Submit rating'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SessionRatingModal;
