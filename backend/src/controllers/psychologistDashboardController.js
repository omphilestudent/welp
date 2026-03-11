const { query } = require('../utils/database');
const { getRoleFlags } = require('../middleware/roleFlags');
const { analyzeSentiment } = require('../services/mlServices');

const determineRiskLevel = (sentiment, score, rating = 3) => {
    if (sentiment === 'negative') {
        if (score >= 0.7) return 'critical';
        if (score >= 0.4) return 'high';
        return 'medium';
    }
    if (rating <= 2) return 'high';
    if (score >= 0.65) return 'low';
    return 'medium';
};

const generateMlLeads = async (psychologistId) => {
    const reviewResult = await query(
        `SELECT
             r.id,
             r.content,
             r.rating,
             json_build_object(
                 'id', u.id,
                 'display_name', COALESCE(u.display_name, 'Employee'),
                 'occupation', COALESCE(u.occupation, 'Employee')
             ) as author,
             c.name as company_name
         FROM reviews r
         JOIN users u ON r.author_id = u.id
         LEFT JOIN companies c ON r.company_id = c.id
         WHERE u.role = 'employee'
           AND (r.rating <= 2 OR r.is_flagged = true OR r.content ILIKE '%stress%' OR r.content ILIKE '%burnout%' OR r.content ILIKE '%anxiety%')
           AND (FALSE = COALESCE(u.is_anonymous, false))
         ORDER BY r.created_at DESC
         LIMIT 6`
    );

    if (reviewResult.rows.length === 0) return false;

    let inserted = 0;
    for (const review of reviewResult.rows) {
        const existing = await query(
            `SELECT 1 FROM psychologist_leads
             WHERE psychologist_id = $1
               AND source_review_id = $2
             LIMIT 1`,
            [psychologistId, review.id]
        );
        if (existing.rows.length > 0) {
            continue;
        }

        const trimmed = String(review.content || '').trim().replace(/\s+/g, ' ');
        const summary = trimmed ? trimmed.slice(0, 160) : 'No additional context provided.';
        let risk = determineRiskLevel('negative', 0.5, review.rating);

        try {
            const sentiment = await analyzeSentiment(review.content || ' ');
            risk = determineRiskLevel(sentiment.sentiment, sentiment.score, review.rating);
        } catch (err) {
            console.warn('Sentiment service unavailable, using heuristic risk level:', err.message);
        }

        await query(
            `INSERT INTO psychologist_leads
             (psychologist_id, employee_id, display_name, risk_level, summary, company, status, source_review_id)
             VALUES ($1, $2, $3, $4, $5, $6, 'new', $7)`,
            [
                psychologistId,
                review.author?.id || null,
                review.author?.display_name || 'Employee',
                risk,
                summary,
                review.company_name || 'Unknown',
                review.id
            ]
        );
        inserted++;
    }

    return inserted > 0;
};

const getDashboardPermissions = async (req, res) => {
    const roleFlags = req.user?.role_flags || getRoleFlags(req.user?.role);
    res.json({
        roleFlags,
        plan: roleFlags.plan || 'free',
        callLimits: {
            minutesPerClient: roleFlags.call_minutes_per_client || 120
        }
    });
};

const getSchedule = async (req, res) => {
    try {
        const result = await query(
            `SELECT *
             FROM psychologist_schedule_items
             WHERE psychologist_id = $1
             ORDER BY scheduled_for ASC`,
            [req.user.id]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Get schedule error:', error);
        return res.status(500).json({ error: 'Failed to load schedule' });
    }
};

const addScheduleItem = async (req, res) => {
    try {
        const { title, scheduledFor, type = 'meeting', location = '' } = req.body || {};
        if (!title || !scheduledFor) {
            return res.status(400).json({ error: 'Title and scheduledFor are required' });
        }

        const result = await query(
            `INSERT INTO psychologist_schedule_items
             (psychologist_id, title, scheduled_for, type, status, location)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [req.user.id, title, new Date(scheduledFor).toISOString(), type, 'scheduled', location]
        );
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Add schedule item error:', error);
        return res.status(500).json({ error: 'Failed to add schedule item' });
    }
};

const getLeads = async (req, res) => {
    try {
        try {
            await generateMlLeads(req.user.id);
        } catch (err) {
            console.warn('ML lead refresh failed:', err.message);
        }

        const result = await query(
            `SELECT *
             FROM psychologist_leads
             WHERE psychologist_id = $1
             ORDER BY created_at DESC`,
            [req.user.id]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Get leads error:', error);
        return res.status(500).json({ error: 'Failed to load leads' });
    }
};

const sendLeadMessage = async (req, res) => {
    try {
        const { leadId } = req.params;
        const { message } = req.body || {};
        const lead = await query(
            `SELECT id
             FROM psychologist_leads
             WHERE id = $1 AND psychologist_id = $2`,
            [leadId, req.user.id]
        );
        if (lead.rows.length === 0) {
            return res.status(404).json({ error: 'Lead not found' });
        }

        const content = (message || '').trim();
        if (!content) {
            return res.status(400).json({ error: 'Message is required' });
        }

        await query(
            `INSERT INTO psychologist_lead_messages
             (lead_id, psychologist_id, message)
             VALUES ($1, $2, $3)`,
            [leadId, req.user.id, content]
        );

        await query(
            `UPDATE psychologist_leads
             SET status = 'contacted', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND psychologist_id = $2`,
            [leadId, req.user.id]
        );

        return res.json({
            success: true,
            leadId,
            message: content,
            status: 'queued'
        });
    } catch (error) {
        console.error('Send lead message error:', error);
        return res.status(500).json({ error: 'Failed to send lead message' });
    }
};

const getFavorites = async (req, res) => {
    try {
        const result = await query(
            `SELECT *
             FROM psychologist_favorites
             WHERE psychologist_id = $1
             ORDER BY created_at DESC`,
            [req.user.id]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Get favorites error:', error);
        return res.status(500).json({ error: 'Failed to load favorites' });
    }
};

const addFavorite = async (req, res) => {
    try {
        const { displayName, notes, employeeId } = req.body || {};
        let finalName = displayName;
        let employeeIdValue = employeeId || null;

        if (employeeIdValue) {
            const employee = await query(
                'SELECT id, display_name FROM users WHERE id = $1 AND role = $2',
                [employeeIdValue, 'employee']
            );
            if (employee.rows.length === 0) {
                return res.status(404).json({ error: 'Employee not found' });
            }
            finalName = employee.rows[0].display_name;
        }

        if (!finalName) {
            return res.status(400).json({ error: 'displayName is required' });
        }

        const result = await query(
            `INSERT INTO psychologist_favorites
             (psychologist_id, employee_id, display_name, notes)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (psychologist_id, employee_id)
             DO UPDATE SET notes = EXCLUDED.notes, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [req.user.id, employeeIdValue, finalName, notes || '']
        );
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Add favorite error:', error);
        return res.status(500).json({ error: 'Failed to add favorite' });
    }
};

const removeFavorite = async (req, res) => {
    try {
        const { favoriteId } = req.params;
        await query(
            `DELETE FROM psychologist_favorites
             WHERE id = $1 AND psychologist_id = $2`,
            [favoriteId, req.user.id]
        );
        return res.json({ success: true });
    } catch (error) {
        console.error('Remove favorite error:', error);
        return res.status(500).json({ error: 'Failed to remove favorite' });
    }
};

const searchEmployees = async (req, res) => {
    try {
        const queryText = String(req.query.q || '').trim();
        if (!queryText) {
            return res.json([]);
        }

        const result = await query(
            `SELECT
                u.id,
                u.display_name,
                u.occupation,
                json_build_object(
                    'id', c.id,
                    'name', c.name
                ) as workplace
             FROM users u
             LEFT JOIN companies c ON u.workplace_id = c.id
             WHERE u.role = 'employee'
               AND u.display_name ILIKE $1
             ORDER BY u.display_name
             LIMIT 8`,
            [`%${queryText}%`]
        );

        return res.json(result.rows);
    } catch (error) {
        console.error('Employee search error:', error);
        return res.status(500).json({ error: 'Failed to search employees' });
    }
};

module.exports = {
    getDashboardPermissions,
    getSchedule,
    addScheduleItem,
    getLeads,
    sendLeadMessage,
    getFavorites,
    addFavorite,
    removeFavorite,
    searchEmployees
};
