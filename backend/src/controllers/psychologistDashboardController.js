const { query } = require('../utils/database');
const { getRoleFlags } = require('../middleware/roleFlags');
const { analyzeSentiment } = require('../services/mlServices');
const https = require('https');
const http = require('http');

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
             VALUES ($1, $2, $3, $4, $5, $6, 'ml-services', $7)`,
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

const getRecentCalls = async (req, res) => {
    try {
        const result = await query(
            `SELECT
                 cl.id,
                 cl.media_type,
                 cl.started_at,
                 cl.ended_at,
                 cl.duration_seconds,
                 u.display_name as employee_name
             FROM call_logs cl
             LEFT JOIN users u ON cl.employee_id = u.id
             WHERE cl.psychologist_id = $1
             ORDER BY cl.started_at DESC
             LIMIT 10`,
            [req.user.id]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Get recent calls error:', error);
        return res.status(500).json({ error: 'Failed to load recent calls' });
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

const exportScheduleIcs = async (req, res) => {
    try {
        const result = await query(
            `SELECT id, title, scheduled_for, location
             FROM psychologist_schedule_items
             WHERE psychologist_id = $1
             ORDER BY scheduled_for ASC`,
            [req.user.id]
        );

        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Welp//Psychologist Schedule//EN',
            'CALSCALE:GREGORIAN'
        ];

        result.rows.forEach((item) => {
            const start = new Date(item.scheduled_for);
            const end = new Date(start.getTime() + 60 * 60 * 1000);
            const toIcs = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
            lines.push('BEGIN:VEVENT');
            lines.push(`UID:${item.id}@welp`);
            lines.push(`DTSTART:${toIcs(start)}`);
            lines.push(`DTEND:${toIcs(end)}`);
            lines.push(`SUMMARY:${String(item.title || 'Session').replace(/\n/g, ' ')}`);
            if (item.location) {
                lines.push(`LOCATION:${String(item.location).replace(/\n/g, ' ')}`);
            }
            lines.push('END:VEVENT');
        });

        lines.push('END:VCALENDAR');

        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Content-Disposition', 'attachment; filename=\"welp-schedule.ics\"');
        return res.send(lines.join('\r\n'));
    } catch (error) {
        console.error('Export schedule error:', error);
        return res.status(500).json({ error: 'Failed to export schedule' });
    }
};

const parseIcsDate = (value) => {
    if (!value) return null;
    const raw = value.replace('Z', '');
    if (/^\d{8}T\d{6}$/.test(raw)) {
        const year = raw.slice(0, 4);
        const month = raw.slice(4, 6);
        const day = raw.slice(6, 8);
        const hour = raw.slice(9, 11);
        const minute = raw.slice(11, 13);
        const second = raw.slice(13, 15);
        return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
    }
    if (/^\d{8}$/.test(raw)) {
        const year = raw.slice(0, 4);
        const month = raw.slice(4, 6);
        const day = raw.slice(6, 8);
        return new Date(`${year}-${month}-${day}T00:00:00Z`);
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseIcsEvents = (icsText = '') => {
    const normalized = icsText.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');
    const unfolded = [];
    for (const line of lines) {
        if (line.startsWith(' ') || line.startsWith('\t')) {
            unfolded[unfolded.length - 1] += line.trim();
        } else {
            unfolded.push(line.trim());
        }
    }

    const events = [];
    let current = null;
    for (const line of unfolded) {
        if (line === 'BEGIN:VEVENT') {
            current = {};
            continue;
        }
        if (line === 'END:VEVENT') {
            if (current) events.push(current);
            current = null;
            continue;
        }
        if (!current) continue;
        const [rawKey, ...rest] = line.split(':');
        if (!rawKey || rest.length === 0) continue;
        const key = rawKey.split(';')[0].toUpperCase();
        const value = rest.join(':').trim();
        if (key === 'DTSTART') current.starts_at = parseIcsDate(value);
        if (key === 'DTEND') current.ends_at = parseIcsDate(value);
        if (key === 'SUMMARY') current.title = value;
        if (key === 'LOCATION') current.location = value;
        if (key === 'UID') current.source_uid = value;
    }
    return events.filter((evt) => evt.title && evt.starts_at);
};

const fetchIcs = (url) => new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Failed to fetch calendar (${res.statusCode})`));
            return;
        }
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve(data));
    }).on('error', reject);
});

const removeScheduleItem = async (req, res) => {
    try {
        const { itemId } = req.params;
        const result = await query(
            `DELETE FROM psychologist_schedule_items
             WHERE id = $1 AND psychologist_id = $2
             RETURNING id`,
            [itemId, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Schedule item not found' });
        }
        return res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
        console.error('Remove schedule item error:', error);
        return res.status(500).json({ error: 'Failed to remove schedule item' });
    }
};

const updateScheduleItem = async (req, res) => {
    try {
        const { itemId } = req.params;
        const { title, scheduledFor, type, location, status } = req.body || {};
        const result = await query(
            `UPDATE psychologist_schedule_items
             SET title = COALESCE($1, title),
                 scheduled_for = COALESCE($2, scheduled_for),
                 type = COALESCE($3, type),
                 location = COALESCE($4, location),
                 status = COALESCE($5, status),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6 AND psychologist_id = $7
             RETURNING *`,
            [
                title,
                scheduledFor ? new Date(scheduledFor).toISOString() : null,
                type,
                location,
                status,
                itemId,
                req.user.id
            ]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Schedule item not found' });
        }
        return res.json(result.rows[0]);
    } catch (error) {
        console.error('Update schedule item error:', error);
        return res.status(500).json({ error: 'Failed to update schedule item' });
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
               AND status <> 'archived'
             ORDER BY created_at DESC`,
            [req.user.id]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Get leads error:', error);
        return res.status(500).json({ error: 'Failed to load leads' });
    }
};

const getCalendarIntegrations = async (req, res) => {
    try {
        const result = await query(
            `SELECT id, provider, name, ical_url, is_active, created_at, updated_at
             FROM psychologist_calendar_integrations
             WHERE psychologist_id = $1
             ORDER BY created_at DESC`,
            [req.user.id]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Get calendar integrations error:', error);
        return res.status(500).json({ error: 'Failed to load calendar integrations' });
    }
};

const addCalendarIntegration = async (req, res) => {
    try {
        const { provider, name, icalUrl } = req.body || {};
        if (!provider || !icalUrl) {
            return res.status(400).json({ error: 'provider and icalUrl are required' });
        }

        const result = await query(
            `INSERT INTO psychologist_calendar_integrations
             (psychologist_id, provider, name, ical_url)
             VALUES ($1, $2, $3, $4)
             RETURNING id, provider, name, ical_url, is_active, created_at, updated_at`,
            [req.user.id, provider, name || provider, icalUrl]
        );
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Add calendar integration error:', error);
        return res.status(500).json({ error: 'Failed to add calendar integration' });
    }
};

const removeCalendarIntegration = async (req, res) => {
    try {
        const { integrationId } = req.params;
        await query(
            `DELETE FROM psychologist_calendar_integrations
             WHERE id = $1 AND psychologist_id = $2`,
            [integrationId, req.user.id]
        );
        return res.json({ success: true });
    } catch (error) {
        console.error('Remove calendar integration error:', error);
        return res.status(500).json({ error: 'Failed to remove calendar integration' });
    }
};

const syncCalendarIntegration = async (req, res) => {
    try {
        const { integrationId } = req.params;
        const integrationResult = await query(
            `SELECT id, ical_url
             FROM psychologist_calendar_integrations
             WHERE id = $1 AND psychologist_id = $2`,
            [integrationId, req.user.id]
        );
        if (integrationResult.rows.length === 0) {
            return res.status(404).json({ error: 'Integration not found' });
        }

        const icsText = await fetchIcs(integrationResult.rows[0].ical_url);
        const events = parseIcsEvents(icsText);

        await query(
            `DELETE FROM psychologist_external_events
             WHERE integration_id = $1`,
            [integrationId]
        );

        for (const event of events) {
            await query(
                `INSERT INTO psychologist_external_events
                 (integration_id, title, starts_at, ends_at, location, source_uid)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    integrationId,
                    event.title,
                    event.starts_at,
                    event.ends_at || null,
                    event.location || null,
                    event.source_uid || null
                ]
            );
        }

        return res.json({
            success: true,
            integrationId,
            count: events.length,
            events
        });
    } catch (error) {
        console.error('Sync calendar integration error:', error);
        return res.status(500).json({ error: 'Failed to sync calendar integration' });
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

const archiveLead = async (req, res) => {
    try {
        const { leadId } = req.params;
        const result = await query(
            `UPDATE psychologist_leads
             SET status = 'archived', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND psychologist_id = $2
             RETURNING id`,
            [leadId, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lead not found' });
        }
        return res.json({ success: true, id: result.rows[0].id, status: 'archived' });
    } catch (error) {
        console.error('Archive lead error:', error);
        return res.status(500).json({ error: 'Failed to archive lead' });
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
    removeScheduleItem,
    exportScheduleIcs,
    updateScheduleItem,
    getRecentCalls,
    getLeads,
    sendLeadMessage,
    archiveLead,
    getCalendarIntegrations,
    addCalendarIntegration,
    removeCalendarIntegration,
    syncCalendarIntegration,
    getFavorites,
    addFavorite,
    removeFavorite,
    searchEmployees
};
