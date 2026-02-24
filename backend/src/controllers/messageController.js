// backend/src/controllers/messageController.js
const { query } = require('../utils/database');

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

const getPendingRequests = async (req, res) => {
    try {
        const result = await query(
            `SELECT 
        c.*,
        json_build_object(
          'id', u.id,
          'displayName', u.display_name,
          'avatarUrl', u.avatar_url
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

const updateConversationStatus = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { status } = req.body;

        // Check if conversation exists and user is employee
        const conversation = await query(
            'SELECT * FROM conversations WHERE id = $1',
            [conversationId]
        );

        if (conversation.rows.length === 0) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        if (conversation.rows[0].employee_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const result = await query(
            `UPDATE conversations 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
            [status, conversationId]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update conversation status error:', error);
        res.status(500).json({ error: 'Failed to update conversation status' });
    }
};

const getConversations = async (req, res) => {
    try {
        let whereClause = '';
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
          'avatarUrl', psychologist.avatar_url
        ) as psychologist,
        (
          SELECT json_build_object(
            'content', content,
            'createdAt', created_at,
            'senderId', sender_id
          )
          FROM messages
          WHERE conversation_id = c.id
          ORDER BY created_at DESC
          LIMIT 1
        ) as last_message
       FROM conversations c
       JOIN users employee ON c.employee_id = employee.id
       JOIN users psychologist ON c.psychologist_id = psychologist.id
       WHERE ${whereClause}
       ORDER BY c.updated_at DESC`,
            [req.user.id, 'accepted']
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
};

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

const sendMessage = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { content } = req.body;

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

        res.json({ message: 'Conversation blocked successfully' });
    } catch (error) {
        console.error('Block conversation error:', error);
        res.status(500).json({ error: 'Failed to block conversation' });
    }
};

// Delete conversation (soft delete or hard delete?)
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

        // Option 1: Hard delete (completely remove)
        await query('DELETE FROM conversations WHERE id = $1', [conversationId]);

        // Option 2: Soft delete (add deleted flag to schema)
        // await query('UPDATE conversations SET deleted = true WHERE id = $1', [conversationId]);

        res.json({ message: 'Conversation deleted successfully' });
    } catch (error) {
        console.error('Delete conversation error:', error);
        res.status(500).json({ error: 'Failed to delete conversation' });
    }
};

module.exports = {
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