// backend/src/controllers/messageController.js
const { query } = require('../utils/database');

// Request chat with psychologist (for employees)
const requestChatWithPsychologist = async (req, res) => {
    try {
        const { psychologistId, initialMessage } = req.body;

        // Check if psychologist exists and is verified
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

        // Check if conversation already exists
        const existing = await query(
            'SELECT id FROM conversations WHERE employee_id = $1 AND psychologist_id = $2',
            [req.user.id, psychologistId]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Chat request already sent' });
        }

        // Create conversation
        const conversation = await query(
            `INSERT INTO conversations (employee_id, psychologist_id, status)
             VALUES ($1, $2, $3)
                 RETURNING *`,
            [req.user.id, psychologistId, 'pending']
        );

        // Add initial message
        await query(
            `INSERT INTO messages (conversation_id, sender_id, content)
             VALUES ($1, $2, $3)`,
            [conversation.rows[0].id, req.user.id, initialMessage || 'Hello, I would like to chat with you.']
        );

        res.status(201).json({
            message: 'Chat request sent successfully',
            conversation: conversation.rows[0]
        });
    } catch (error) {
        console.error('Request chat error:', error);
        res.status(500).json({ error: 'Failed to send chat request' });
    }
};

// Get available psychologists for chat (for employees)
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

// Send message request (for psychologists to initiate chat with employees)
const sendMessageRequest = async (req, res) => {
    try {
        const { employeeId, initialMessage } = req.body;

        // Check if employee exists
        const employee = await query(
            'SELECT id, role FROM users WHERE id = $1 AND role = $2',
            [employeeId, 'employee']
        );

        if (employee.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        // Check if conversation already exists
        const existing = await query(
            'SELECT id FROM conversations WHERE employee_id = $1 AND psychologist_id = $2',
            [employeeId, req.user.id]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Conversation already exists' });
        }

        // Create conversation
        const conversation = await query(
            `INSERT INTO conversations (employee_id, psychologist_id, status)
             VALUES ($1, $2, $3)
                 RETURNING *`,
            [employeeId, req.user.id, 'pending']
        );

        // Add initial message
        await query(
            `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1, $2, $3)`,
            [conversation.rows[0].id, req.user.id, initialMessage]
        );

        res.status(201).json(conversation.rows[0]);
    } catch (error) {
        console.error('Send message request error:', error);
        res.status(500).json({ error: 'Failed to send message request' });
    }
};

// Get pending requests (for employees to see incoming requests from psychologists)
const getPendingRequests = async (req, res) => {
    try {
        const result = await query(
            `SELECT 
        c.*,
        json_build_object(
          'id', u.id,
          'displayName', u.display_name,
          'avatarUrl', u.avatar_url,
          'specialization', u.specialization,
          'years_of_experience', u.years_of_experience
        ) as psychologist,
        (
          SELECT json_build_object(
            'content', content,
            'createdAt', created_at
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

        res.json(result.rows);
    } catch (error) {
        console.error('Get pending requests error:', error);
        res.status(500).json({ error: 'Failed to fetch pending requests' });
    }
};

// Update conversation status (accept/reject/block)
const updateConversationStatus = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { status } = req.body;

        // Validate status
        const validStatuses = ['accepted', 'rejected', 'blocked', 'ended'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Check if conversation exists and user is authorized
        const conversation = await query(
            'SELECT * FROM conversations WHERE id = $1',
            [conversationId]
        );

        if (conversation.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Check authorization based on role and status change
        if (req.user.role === 'employee' && conversation.rows[0].employee_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        if (req.user.role === 'psychologist' && conversation.rows[0].psychologist_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const result = await query(
            `UPDATE conversations 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
            [status, conversationId]
        );

        // Add system message for status change
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

// Get accepted conversations
const getConversations = async (req, res) => {
    try {
        let whereClause = '';
        let params = [req.user.id, 'accepted'];

        if (req.user.role === 'employee') {
            whereClause = 'c.employee_id = $1 AND c.status = $2';
        } else if (req.user.role === 'psychologist') {
            whereClause = 'c.psychologist_id = $1 AND c.status = $2';
        } else {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const result = await query(
            `SELECT 
        c.*,
        json_build_object(
          'id', employee.id,
          'displayName', employee.display_name,
          'avatarUrl', employee.avatar_url,
          'isAnonymous', employee.is_anonymous
        ) as employee,
        json_build_object(
          'id', psychologist.id,
          'displayName', psychologist.display_name,
          'avatarUrl', psychologist.avatar_url,
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

// Get messages for a conversation
const getConversationMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;

        // Check if user is part of conversation
        const conversation = await query(
            `SELECT * FROM conversations
             WHERE id = $1 AND (employee_id = $2 OR psychologist_id = $2)`,
            [conversationId, req.user.id]
        );

        if (conversation.rows.length === 0) {
            return res.status(403).json({ error: 'Not authorized' });
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

// Send a message
const sendMessage = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { content } = req.body;

        if (!content || content.trim() === '') {
            return res.status(400).json({ error: 'Message content is required' });
        }

        // Check if user is part of conversation and it's accepted
        const conversation = await query(
            `SELECT * FROM conversations 
       WHERE id = $1 AND (employee_id = $2 OR psychologist_id = $2) AND status = 'accepted'`,
            [conversationId, req.user.id]
        );

        if (conversation.rows.length === 0) {
            return res.status(403).json({ error: 'Not authorized or conversation not accepted' });
        }

        const result = await query(
            `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
            [conversationId, req.user.id, content]
        );

        // Update conversation timestamp
        await query(
            'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [conversationId]
        );

        // Get sender info
        const sender = await query(
            'SELECT id, display_name, role FROM users WHERE id = $1',
            [req.user.id]
        );

        res.status(201).json({
            ...result.rows[0],
            sender: sender.rows[0]
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};

// Mark messages as read
const markMessagesAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;

        // Check if user is part of conversation
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

// Get unread message count
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

// Block conversation (employee can block psychologist)
const blockConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;

        // Check if user is employee in this conversation
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

        // Add system message
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

// Delete conversation
const deleteConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;

        // Check if user is part of conversation
        const conversation = await query(
            `SELECT * FROM conversations 
       WHERE id = $1 AND (employee_id = $2 OR psychologist_id = $2)`,
            [conversationId, req.user.id]
        );

        if (conversation.rows.length === 0) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Hard delete (completely remove)
        await query('DELETE FROM conversations WHERE id = $1', [conversationId]);

        res.json({ message: 'Conversation deleted successfully' });
    } catch (error) {
        console.error('Delete conversation error:', error);
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
};

module.exports = {
    // New methods
    requestChatWithPsychologist,
    getAvailablePsychologists,

    // Existing methods
    sendMessageRequest,
    getPendingRequests,
    updateConversationStatus,
    getConversations,
    getConversationMessages,
    sendMessage,
    markMessagesAsRead,
    getUnreadCount,
    blockConversation,
    deleteConversation
};