const { query } = require('../utils/database');

const listNotifications = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
        const result = await query(
            `SELECT *
             FROM user_notifications
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [req.user.id, limit]
        );
        res.json({ notifications: result.rows });
    } catch (error) {
        console.error('List notifications error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const result = await query(
            `SELECT COUNT(*)::int as count
             FROM user_notifications
             WHERE user_id = $1 AND is_read = false`,
            [req.user.id]
        );
        res.json({ count: result.rows[0]?.count || 0 });
    } catch (error) {
        console.error('Unread count error:', error);
        res.status(500).json({ error: 'Failed to fetch unread count' });
    }
};

const markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(
            `UPDATE user_notifications
             SET is_read = true, read_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND user_id = $2
             RETURNING *`,
            [id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        res.json({ notification: result.rows[0] });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ error: 'Failed to update notification' });
    }
};

const markAllRead = async (req, res) => {
    try {
        await query(
            `UPDATE user_notifications
             SET is_read = true, read_at = CURRENT_TIMESTAMP
            WHERE user_id = $1 AND is_read = false`,
            [req.user.id]
        );
        res.json({ message: 'Notifications marked as read' });
    } catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({ error: 'Failed to update notifications' });
    }
};

const updatePermission = async (req, res) => {
    try {
        const rawState = typeof req.body?.state === 'string' ? req.body.state.toLowerCase() : 'default';
        const allowedStates = new Set(['granted', 'denied', 'default']);
        const state = allowedStates.has(rawState) ? rawState : 'default';

        await query(
            `INSERT INTO user_settings (user_id, system_notification_state)
             VALUES ($1, $2)
             ON CONFLICT (user_id) DO UPDATE
             SET system_notification_state = EXCLUDED.system_notification_state,
                 updated_at = CURRENT_TIMESTAMP`,
            [req.user.id, state]
        );

        res.json({ success: true, state });
    } catch (error) {
        console.error('Update notification permission error:', error);
        res.status(500).json({ error: 'Failed to update notification permission' });
    }
};

module.exports = {
    listNotifications,
    getUnreadCount,
    markNotificationRead,
    markAllRead,
    updatePermission
};
