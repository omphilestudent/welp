const { query } = require('./database');

const ensureAdminNotificationsTable = async () => {
    await query(`
        CREATE TABLE IF NOT EXISTS admin_notifications (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            type VARCHAR(100) NOT NULL,
            message TEXT NOT NULL,
            entity_type VARCHAR(100),
            entity_id UUID,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            read_at TIMESTAMP
        )
    `);
};

const createAdminNotification = async ({ type, message, entityType, entityId }) => {
    try {
        await ensureAdminNotificationsTable();
        await query(
            `INSERT INTO admin_notifications (type, message, entity_type, entity_id)
             VALUES ($1, $2, $3, $4)`,
            [type, message, entityType || null, entityId || null]
        );
    } catch (error) {
        console.error('Failed to create admin notification:', error.message);
    }
};

const getAdminNotifications = async (limit = 30) => {
    await ensureAdminNotificationsTable();
    const result = await query(
        `SELECT * FROM admin_notifications
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
    );
    return result.rows;
};

const markAdminNotificationRead = async (id) => {
    await ensureAdminNotificationsTable();
    const result = await query(
        `UPDATE admin_notifications
         SET read_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [id]
    );
    return result.rows[0];
};

module.exports = {
    createAdminNotification,
    getAdminNotifications,
    markAdminNotificationRead
};
