const crypto = require('crypto');
const { query } = require('../utils/database');
const { sendEmail } = require('../utils/emailService');
const { createUserNotification } = require('../utils/userNotifications');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

const normalizeInvitees = (invitees = []) => {
    const raw = Array.isArray(invitees) ? invitees : String(invitees || '').split(',');
    return raw
        .map((entry) => String(entry || '').trim().toLowerCase())
        .filter((email) => EMAIL_REGEX.test(email));
};

const ensureConversation = async ({ psychologistId, employeeId }) => {
    if (!psychologistId || !employeeId) return null;
    const existing = await query(
        `SELECT id FROM conversations WHERE psychologist_id = $1 AND employee_id = $2 LIMIT 1`,
        [psychologistId, employeeId]
    );
    if (existing.rows.length) return existing.rows[0].id;
    const inserted = await query(
        `INSERT INTO conversations (employee_id, psychologist_id, status, created_at)
         VALUES ($1, $2, 'accepted', CURRENT_TIMESTAMP)
         RETURNING id`,
        [employeeId, psychologistId]
    );
    return inserted.rows[0]?.id || null;
};

const hasEventConflict = async ({ psychologistId, startsAt, endsAt }) => {
    const result = await query(
        `SELECT 1
         FROM psychologist_events
         WHERE psychologist_id = $1
           AND status IN ('scheduled','ready')
           AND starts_at < $2
           AND ends_at > $3
         LIMIT 1`,
        [psychologistId, endsAt, startsAt]
    );
    return result.rows.length > 0;
};

const createEvent = async ({
    psychologistId,
    createdBy,
    title,
    description,
    location,
    startsAt,
    endsAt,
    timezone,
    eventType,
    isVideoCall,
    invitees
}) => {
    if (!psychologistId || !createdBy || !title || !startsAt || !endsAt) {
        const error = new Error('Missing required event data');
        error.statusCode = 400;
        throw error;
    }
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
        const error = new Error('Invalid start/end time');
        error.statusCode = 400;
        throw error;
    }

    const conflict = await hasEventConflict({
        psychologistId,
        startsAt: start.toISOString(),
        endsAt: end.toISOString()
    });
    if (conflict) {
        const error = new Error('This time slot is already booked');
        error.statusCode = 409;
        throw error;
    }

    const inviteeList = normalizeInvitees(invitees);
    const inviteeUsers = inviteeList.length
        ? await query(`SELECT id, email, role FROM users WHERE LOWER(email) = ANY($1::text[])`, [inviteeList])
        : { rows: [] };

    const employeeInvitee = inviteeUsers.rows.find((row) => row.role === 'employee') || inviteeUsers.rows[0];
    const conversationId = isVideoCall && employeeInvitee
        ? await ensureConversation({ psychologistId, employeeId: employeeInvitee.id })
        : null;

    const eventResult = await query(
        `INSERT INTO psychologist_events
         (psychologist_id, created_by, title, description, location, starts_at, ends_at, timezone, event_type, is_video_call, conversation_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
            psychologistId,
            createdBy,
            title,
            description || null,
            location || null,
            start.toISOString(),
            end.toISOString(),
            timezone || 'Africa/Johannesburg',
            eventType || 'meeting',
            Boolean(isVideoCall),
            conversationId
        ]
    );

    const event = eventResult.rows[0];
    const inviteRows = [];
    for (const email of inviteeList) {
        const user = inviteeUsers.rows.find((row) => row.email.toLowerCase() === email);
        const token = crypto.randomBytes(24).toString('hex');
        const row = await query(
            `INSERT INTO psychologist_event_invitees
             (event_id, email, user_id, invite_status, invite_token)
             VALUES ($1,$2,$3,$4,$5)
             RETURNING *`,
            [event.id, email, user?.id || null, 'pending', token]
        );
        inviteRows.push(row.rows[0]);
    }

    return { event, invitees: inviteRows };
};

const listEventsForPsychologist = async (psychologistId) => {
    const result = await query(
        `SELECT *
         FROM psychologist_events
         WHERE psychologist_id = $1
         ORDER BY starts_at ASC`,
        [psychologistId]
    );
    return result.rows;
};

const getInviteByToken = async (token) => {
    const result = await query(
        `SELECT i.*, e.title, e.description, e.starts_at, e.ends_at, e.is_video_call, e.event_type, e.psychologist_id, e.conversation_id
         FROM psychologist_event_invitees i
         JOIN psychologist_events e ON e.id = i.event_id
         WHERE i.invite_token = $1`,
        [token]
    );
    return result.rows[0] || null;
};

const acceptInvite = async ({ token, userId }) => {
    const invite = await getInviteByToken(token);
    if (!invite) {
        const error = new Error('Invite not found');
        error.statusCode = 404;
        throw error;
    }
    await query(
        `UPDATE psychologist_event_invitees
         SET invite_status = 'accepted', user_id = COALESCE($1, user_id), updated_at = CURRENT_TIMESTAMP
         WHERE invite_token = $2`,
        [userId || null, token]
    );
    return invite;
};

const sendEventInvites = async ({ event, invitees, host }) => {
    const baseUrl = process.env.FRONTEND_URL || process.env.SITE_URL || 'https://welphub.onrender.com';
    const hostName = host?.display_name || host?.email || 'Your psychologist';
    for (const invite of invitees) {
        const inviteUrl = `${baseUrl}/invite/${invite.invite_token}`;
        const html = `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
                <h2>${hostName} invited you to a session</h2>
                <p><strong>${event.title}</strong></p>
                <p>${event.description || ''}</p>
                <p><strong>When:</strong> ${new Date(event.starts_at).toLocaleString()}</p>
                <p><strong>Type:</strong> ${event.event_type || 'meeting'}</p>
                <p><a href="${inviteUrl}" target="_blank" rel="noreferrer">View invite & join</a></p>
                <p>If you don't have an account yet, you will be guided to create one before joining.</p>
            </div>
        `;
        try {
            await sendEmail({
                to: invite.email,
                subject: `You have a new session invite from ${hostName}`,
                html
            });
            await query(
                `UPDATE psychologist_event_invitees
                 SET invite_status = 'sent', updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [invite.id]
            );
        } catch (error) {
            console.warn('Failed to send invite email:', error.message);
        }
    }
};

const startEventScheduler = ({ io }) => {
    const intervalMs = Number(process.env.EVENT_SCHEDULER_INTERVAL_MS || 60000);
    setInterval(async () => {
        try {
            const result = await query(
                `SELECT e.id, e.psychologist_id, e.title, e.starts_at, e.ends_at, e.conversation_id
                 FROM psychologist_events e
                 WHERE e.is_video_call = true
                   AND e.status = 'scheduled'
                   AND e.starts_at <= NOW() + INTERVAL '1 minute'`
            );
            for (const event of result.rows) {
                await query(
                    `UPDATE psychologist_events
                     SET status = 'ready', updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1`,
                    [event.id]
                );

                const invitees = await query(
                    `SELECT user_id
                     FROM psychologist_event_invitees
                     WHERE event_id = $1
                       AND user_id IS NOT NULL`,
                    [event.id]
                );

                const notifyUsers = [event.psychologist_id, ...invitees.rows.map((row) => row.user_id)];
                for (const userId of notifyUsers) {
                    const notification = await createUserNotification({
                        userId,
                        type: 'event_ready',
                        message: `Your scheduled session "${event.title}" is ready to start.`,
                        entityType: 'psychologist_event',
                        entityId: event.id,
                        metadata: {
                            conversationId: event.conversation_id,
                            url: event.conversation_id ? `/messages?conversation=${event.conversation_id}&autostart=1` : `/invite/${event.id}`
                        }
                    });
                    if (notification && io) {
                        io.to(`user-${userId}`).emit('notification', notification);
                    }
                }
            }
        } catch (error) {
            console.warn('Event scheduler error:', error.message);
        }
    }, intervalMs);
};

module.exports = {
    normalizeInvitees,
    createEvent,
    listEventsForPsychologist,
    getInviteByToken,
    acceptInvite,
    sendEventInvites,
    startEventScheduler
};
