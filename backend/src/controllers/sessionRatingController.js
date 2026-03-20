const { query } = require('../utils/database');
const {
    getPendingRatingsForUser,
    upsertRating,
    deferRating,
    getPsychologistRatingSummary
} = require('../services/psychologistSessionRatingService');

const ensureConversationEligible = async ({ conversationId, userId }) => {
    const result = await query(
        `SELECT id, employee_id, psychologist_id, status, ended_at
         FROM conversations
         WHERE id = $1`,
        [conversationId]
    );
    if (result.rows.length === 0) {
        return { ok: false, error: 'Session not found' };
    }
    const convo = result.rows[0];
    if (convo.employee_id !== userId) {
        return { ok: false, error: 'You are not allowed to rate this session' };
    }
    if (String(convo.status || '').toLowerCase() !== 'ended' || !convo.ended_at) {
        return { ok: false, error: 'Session is not yet completed' };
    }
    return { ok: true, convo };
};

const submitSessionRating = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const ratingValue = Number(req.body?.ratingValue ?? req.body?.rating ?? req.body?.rating_value);
        const reviewText = req.body?.reviewText ?? req.body?.review_text ?? req.body?.feedback;

        if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        const eligibility = await ensureConversationEligible({ conversationId: sessionId, userId: req.user.id });
        if (!eligibility.ok) {
            return res.status(400).json({ error: eligibility.error });
        }

        const { convo } = eligibility;
        const result = await upsertRating({
            conversationId: convo.id,
            psychologistId: convo.psychologist_id,
            reviewerId: req.user.id,
            ratingValue,
            reviewText
        });

        if (result.isDuplicate) {
            return res.status(409).json({ error: 'You have already rated this session', rating: result.rating });
        }

        return res.status(201).json({ rating: result.rating });
    } catch (error) {
        console.error('Submit session rating error:', error);
        return res.status(500).json({ error: 'Failed to submit rating' });
    }
};

const deferSessionRating = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const remindAfterHours = Number(req.body?.remindAfterHours || 24);

        const eligibility = await ensureConversationEligible({ conversationId: sessionId, userId: req.user.id });
        if (!eligibility.ok) {
            return res.status(400).json({ error: eligibility.error });
        }

        const { convo } = eligibility;
        const record = await deferRating({
            conversationId: convo.id,
            psychologistId: convo.psychologist_id,
            reviewerId: req.user.id,
            remindAfterHours: Number.isFinite(remindAfterHours) ? remindAfterHours : 24
        });

        return res.status(200).json({ rating: record });
    } catch (error) {
        console.error('Defer session rating error:', error);
        return res.status(500).json({ error: 'Failed to defer rating' });
    }
};

const getPendingSessionRatings = async (req, res) => {
    try {
        const rows = await getPendingRatingsForUser(req.user.id);
        return res.json({ sessions: rows });
    } catch (error) {
        console.error('Get pending ratings error:', error);
        return res.status(500).json({ error: 'Failed to load pending ratings' });
    }
};

module.exports = {
    submitSessionRating,
    deferSessionRating,
    getPendingSessionRatings,
    getPsychologistSummary: async (req, res) => {
        try {
            const { psychologistId } = req.params;
            if (!psychologistId) {
                return res.status(400).json({ error: 'psychologistId is required' });
            }
            const summary = await getPsychologistRatingSummary(psychologistId);
            return res.json(summary);
        } catch (error) {
            console.error('Get psychologist rating summary error:', error);
            return res.status(500).json({ error: 'Failed to load rating summary' });
        }
    }
};
