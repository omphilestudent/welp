const { query } = require('./database');

const shouldNotifyUser = async (userId) => {
    try {
        const result = await query(
            `SELECT message_notifications
             FROM user_settings
             WHERE user_id = $1`,
            [userId]
        );
        if (result.rows.length === 0) {
            return true;
        }
        return result.rows[0].message_notifications !== false;
    } catch (error) {
        return true;
    }
};

const createUserNotification = async ({ userId, type, message, entityType, entityId }) => {
    if (!userId) return null;
    const allow = await shouldNotifyUser(userId);
    if (!allow) return null;

    const result = await query(
        `INSERT INTO user_notifications (user_id, type, message, entity_type, entity_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, type, message, entityType || null, entityId || null]
    );
    return result.rows[0] || null;
};

module.exports = { createUserNotification };
