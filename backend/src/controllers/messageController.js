
const { query } = require('../utils/database');
const { createUserNotification } = require('../utils/userNotifications');

const getActiveSubscription = async (userId) => {
    const result = await query(
        `SELECT plan_type, chat_hours_per_day
         FROM subscriptions
         WHERE user_id = $1 AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
    );
    return result.rows[0] || null;
};

const determineTimeLimitMinutes = (subscription) => {
    if (!subscription) return 120;
    if (subscription.plan_type === 'premium') {
        const premiumHours = Number(subscription.chat_hours_per_day) || 4;
        return Math.max(120, premiumHours * 60);
    }
    const freeHours = Number(subscription.chat_hours_per_day) || 2;
    return Math.min(120, freeHours * 60);
};

const expireConversations = async () => {
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
};

const expireConversationById = async (conversationId) => {
    await query(
        `UPDATE conversations
         SET status = 'ended', ended_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [conversationId]
    );
};

const requestChatWithPsychologist = async (req, res) => {
    try {
        const { psychologistId, initialMessage } = req.body;


        const psychologist = await query(
            'SELECT id, role, is_verified FROM users WHERE id = $1 AND role = $2',
            [psychologistId, 'psychologist']
        );

        if (psychologist.rows.length === 0) {
            return res.status(404).json({ error: 'Psychologist not found' });
        }

        if (!psychologist.rows[0].is_verified) {
            return res.status(400).json({ error: 'Psychologist is not yet verified' });
        }


        const existing = await query(
            'SELECT id FROM conversations WHERE employee_id = $1 AND psychologist_id = $2',
            [req.user.id, psychologistId]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Chat request already sent' });
        }


        const conversation = await query(
            `INSERT INTO conversations (employee_id, psychologist_id, status)
             VALUES ($1, $2, $3)
                 RETURNING *`,
            [req.user.id, psychologistId, 'pending']
        );


        await query(
            `INSERT INTO messages (conversation_id, sender_id, content)
             VALUES ($1, $2, $3)`,
            [conversation.rows[0].id, req.user.id, initialMessage || 'Hello, I would like to chat with you.']
        );

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
            entityId: conversation.rows[0].id
        });
        const io = req.app?.get('io');
        if (io && notification) {
            io.to(`user-${psychologistId}`).emit('notification', notification);
        }

        res.status(201).json({
            message: 'Chat request sent successfully',
            conversation: conversation.rows[0]
        });
    } catch (error) {
        console.error('Request chat error:', error);
        res.status(500).json({ error: 'Failed to send chat request' });
    }
};


const getAvailablePsychologists = async (req, res) => {
    try {
        const result = await query(
            `SELECT
                 id,
                 display_name,
                 avatar_url,
                 is_verified,
                 specialization,
                 years_of_experience,
                 consultation_modes,
                 languages,
                 biography
             FROM users
             WHERE role = 'psychologist' AND is_verified = true
             ORDER BY display_name`
        );

        res.json(result.rows);
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
            'SELECT id FROM conversations WHERE employee_id = $1 AND psychologist_id = $2',
            [employeeId, req.user.id]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Conversation already exists' });
        }


        const conversation = await query(
            `INSERT INTO conversations (employee_id, psychologist_id, status)
             VALUES ($1, $2, $3)
                 RETURNING *`,
            [employeeId, req.user.id, 'pending']
        );


        await query(
            `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1, $2, $3)`,
            [conversation.rows[0].id, req.user.id, initialMessage]
        );

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
            entityId: conversation.rows[0].id
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
            const subscription = await getActiveSubscription(conversation.rows[0].employee_id);
            const timeLimit = determineTimeLimitMinutes(subscription);
            result = await query(
                `UPDATE conversations
       SET status = $1,
           started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
           expires_at = CURRENT_TIMESTAMP + make_interval(mins => $2),
           time_limit_minutes = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
                [status, timeLimit, conversationId]
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

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update conversation status error:', error);
        res.status(500).json({ error: 'Failed to update conversation status' });
    }
};


const getConversations = async (req, res) => {
    try {
        await expireConversations();

        const statusFilter = ['pending', 'accepted', 'rejected', 'blocked', 'ended'];
        let whereClause = '';
        if (req.user.role === 'employee') {
            whereClause = 'c.employee_id = $1 AND c.status = ANY($2::text[])';
        } else if (req.user.role === 'psychologist') {
            whereClause = 'c.psychologist_id = $1 AND c.status = ANY($2::text[])';
        } else {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const params = [req.user.id, statusFilter];

        const result = await query(
            `SELECT
        c.*,
        json_build_object(
          'id', employee.id,
          'display_name', employee.display_name,
          'avatar_url', employee.avatar_url,
          'is_anonymous', employee.is_anonymous
        ) as employee,
        json_build_object(
          'id', psychologist.id,
          'display_name', psychologist.display_name,
          'avatar_url', psychologist.avatar_url,
          'specialization', psychologist.specialization
        ) as psychologist,
        (
          SELECT json_build_object(
            'content', content,
            'createdAt', created_at,
            'senderId', sender_id,
            'isSystemMessage', is_system_message
          )
          FROM messages
          WHERE conversation_id = c.id
          ORDER BY created_at DESC
          LIMIT 1
        ) as last_message,
        (
          SELECT COUNT(*)
          FROM messages
          WHERE conversation_id = c.id
            AND sender_id != $1
            AND is_read = false
        ) as unread_count
       FROM conversations c
       JOIN users employee ON c.employee_id = employee.id
       JOIN users psychologist ON c.psychologist_id = psychologist.id
       WHERE ${whereClause}
       ORDER BY c.updated_at DESC`,
            params
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
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
            entityId: conversationId
        });
        if (io && notification) {
            io.to(`user-${recipientId}`).emit('notification', notification);
        }
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};


const markMessagesAsRead = async (req, res) => {
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

module.exports = {

    requestChatWithPsychologist,
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
    startVideoSession
};
