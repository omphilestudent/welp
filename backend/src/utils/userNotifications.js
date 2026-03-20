const { query } = require('./database');

const DEFAULT_SETTINGS = {
    email_notifications: true,
    message_notifications: true,
    review_notifications: true,
    marketing_notifications: true,
    product_updates: true,
    security_alerts: true,
    login_alerts: true,
    system_notification_state: 'default'
};

const TYPE_TO_SETTING = {
    message: 'message_notifications',
    message_request: 'message_notifications',
    conversation_extended: 'message_notifications',
    call_incoming: 'message_notifications',
    call_missed: 'message_notifications',
    call_ended: 'message_notifications',
    review: 'review_notifications',
    review_reply: 'review_notifications',
    review_notification: 'review_notifications',
    marketing: 'marketing_notifications',
    product_update: 'product_updates',
    security_alert: 'security_alerts',
    login_alert: 'login_alerts'
};

const resolvePreferenceKey = (type) => {
    const normalized = String(type || '').toLowerCase();
    if (TYPE_TO_SETTING[normalized]) {
        return TYPE_TO_SETTING[normalized];
    }
    if (normalized.includes('review')) return 'review_notifications';
    if (normalized.includes('security')) return 'security_alerts';
    if (normalized.includes('login')) return 'login_alerts';
    if (normalized.includes('marketing')) return 'marketing_notifications';
    if (normalized.includes('product')) return 'product_updates';
    if (normalized.includes('message') || normalized.includes('chat') || normalized.includes('call')) {
        return 'message_notifications';
    }
    return 'message_notifications';
};

const getUserNotificationSettings = async (userId) => {
    if (!userId) return { ...DEFAULT_SETTINGS };
    try {
        const result = await query(
            `SELECT email_notifications,
                    message_notifications,
                    review_notifications,
                    marketing_notifications,
                    product_updates,
                    security_alerts,
                    login_alerts,
                    system_notification_state
             FROM user_settings
             WHERE user_id = $1`,
            [userId]
        );
        if (result.rows.length === 0) {
            return { ...DEFAULT_SETTINGS };
        }
        return { ...DEFAULT_SETTINGS, ...result.rows[0] };
    } catch (error) {
        return { ...DEFAULT_SETTINGS };
    }
};

const canSendNotification = async (userId, type, channel = 'in_app') => {
    const settings = await getUserNotificationSettings(userId);
    const preferenceKey = resolvePreferenceKey(type);
    const baseAllowed = settings[preferenceKey] !== false;
    if (!baseAllowed) return false;
    if (channel === 'email') {
        return settings.email_notifications !== false;
    }
    return true;
};

const createUserNotification = async ({ userId, type, message, entityType, entityId, metadata }) => {
    if (!userId) return null;
    const allow = await canSendNotification(userId, type, 'in_app');
    if (!allow) return null;
    const payload = metadata && typeof metadata === 'object' ? metadata : {};

    const result = await query(
        `INSERT INTO user_notifications (user_id, type, message, entity_type, entity_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING *`,
        [userId, type, message, entityType || null, entityId || null, JSON.stringify(payload)]
    );
    return result.rows[0] || null;
};

module.exports = { createUserNotification, getUserNotificationSettings, canSendNotification };
