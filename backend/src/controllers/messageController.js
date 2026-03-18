
const { query } = require('../utils/database');
const { createUserNotification } = require('../utils/userNotifications');
const {
    sendMessageNotificationEmail,
    sendConversationRequestEmail,
    sendConversationAcceptedEmail
} = require('../utils/emailService');
const { ensureChatQuota, getUsageSummary } = require('../services/chatQuotaService');
const { PLAN_LIMITS } = require('../services/subscriptionService');
const { emitFlowEvent } = require('../services/flowEngine');

const tableExists = async (tableName) => {
    try {
        const result = await query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = $1
            )`,
            [tableName]
        );
        return result.rows[0]?.exists === true;
    } catch {
        return false;
    }
};

const columnExists = async (tableName, columnName) => {
    try {
        const result = await query(
            `SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
            )`,
            [tableName, columnName]
        );
        return result.rows[0]?.exists === true;
    } catch {
        return false;
    }
};

const getColumnType = async (tableName, columnName) => {
    try {
        const result = await query(
            `SELECT data_type, udt_name
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = $1
               AND column_name = $2`,
            [tableName, columnName]
        );
        if (!result.rows.length) return null;
        return result.rows[0];
    } catch {
        return null;
    }
};

const getChatMinutesForTier = (tier = 'free') => {
    const normalized = String(tier || 'free').toLowerCase();
    if (normalized === 'premium') {
        return PLAN_LIMITS.user_premium?.chatMinutes ?? 120;
    }
    return PLAN_LIMITS.user_free?.chatMinutes ?? 30;
};

const fetchEmployeeTier = async (userId) => {
    if (!userId) {
        return 'free';
    }
    try {
        const tierResult = await query(
            `SELECT subscription_tier
             FROM users
             WHERE id = $1
             LIMIT 1`,
            [userId]
        );
        return tierResult.rows[0]?.subscription_tier || 'free';
    } catch (tierError) {
        // Handle environments that haven't applied the subscription tier migration yet.
        if (tierError.code === '42703') {
            console.warn('subscription_tier column missing, defaulting chat tier to free');
            return 'free';
        }
        throw tierError;
    }
};

const getPerSessionCapForUser = (user = {}) => {
    return getChatMinutesForTier(user.subscription_tier);
};

const expireConversations = async () => {
    try {
        const hasConversations = await tableExists('conversations');
        if (!hasConversations) {
            return;
        }
        const hasExpiresAt = await columnExists('conversations', 'expires_at');
        if (!hasExpiresAt) {
            return;
        }
        const expired = await query(
            `SELECT id
             FROM conversations
             WHERE status = 'accepted'
               AND expires_at IS NOT NULL
               AND expires_at <= CURRENT_TIMESTAMP`
        );

        if (expired.rows.length === 0) {
            return;
        }

        const ids = expired.rows.map((row) => row.id);

        await query(
            `UPDATE conversations
             SET status = 'ended', ended_at = CURRENT_TIMESTAMP
             WHERE id = ANY($1::uuid[])`,
            [ids]
        );
    } catch (error) {
        console.warn('Expire conversations skipped:', error?.message || error);
    }
};

const expireConversationById = async (conversationId) => {
    await query(
        `UPDATE conversations
         SET status = 'ended', ended_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [conversationId]
    );
};

const shouldSendChatEmail = (senderRole, receiverRole) => {
    const sender = String(senderRole || '').toLowerCase();
    const receiver = String(receiverRole || '').toLowerCase();
    return (sender === 'employee' && receiver === 'psychologist')
        || (sender === 'psychologist' && receiver === 'employee');
};

const EMAIL_THROTTLE_MS = Number(process.env.CHAT_EMAIL_THROTTLE_MS || 2 * 60 * 1000);
const emailThrottle = new Map(); // key -> lastSentMs

const shouldThrottleEmail = ({ conversationId, recipientId, kind }) => {
    const key = `${kind || 'message'}:${conversationId}:${recipientId}`;
    const last = emailThrottle.get(key) || 0;
    const now = Date.now();
    if (now - last < EMAIL_THROTTLE_MS) return true;
    emailThrottle.set(key, now);
    return false;
};

const notifyChatEmail = async ({ senderId, recipientId, conversationId, kind = 'message' }) => {
    if (!senderId || !recipientId || !conversationId) return;
    try {
        if (shouldThrottleEmail({ conversationId, recipientId, kind })) return;
        const userRows = await query(
            `SELECT id, email, display_name, role
             FROM users
             WHERE id = ANY($1::uuid[])`,
            [[senderId, recipientId]]
        );
        const sender = userRows.rows.find((row) => row.id === senderId);
        const recipient = userRows.rows.find((row) => row.id === recipientId);
        if (!sender || !recipient || !recipient.email) return;
        if (!shouldSendChatEmail(sender.role, recipient.role)) return;

        const payload = {
            senderName: sender.display_name || sender.email,
            receiverName: recipient.display_name || recipient.email,
            receiverEmail: recipient.email,
            conversationId
        };

        if (kind === 'request' && typeof sendConversationRequestEmail === 'function') {
            await sendConversationRequestEmail(payload);
        } else if (kind === 'accepted' && typeof sendConversationAcceptedEmail === 'function') {
            await sendConversationAcceptedEmail(payload);
        } else {
            await sendMessageNotificationEmail(payload);
        }
    } catch (error) {
        console.warn('Message notification email failed:', error?.message || error);
    }
};

const requestChatWithPsychologist = async (req, res) => {
    try {
        const { psychologistId, initialMessage } = req.body;
        const requestedMinutesRaw = Number(req.body.sessionMinutes);
        const planCap = getPerSessionCapForUser(req.user);
        const sessionMinutes = Number.isFinite(requestedMinutesRaw)
            ? Math.min(planCap, Math.max(5, requestedMinutesRaw))
            : Math.min(planCap, 10);
        await ensureChatQuota(req.user, sessionMinutes);

        const hasCanUseProfile = await columnExists('users', 'can_use_profile');
        const hasKycStatus = await columnExists('users', 'kyc_status');
        const hasIsActive = await columnExists('users', 'is_active');
        const psychologist = await query(
            `SELECT id,
                    role,
                    is_verified,
                    ${hasCanUseProfile ? 'can_use_profile' : 'NULL as can_use_profile'},
                    ${hasKycStatus ? 'kyc_status' : 'NULL as kyc_status'},
                    ${hasIsActive ? 'is_active' : 'true as is_active'}
             FROM users
             WHERE id = $1 AND role = $2`,
            [psychologistId, 'psychologist']
        );

        if (psychologist.rows.length === 0) {
            return res.status(404).json({ error: 'Psychologist not found' });
        }

        const psychRow = psychologist.rows[0];
        if (psychRow.is_active === false) {
            return res.status(400).json({ error: 'Psychologist is not available right now' });
        }
        const isApproved = psychRow.is_verified
            || psychRow.can_use_profile === true
            || String(psychRow.kyc_status || '').toLowerCase() === 'approved';
        if (!isApproved) {
            return res.status(400).json({ error: 'Psychologist is not yet verified' });
        }


        const existing = await query(
            'SELECT * FROM conversations WHERE employee_id = $1 AND psychologist_id = $2 ORDER BY created_at DESC LIMIT 1',
            [req.user.id, psychologistId]
        );

        if (existing.rows.length > 0) {
            const current = existing.rows[0];
            const terminalStatuses = new Set(['ended', 'rejected', 'blocked']);
            if (!terminalStatuses.has(String(current.status || '').toLowerCase())) {
                return res.status(400).json({ error: 'Chat request already sent' });
            }
            const reopened = await query(
                `UPDATE conversations
                 SET status = 'pending',
                     ended_at = NULL,
                     rejected_reason = NULL,
                     started_at = NULL,
                     expires_at = NULL,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1
                 RETURNING *`,
                [current.id]
            );
            if (initialMessage && initialMessage.trim()) {
                await query(
                    `INSERT INTO messages (conversation_id, sender_id, content)
                     VALUES ($1, $2, $3)`,
                    [current.id, req.user.id, initialMessage.trim()]
                );
            }
            return res.status(201).json({
                message: 'Chat request sent successfully',
                conversation: reopened.rows[0],
                allocation: {
                    minutes: sessionMinutes
                }
            });
        }


        const conversation = await query(
            `INSERT INTO conversations (employee_id, psychologist_id, status, time_limit_minutes)
             VALUES ($1, $2, $3, $4)
                 RETURNING *`,
            [req.user.id, psychologistId, 'pending', sessionMinutes]
        );


        await query(
            `INSERT INTO messages (conversation_id, sender_id, content)
             VALUES ($1, $2, $3)`,
            [conversation.rows[0].id, req.user.id, initialMessage || 'Hello, I would like to chat with you.']
        );
        await notifyChatEmail({
            senderId: req.user.id,
            recipientId: psychologistId,
            conversationId: conversation.rows[0].id,
            kind: 'request'
        });

        const sender = await query(
            'SELECT display_name FROM users WHERE id = $1',
            [req.user.id]
        );
        const senderName = sender.rows[0]?.display_name || 'Someone';
        const notification = await createUserNotification({
            userId: psychologistId,
            type: 'message_request',
            message: `${senderName} sent you a chat request`,
            entityType: 'conversation',
            entityId: conversation.rows[0].id,
            metadata: {
                conversationId: conversation.rows[0].id,
                senderName,
                url: `/messages?conversation=${conversation.rows[0].id}`
            }
        });
        const io = req.app?.get('io');
        if (io && notification) {
            io.to(`user-${psychologistId}`).emit('notification', notification);
        }

        res.status(201).json({
            message: 'Chat request sent successfully',
            conversation: conversation.rows[0],
            allocation: {
                minutes: sessionMinutes
            }
        });
    } catch (error) {
        console.error('Request chat error:', error);
        res.status(500).json({ error: 'Failed to send chat request' });
    }
};

const extendConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const requestedMinutes = Number(req.body.extendMinutes || 10);
        const minutesToExtend = Math.min(60, Math.max(5, requestedMinutes));
        const result = await query(
            `SELECT id, employee_id, psychologist_id, status, expires_at, time_limit_minutes
             FROM conversations
             WHERE id = $1
               AND employee_id = $2`,
            [conversationId, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(410).json({
                error: 'Conversation expired or deleted. Request a new chat to continue, provided you have minutes left.'
            });
        }
        const conversation = result.rows[0];
        const psychologistId = conversation.psychologist_id;
        if (!psychologistId) {
            return res.status(410).json({
                error: 'Psychologist is no longer available. Please request a new chat using your remaining minutes.'
            });
        }
        const psychResult = await query(
            `SELECT id
             FROM users
             WHERE id = $1
               AND role = 'psychologist'`,
            [psychologistId]
        );
        if (psychResult.rows.length === 0) {
            return res.status(410).json({
                error: 'Psychologist is no longer available. Please request a new chat using your remaining minutes.'
            });
        }
        if (!['accepted', 'ended'].includes(String(conversation.status || '').toLowerCase())) {
            return res.status(400).json({ error: 'Conversation is not eligible for extension' });
        }

        await ensureChatQuota(req.user, minutesToExtend);
        const now = new Date();
        const currentExpiresAt = conversation.expires_at ? new Date(conversation.expires_at) : null;
        const baseMs = currentExpiresAt && currentExpiresAt > now ? currentExpiresAt.getTime() : now.getTime();
        const newExpiresAt = new Date(baseMs + minutesToExtend * 60 * 1000);

        await query(
            `UPDATE conversations
             SET time_limit_minutes = COALESCE(time_limit_minutes, 0) + $1,
                 expires_at = $2,
                 status = 'accepted',
                 ended_at = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [minutesToExtend, newExpiresAt, conversationId]
        );
        const sender = await query(
            'SELECT id, display_name FROM users WHERE id = $1',
            [req.user.id]
        );
        const senderName = sender.rows[0]?.display_name || 'Someone';
        const notification = await createUserNotification({
            userId: req.user.id,
            type: 'conversation_extended',
            message: `Your session was extended by ${minutesToExtend} minutes.`,
            entityType: 'conversation',
            entityId: conversationId,
            metadata: { extendedMinutes: minutesToExtend }
        });
        const psychNotification = await createUserNotification({
            userId: psychologistId,
            type: 'conversation_extended',
            message: `${senderName} extended the session by ${minutesToExtend} minutes.`,
            entityType: 'conversation',
            entityId: conversationId,
            metadata: { extendedMinutes: minutesToExtend }
        });
        const io = req.app?.get('io');
        if (io) {
            if (notification) io.to(`user-${req.user.id}`).emit('notification', notification);
            if (psychNotification) io.to(`user-${conversation.psychologist_id}`).emit('notification', psychNotification);
            io.to(`conversation-${conversationId}`).emit('conversation.extended', {
                conversationId,
                expiresAt: newExpiresAt,
                extendedMinutes: minutesToExtend
            });
        }
        res.json({
            success: true,
            extendedMinutes: minutesToExtend,
            expiresAt: newExpiresAt
        });
    } catch (error) {
        console.error('Extend conversation error:', error);
        res.status(500).json({ error: error.message || 'Failed to extend conversation' });
    }
};


const getAvailablePsychologists = async (req, res) => {
    try {
        const limit = Number(process.env.PSYCHOLOGIST_VISIBLE_LIMIT || 6);
        const hasCanUseProfile = await columnExists('users', 'can_use_profile');
        const hasKycStatus = await columnExists('users', 'kyc_status');
        const hasIsActive = await columnExists('users', 'is_active');
        const approvalClauses = [
            'is_verified = true',
            hasCanUseProfile ? 'can_use_profile = true' : null,
            hasKycStatus ? "kyc_status = 'approved'" : null
        ].filter(Boolean);
        const availabilityClauses = [
            "role = 'psychologist'",
            hasIsActive ? 'is_active = true' : null,
            approvalClauses.length ? `(${approvalClauses.join(' OR ')})` : null
        ].filter(Boolean);
        const { rows } = await query(
            `SELECT
                 id,
                 display_name,
                 avatar_url,
                 is_verified,
                 specialization,
                 years_of_experience,
                 consultation_modes,
                 languages,
                 biography,
                 ${hasCanUseProfile ? 'can_use_profile' : 'NULL as can_use_profile'},
                 ${hasKycStatus ? 'kyc_status' : 'NULL as kyc_status'}
             FROM users
             WHERE ${availabilityClauses.join(' AND ')}
             ORDER BY RANDOM()
             LIMIT 25`
        );

        if (rows.length === 0) {
            return res.json([]);
        }

        const psychologistIds = rows.map((row) => row.id);
        const visibilityResult = await query(
            `SELECT psychologist_id, expires_at
             FROM psychologist_profile_views
             WHERE user_id = $1
               AND psychologist_id = ANY($2::uuid[])`,
            [req.user.id, psychologistIds]
        );
        const visibilityMap = new Map(
            visibilityResult.rows.map((row) => [row.psychologist_id, new Date(row.expires_at)])
        );

        const selected = [];
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

        for (const psychologist of rows) {
            if (selected.length >= limit) break;
            const viewExpiry = visibilityMap.get(psychologist.id);
            if (viewExpiry && viewExpiry > now) {
                continue;
            }
            selected.push(psychologist);
            await query(
                `INSERT INTO psychologist_profile_views (user_id, psychologist_id, seen_at, expires_at)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (user_id, psychologist_id)
                 DO UPDATE SET seen_at = EXCLUDED.seen_at, expires_at = EXCLUDED.expires_at`,
                [req.user.id, psychologist.id, now, expiresAt]
            );
        }

        if (selected.length === 0) {
            return res.json(rows.slice(0, Math.min(limit, rows.length)));
        }

        res.json(selected);
    } catch (error) {
        console.error('Get psychologists error:', error);
        res.status(500).json({ error: 'Failed to fetch psychologists' });
    }
};


const sendMessageRequest = async (req, res) => {
    try {
        const { employeeId, initialMessage } = req.body;


        const employee = await query(
            'SELECT id, role FROM users WHERE id = $1 AND role = $2',
            [employeeId, 'employee']
        );

        if (employee.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }


        const existing = await query(
            'SELECT * FROM conversations WHERE employee_id = $1 AND psychologist_id = $2 ORDER BY created_at DESC LIMIT 1',
            [employeeId, req.user.id]
        );

        if (existing.rows.length > 0) {
            const current = existing.rows[0];
            const terminalStatuses = new Set(['ended', 'rejected', 'blocked']);
            if (!terminalStatuses.has(String(current.status || '').toLowerCase())) {
                return res.status(200).json(current);
            }
            const reopened = await query(
                `UPDATE conversations
                 SET status = 'pending',
                     ended_at = NULL,
                     rejected_reason = NULL,
                     started_at = NULL,
                     expires_at = NULL,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1
                 RETURNING *`,
                [current.id]
            );
            if (initialMessage && initialMessage.trim()) {
                await query(
                    `INSERT INTO messages (conversation_id, sender_id, content)
                     VALUES ($1, $2, $3)`,
                    [current.id, req.user.id, initialMessage.trim()]
                );
            }
            await notifyChatEmail({
                senderId: req.user.id,
                recipientId: employeeId,
                conversationId: current.id,
                kind: 'request'
            });
            return res.status(201).json(reopened.rows[0]);
        }


        const conversation = await query(
            `INSERT INTO conversations (employee_id, psychologist_id, status)
             VALUES ($1, $2, $3)
                 RETURNING *`,
            [employeeId, req.user.id, 'pending']
        );


        if (initialMessage && initialMessage.trim()) {
            await query(
                `INSERT INTO messages (conversation_id, sender_id, content)
                 VALUES ($1, $2, $3)`,
                [conversation.rows[0].id, req.user.id, initialMessage.trim()]
            );
        }

        await notifyChatEmail({
            senderId: req.user.id,
            recipientId: employeeId,
            conversationId: conversation.rows[0].id,
            kind: 'request'
        });

        const sender = await query(
            'SELECT display_name FROM users WHERE id = $1',
            [req.user.id]
        );
        const senderName = sender.rows[0]?.display_name || 'Someone';
        const notification = await createUserNotification({
            userId: employeeId,
            type: 'message_request',
            message: `${senderName} sent you a chat request`,
            entityType: 'conversation',
            entityId: conversation.rows[0].id,
            metadata: {
                conversationId: conversation.rows[0].id,
                senderName,
                url: `/messages?conversation=${conversation.rows[0].id}`
            }
        });
        const io = req.app?.get('io');
        if (io && notification) {
            io.to(`user-${employeeId}`).emit('notification', notification);
        }

        res.status(201).json(conversation.rows[0]);
    } catch (error) {
        console.error('Send message request error:', error);
        res.status(500).json({ error: 'Failed to send message request' });
    }
};


const getPendingRequests = async (req, res) => {
    try {
        if (req.user.role === 'employee') {
            const result = await query(
                `SELECT
            c.*,
            json_build_object(
              'id', u.id,
              'display_name', u.display_name,
              'avatar_url', u.avatar_url,
              'specialization', u.specialization,
              'years_of_experience', u.years_of_experience
            ) as psychologist,
            (
              SELECT json_build_object(
                'content', content,
                'createdAt', created_at,
                'senderId', sender_id
              )
              FROM messages
              WHERE conversation_id = c.id
              ORDER BY created_at ASC
              LIMIT 1
            ) as initial_message
           FROM conversations c
           JOIN users u ON c.psychologist_id = u.id
           WHERE c.employee_id = $1 AND c.status = 'pending'
           ORDER BY c.created_at DESC`,
                [req.user.id]
            );

            return res.json(result.rows);
        }

        if (req.user.role === 'psychologist') {
            const result = await query(
                `SELECT
            c.*,
            json_build_object(
              'id', u.id,
              'display_name', u.display_name,
              'avatar_url', u.avatar_url,
              'occupation', u.occupation,
              'is_anonymous', u.is_anonymous,
              'workplace', json_build_object(
                'id', c2.id,
                'name', c2.name,
                'logo_url', c2.logo_url
              )
            ) as employee,
            (
              SELECT json_build_object(
                'content', content,
                'createdAt', created_at,
                'senderId', sender_id
              )
              FROM messages
              WHERE conversation_id = c.id
              ORDER BY created_at ASC
              LIMIT 1
            ) as initial_message
           FROM conversations c
           JOIN users u ON c.employee_id = u.id
           LEFT JOIN companies c2 ON u.workplace_id = c2.id
           WHERE c.psychologist_id = $1 AND c.status = 'pending'
           ORDER BY c.created_at DESC`,
                [req.user.id]
            );

            return res.json(result.rows);
        }

        return res.status(403).json({ error: 'Not authorized' });
    } catch (error) {
        console.error('Get pending requests error:', error);
        res.status(500).json({ error: 'Failed to fetch pending requests' });
    }
};


const updateConversationStatus = async (req, res) => {
    try {
        await expireConversations();
        const { conversationId } = req.params;
        const { status } = req.body;


        const validStatuses = ['accepted', 'rejected', 'blocked', 'ended'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }


        const conversation = await query(
            'SELECT * FROM conversations WHERE id = $1',
            [conversationId]
        );

        if (conversation.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }


        if (req.user.role === 'employee' && conversation.rows[0].employee_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        if (req.user.role === 'psychologist' && conversation.rows[0].psychologist_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        let result;
        if (status === 'accepted') {
            const employeeTier = await fetchEmployeeTier(conversation.rows[0].employee_id);
            const tierLimit = getChatMinutesForTier(employeeTier);
            const storedLimit = Number(conversation.rows[0].time_limit_minutes);
            const hasStoredLimit = Number.isFinite(storedLimit) && storedLimit > 0;
            const appliedLimit = hasStoredLimit ? Math.min(storedLimit, tierLimit) : tierLimit;

            result = await query(
                `UPDATE conversations
       SET status = $1,
           time_limit_minutes = $2,
           started_at = NULL,
           expires_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
                [status, appliedLimit, conversationId]
            );
        } else {
            result = await query(
                `UPDATE conversations
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
                [status, conversationId]
            );
        }


        let systemMessage = '';
        switch(status) {
            case 'accepted':
                systemMessage = 'Chat request accepted. You can now start messaging.';
                break;
            case 'rejected':
                systemMessage = 'Chat request was rejected.';
                break;
            case 'blocked':
                systemMessage = 'Conversation has been blocked.';
                break;
            case 'ended':
                systemMessage = 'Conversation has ended.';
                break;
        }

        if (systemMessage) {
            await query(
                `INSERT INTO messages (conversation_id, sender_id, content, is_system_message)
                 VALUES ($1, $2, $3, true)`,
                [conversationId, req.user.id, systemMessage]
            );
        }

        if (status === 'accepted') {
            const convoRow = conversation.rows[0];
            const otherUserId = req.user.id === convoRow.employee_id ? convoRow.psychologist_id : convoRow.employee_id;
            await notifyChatEmail({
                senderId: req.user.id,
                recipientId: otherUserId,
                conversationId,
                kind: 'accepted'
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update conversation status error:', error);
        res.status(500).json({ error: 'Failed to update conversation status' });
    }
};


const getConversations = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            console.warn('Get conversations blocked: missing user id');
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        console.log('Fetching conversations for user:', userId);

        const hasConversations = await tableExists('conversations');
        if (!hasConversations) {
            console.log(`User ${userId} has 0 conversations (table missing)`);
            return res.status(200).json({ success: true, conversations: [] });
        }
        await expireConversations();

        const [
            hasUserAnonymous,
            hasAvatar,
            hasSpecialization,
            hasMessages,
            hasMessageRead,
            hasSystemMessage,
            hasChatMessages,
            hasChatRead,
            hasChatSystem,
            hasMessageCreatedAt,
            hasChatCreatedAt,
            hasChatDeliveredAt
        ] = await Promise.all([
            columnExists('users', 'is_anonymous'),
            columnExists('users', 'avatar_url'),
            columnExists('users', 'specialization'),
            tableExists('messages'),
            columnExists('messages', 'is_read'),
            columnExists('messages', 'is_system_message'),
            tableExists('chat_messages'),
            columnExists('chat_messages', 'read_at'),
            columnExists('chat_messages', 'is_system_message'),
            columnExists('messages', 'created_at'),
            columnExists('chat_messages', 'created_at'),
            columnExists('chat_messages', 'delivered_at')
        ]);
        const hasUsers = await tableExists('users');
        if (!hasUsers) {
            console.log(`User ${userId} has 0 conversations (users table missing)`);
            return res.status(200).json({ success: true, conversations: [] });
        }

        const [hasStatus, hasUpdatedAt, hasCreatedAt, hasEmployeeId, hasPsychologistId, hasUserId] = await Promise.all([
            columnExists('conversations', 'status'),
            columnExists('conversations', 'updated_at'),
            columnExists('conversations', 'created_at'),
            columnExists('conversations', 'employee_id'),
            columnExists('conversations', 'psychologist_id'),
            columnExists('conversations', 'user_id')
        ]);

        if ((!hasEmployeeId && !hasUserId) || !hasPsychologistId) {
            console.log(`User ${userId} has 0 conversations (missing participant columns)`);
            return res.status(200).json({ success: true, conversations: [] });
        }

        const statusFilter = ['pending', 'accepted', 'rejected', 'blocked', 'ended'];
        const statusFilterClause = hasStatus
            ? 'c.status::text = ANY($2::text[])'
            : '';
        const employeeIdColumn = hasEmployeeId ? 'employee_id' : 'user_id';

        let whereClause = '';
        if (req.user.role === 'employee') {
            whereClause = hasStatus
                ? `c.${employeeIdColumn} = $1 AND ${statusFilterClause}`
                : `c.${employeeIdColumn} = $1`;
        } else if (req.user.role === 'psychologist') {
            whereClause = hasStatus
                ? `c.psychologist_id = $1 AND ${statusFilterClause}`
                : 'c.psychologist_id = $1';
        } else {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const params = hasStatus ? [req.user.id, statusFilter] : [req.user.id];

        const employeeAvatar = hasAvatar ? 'employee.avatar_url' : 'NULL';
        const employeeAnon = hasUserAnonymous ? 'employee.is_anonymous' : 'false';
        const psychologistAvatar = hasAvatar ? 'psychologist.avatar_url' : 'NULL';
        const psychologistSpec = hasSpecialization ? 'psychologist.specialization' : 'NULL';
        const messageTable = hasMessages ? 'messages' : (hasChatMessages ? 'chat_messages' : null);
        const messageReadColumn = hasMessages
            ? (hasMessageRead ? 'is_read' : null)
            : (hasChatMessages && hasChatRead ? 'read_at' : null);
        const messageSystemColumn = hasMessages
            ? (hasSystemMessage ? 'is_system_message' : null)
            : (hasChatMessages && hasChatSystem ? 'is_system_message' : null);
        const messageCreatedColumn = hasMessages
            ? (hasMessageCreatedAt ? 'created_at' : null)
            : (hasChatMessages
                ? (hasChatCreatedAt ? 'created_at' : (hasChatDeliveredAt ? 'delivered_at' : null))
                : null);
        const systemMessageValue = messageTable && messageSystemColumn ? messageSystemColumn : 'false';
        const unreadCountSelect = messageTable && messageReadColumn
            ? `(
          SELECT COUNT(*)
          FROM ${messageTable}
          WHERE conversation_id = c.id
            AND sender_id != $1
            AND ${messageReadColumn === 'is_read' ? 'is_read = false' : 'read_at IS NULL'}
        ) as unread_count`
            : '0 as unread_count';
        const lastMessageSelect = messageTable && messageCreatedColumn
            ? `(
          SELECT json_build_object(
            'content', content,
            'createdAt', ${messageCreatedColumn},
            'senderId', sender_id,
            'isSystemMessage', ${systemMessageValue}
          )
          FROM ${messageTable}
          WHERE conversation_id = c.id
          ORDER BY ${messageCreatedColumn} DESC
          LIMIT 1
        ) as last_message`
            : 'NULL as last_message';

        const orderColumn = hasUpdatedAt ? 'c.updated_at' : (hasCreatedAt ? 'c.created_at' : 'c.id');
        // conversations.psychologist_id is stored as users.id (see requestChatWithPsychologist insert).
        // Some environments also have a psychologists table; if present, it links via psychologists.user_id.
        const hasPsychologistsTable = await tableExists('psychologists');
        const hasPsychUserId = hasPsychologistsTable ? await columnExists('psychologists', 'user_id') : false;
        const psychologistJoin = hasPsychologistsTable && hasPsychUserId
            ? 'JOIN users psychologist ON c.psychologist_id = psychologist.id LEFT JOIN psychologists p ON p.user_id = psychologist.id'
            : 'JOIN users psychologist ON c.psychologist_id = psychologist.id';
        const result = await query(
            `SELECT
        c.*,
        json_build_object(
          'id', employee.id,
          'display_name', employee.display_name,
          'avatar_url', ${employeeAvatar},
          'is_anonymous', ${employeeAnon}
        ) as employee,
        json_build_object(
          'id', psychologist.id,
          'display_name', psychologist.display_name,
          'avatar_url', ${psychologistAvatar},
          'specialization', ${psychologistSpec}
        ) as psychologist,
        ${lastMessageSelect},
        ${unreadCountSelect}
       FROM conversations c
       JOIN users employee ON c.${employeeIdColumn} = employee.id
       ${psychologistJoin}
       WHERE ${whereClause}
       ORDER BY ${orderColumn} DESC`,
            params
        );

        console.log(`User ${userId} has ${result.rows.length} conversations`);
        return res.status(200).json({ success: true, conversations: result.rows });
    } catch (error) {
        console.error('Get conversations error:', error?.stack || error);
        return res.status(500).json({
            success: false,
            error: error?.message || 'Failed to fetch conversations'
        });
    }
};


const getConversationMessages = async (req, res) => {
    try {
        await expireConversations();
        const { conversationId } = req.params;

        const conversation = await query(
            `SELECT * FROM conversations
             WHERE id = $1 AND (employee_id = $2 OR psychologist_id = $2)`,
            [conversationId, req.user.id]
        );

        if (conversation.rows.length === 0) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const allowedStatuses = ['accepted', 'ended', 'pending', 'rejected', 'blocked'];
        if (!allowedStatuses.includes(conversation.rows[0].status)) {
            return res.json([]);
        }

        const result = await query(
            `SELECT
        m.*,
        json_build_object(
          'id', u.id,
          'displayName', u.display_name,
          'role', u.role
        ) as sender
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
            [conversationId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
};


const sendMessage = async (req, res) => {
    try {
        await expireConversations();
        const { conversationId } = req.params;
        const { content } = req.body;

        if (!content || content.trim() === '') {
            return res.status(400).json({ error: 'Message content is required' });
        }


        const conversation = await query(
            `SELECT * FROM conversations
       WHERE id = $1 AND (employee_id = $2 OR psychologist_id = $2) AND status = 'accepted'`,
            [conversationId, req.user.id]
        );

        if (conversation.rows.length === 0) {
            return res.status(403).json({ error: 'Not authorized or conversation not accepted' });
        }

        const convo = conversation.rows[0];
        if (convo.status !== 'accepted') {
            return res.status(403).json({ error: 'Conversation is not active' });
        }

        const now = new Date();
        if (convo.expires_at && new Date(convo.expires_at) <= now) {
            await expireConversationById(convo.id);
            return res.status(403).json({ error: 'Conversation time has expired' });
        }

        if (!convo.started_at) {
            const sessionUpdate = await query(
                `UPDATE conversations
                 SET started_at = CURRENT_TIMESTAMP,
                     expires_at = CASE
                        WHEN time_limit_minutes IS NOT NULL THEN CURRENT_TIMESTAMP + make_interval(mins => time_limit_minutes)
                        ELSE CURRENT_TIMESTAMP + INTERVAL '120 minutes'
                     END
                 WHERE id = $1
                 RETURNING started_at, expires_at`,
                [conversationId]
            );
            if (sessionUpdate.rows.length) {
                convo.started_at = sessionUpdate.rows[0].started_at;
                convo.expires_at = sessionUpdate.rows[0].expires_at;
            }
        }

        const result = await query(
            `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
            [conversationId, req.user.id, content]
        );


        await query(
            'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [conversationId]
        );


        const sender = await query(
            'SELECT id, display_name, role FROM users WHERE id = $1',
            [req.user.id]
        );

        res.status(201).json({
            ...result.rows[0],
            sender: sender.rows[0]
        });

        const io = req.app?.get('io');
        if (io) {
            io.to(`conversation-${conversationId}`).emit('ml-services-message', {
                ...result.rows[0],
                sender: sender.rows[0]
            });
        }

        const recipientId = convo.employee_id === req.user.id ? convo.psychologist_id : convo.employee_id;
        const senderName = sender.rows[0]?.display_name || 'Someone';
        const notification = await createUserNotification({
            userId: recipientId,
            type: 'message',
            message: `${senderName} sent you a message`,
            entityType: 'conversation',
            entityId: conversationId,
            metadata: {
                conversationId,
                senderName,
                preview: (content || '').slice(0, 140),
                url: `/messages?conversation=${conversationId}`
            }
        });
        if (io && notification) {
            io.to(`user-${recipientId}`).emit('notification', notification);
        }

        notifyChatEmail({
            senderId: req.user.id,
            recipientId,
            conversationId,
            kind: 'message'
        }).catch((emailError) => {
            console.warn('Message email notify failed:', emailError?.message || emailError);
        });

        emitFlowEvent('message.created', {
            conversationId,
            messageId: result.rows[0]?.id,
            senderId: req.user.id,
            recipientId,
            preview: (content || '').slice(0, 160)
        }).catch((eventError) => {
            console.warn('Flow event dispatch failed (message.created):', eventError.message);
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};


const markMessagesAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;

        const hasIsRead = await columnExists('messages', 'is_read');
        if (!hasIsRead) {
            return res.json({ message: 'Messages marked as read' });
        }

        const conversation = await query(
            `SELECT * FROM conversations
       WHERE id = $1 AND (employee_id = $2 OR psychologist_id = $2)`,
            [conversationId, req.user.id]
        );

        if (conversation.rows.length === 0) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await query(
            `UPDATE messages
             SET is_read = true
             WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false`,
            [conversationId, req.user.id]
        );

        res.json({ message: 'Messages marked as read' });
    } catch (error) {
        console.error('Mark messages read error:', error);
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
};


const getUnreadCount = async (req, res) => {
    try {
        const hasIsRead = await columnExists('messages', 'is_read');
        if (!hasIsRead) {
            return res.json({ count: 0 });
        }
        let conversationIds;

        if (req.user.role === 'employee') {
            const convResult = await query(
                'SELECT id FROM conversations WHERE employee_id = $1 AND status = $2',
                [req.user.id, 'accepted']
            );
            conversationIds = convResult.rows.map(c => c.id);
        } else if (req.user.role === 'psychologist') {
            const convResult = await query(
                'SELECT id FROM conversations WHERE psychologist_id = $1 AND status = $2',
                [req.user.id, 'accepted']
            );
            conversationIds = convResult.rows.map(c => c.id);
        } else {
            return res.json({ count: 0 });
        }

        if (conversationIds.length === 0) {
            return res.json({ count: 0 });
        }

        const result = await query(
            `SELECT COUNT(*) as count
             FROM messages
             WHERE conversation_id = ANY($1::uuid[])
               AND sender_id != $2
               AND is_read = false`,
            [conversationIds, req.user.id]
        );

        res.json({ count: parseInt(result.rows[0].count) });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Failed to get unread count' });
    }
};


const blockConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;


        const conversation = await query(
            'SELECT * FROM conversations WHERE id = $1 AND employee_id = $2',
            [conversationId, req.user.id]
        );

        if (conversation.rows.length === 0) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await query(
            `UPDATE conversations
       SET status = 'blocked', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
            [conversationId]
        );


        await query(
            `INSERT INTO messages (conversation_id, sender_id, content, is_system_message)
             VALUES ($1, $2, $3, true)`,
            [conversationId, req.user.id, 'Conversation has been blocked.']
        );

        res.json({ message: 'Conversation blocked successfully' });
    } catch (error) {
        console.error('Block conversation error:', error);
        res.status(500).json({ error: 'Failed to block conversation' });
    }
};


const deleteConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;


        const conversation = await query(
            `SELECT * FROM conversations
       WHERE id = $1 AND (employee_id = $2 OR psychologist_id = $2)`,
            [conversationId, req.user.id]
        );

        if (conversation.rows.length === 0) {
            return res.status(403).json({ error: 'Not authorized' });
        }


        await query('DELETE FROM conversations WHERE id = $1', [conversationId]);

        res.json({ message: 'Conversation deleted successfully' });
    } catch (error) {
        console.error('Delete conversation error:', error);
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
};

const startVideoSession = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const conversation = await query(
            `SELECT id FROM conversations
             WHERE id = $1 AND (employee_id = $2 OR psychologist_id = $2)`,
            [conversationId, req.user.id]
        );

        if (conversation.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found or access denied' });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error('Start video session error:', error);
        return res.status(500).json({ error: 'Unable to start video session' });
    }
};

const getChatUsageSummary = async (req, res) => {
    try {
        const summary = await getUsageSummary(req.user);
        res.json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('Get chat usage error:', error);
        res.status(500).json({ success: false, error: 'Failed to load chat usage' });
    }
};

const getPsychologistFavorites = async (req, res) => {
    try {
        const result = await query(
            `SELECT
                f.id,
                f.psychologist_id,
                f.created_at,
                u.display_name,
                u.avatar_url,
                u.specialization,
                u.years_of_experience
             FROM employee_psychologist_favorites f
             JOIN users u ON f.psychologist_id = u.id
             WHERE f.employee_id = $1
             ORDER BY f.created_at DESC`,
            [req.user.id]
        );
        return res.json({ success: true, favorites: result.rows });
    } catch (error) {
        console.error('Get psychologist favorites error:', error);
        return res.status(500).json({ success: false, error: 'Failed to load favorites' });
    }
};

const addPsychologistFavorite = async (req, res) => {
    try {
        const { psychologistId } = req.body;
        if (!psychologistId) {
            return res.status(400).json({ success: false, error: 'psychologistId is required' });
        }
        const psychologist = await query(
            `SELECT id, role, is_verified, can_use_profile, kyc_status, is_active
             FROM users
             WHERE id = $1 AND role = 'psychologist'`,
            [psychologistId]
        );
        if (psychologist.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Psychologist not found' });
        }
        const row = psychologist.rows[0];
        if (row.is_active === false) {
            return res.status(400).json({ success: false, error: 'Psychologist is not available' });
        }
        const approved = row.is_verified || row.can_use_profile === true || String(row.kyc_status || '').toLowerCase() === 'approved';
        if (!approved) {
            return res.status(400).json({ success: false, error: 'Psychologist is not yet verified' });
        }

        const result = await query(
            `INSERT INTO employee_psychologist_favorites (employee_id, psychologist_id)
             VALUES ($1, $2)
             ON CONFLICT (employee_id, psychologist_id)
             DO NOTHING
             RETURNING *`,
            [req.user.id, psychologistId]
        );
        return res.status(201).json({ success: true, favorite: result.rows[0] || null });
    } catch (error) {
        console.error('Add psychologist favorite error:', error);
        return res.status(500).json({ success: false, error: 'Failed to add favorite' });
    }
};

const removePsychologistFavorite = async (req, res) => {
    try {
        const { psychologistId } = req.params;
        await query(
            `DELETE FROM employee_psychologist_favorites
             WHERE employee_id = $1 AND psychologist_id = $2`,
            [req.user.id, psychologistId]
        );
        return res.json({ success: true });
    } catch (error) {
        console.error('Remove psychologist favorite error:', error);
        return res.status(500).json({ success: false, error: 'Failed to remove favorite' });
    }
};

module.exports = {

    requestChatWithPsychologist,
    extendConversation,
    getAvailablePsychologists,


    sendMessageRequest,
    getPendingRequests,
    updateConversationStatus,
    getConversations,
    getConversationMessages,
    sendMessage,
    markMessagesAsRead,
    getUnreadCount,
    blockConversation,
    deleteConversation,
    startVideoSession,
    getChatUsageSummary,
    getPsychologistFavorites,
    addPsychologistFavorite,
    removePsychologistFavorite
};
