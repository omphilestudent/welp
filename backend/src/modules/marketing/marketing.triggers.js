const { query } = require('../../utils/database');
const { sendTemplatedEmail } = require('./marketing.mailer');
const { getTemplateByKey, TEMPLATE_KEYS, logDelivery } = require('./marketing.service');

const getTriggerConfig = async (triggerKey) => {
    const result = await query('SELECT * FROM email_trigger_configs WHERE trigger_key = $1', [triggerKey]);
    return result.rows[0] || null;
};

const getBusinessEmailPreference = async (businessId) => {
    const result = await query(
        `SELECT * FROM business_email_preferences WHERE business_id = $1`,
        [businessId]
    );
    return result.rows[0] || null;
};

const getMarketingSettings = async () => {
    const result = await query(`SELECT value FROM system_settings WHERE key = 'marketing_settings'`);
    return result.rows[0]?.value || {};
};

const hasDeliveryForMessage = async (triggerKey, messageId) => {
    const result = await query(
        `SELECT 1 FROM email_delivery_logs WHERE trigger_key = $1 AND metadata->>'message_id' = $2 LIMIT 1`,
        [triggerKey, String(messageId)]
    );
    return result.rows.length > 0;
};

const hasDeliveryForReview = async (triggerKey, reviewId) => {
    const result = await query(
        `SELECT 1 FROM email_delivery_logs WHERE trigger_key = $1 AND metadata->>'review_id' = $2 LIMIT 1`,
        [triggerKey, String(reviewId)]
    );
    return result.rows.length > 0;
};

const pickBusinessEmail = async (businessId) => {
    const result = await query(
        `SELECT * FROM scraped_business_emails
         WHERE (business_id = $1 OR $1 IS NULL)
           AND is_active = true
         ORDER BY
           CASE email_type
             WHEN 'complaints' THEN 1
             WHEN 'support' THEN 2
             WHEN 'contact' THEN 3
             WHEN 'general' THEN 4
             ELSE 5
           END,
           confidence_score DESC NULLS LAST
         LIMIT 1`,
        [businessId]
    );
    return result.rows[0] || null;
};

const handleBusinessReviewOutreach = async ({ reviewId }) => {
    const trigger = await getTriggerConfig('business_unregistered_review_email');
    if (!trigger || trigger.is_enabled === false) return { skipped: true };
    if (await hasDeliveryForReview('business_unregistered_review_email', reviewId)) return { skipped: true };

    const reviewResult = await query(
        `SELECT r.*, c.name as company_name, c.is_claimed, c.claimed_by
         FROM reviews r
         LEFT JOIN companies c ON c.id = r.company_id
         WHERE r.id = $1`,
        [reviewId]
    );
    const review = reviewResult.rows[0];
    if (!review) return { skipped: true };

    const registered = Boolean(review.is_claimed || review.claimed_by);
    const preference = await getBusinessEmailPreference(review.company_id);
    const settings = await getMarketingSettings();
    const stopAfterRegistration = settings.review_email_stop_after_registration !== false;
    if (registered && (preference?.stop_after_registration !== false) && stopAfterRegistration) return { skipped: true };
    if (preference && preference.allow_unregistered_review_emails === false) return { skipped: true };

    const emailRecord = await pickBusinessEmail(review.company_id);
    if (!emailRecord?.email) return { skipped: true };

    const template = await getTemplateByKey(TEMPLATE_KEYS.businessReviewTrigger);
    if (!template || template.is_active === false) return { skipped: true };

    const baseUrl = process.env.FRONTEND_URL || process.env.SITE_URL || 'https://welphub.onrender.com';
    const registerLink = `${baseUrl.replace(/\/$/, '')}/register/business`;

    try {
        const { subject } = await sendTemplatedEmail({
            template,
            to: emailRecord.email,
            variables: {
                company_name: review.company_name || 'your business',
                review_count: '',
                register_link: registerLink,
                sender_name: 'Welp Team'
            },
            metadata: { trigger: 'business_unregistered_review_email', review_id: reviewId }
        });

        await logDelivery({
            templateId: template.id,
            triggerKey: trigger.trigger_key,
            recipientEmail: emailRecord.email,
            recipientType: 'business',
            subject,
            status: 'sent',
            metadata: { review_id: reviewId, email_type: emailRecord.email_type }
        });
        return { sent: true };
    } catch (error) {
        await logDelivery({
            templateId: template.id,
            triggerKey: trigger.trigger_key,
            recipientEmail: emailRecord.email,
            recipientType: 'business',
            subject: template.subject,
            status: 'failed',
            errorMessage: error.message,
            metadata: { review_id: reviewId }
        });
        return { sent: false };
    }
};

const handleChatReplyNotification = async ({ messageId, conversationId, senderId }) => {
    const trigger = await getTriggerConfig('chat_reply_notification_email');
    if (!trigger || trigger.is_enabled === false) return { skipped: true };
    if (await hasDeliveryForMessage('chat_reply_notification_email', messageId)) return { skipped: true };

    const convoResult = await query(
        `SELECT c.*, u1.email as employee_email, u1.display_name as employee_name,
                u2.email as psych_email, u2.display_name as psych_name
         FROM conversations c
         JOIN users u1 ON u1.id = c.employee_id
         JOIN users u2 ON u2.id = c.psychologist_id
         WHERE c.id = $1`,
        [conversationId]
    );
    const convo = convoResult.rows[0];
    if (!convo) return { skipped: true };

    const recipient =
        senderId === convo.employee_id
            ? { id: convo.psychologist_id, email: convo.psych_email, name: convo.psych_name, role: 'psychologist' }
            : { id: convo.employee_id, email: convo.employee_email, name: convo.employee_name, role: 'employee' };

    if (!recipient.email) return { skipped: true };

    const templateKey = recipient.role === 'psychologist'
        ? TEMPLATE_KEYS.chatPsychTrigger
        : TEMPLATE_KEYS.chatUserTrigger;
    const template = await getTemplateByKey(templateKey);
    if (!template || template.is_active === false) return { skipped: true };

    const baseUrl = process.env.FRONTEND_URL || process.env.SITE_URL || 'https://welphub.onrender.com';
    const chatLink = `${baseUrl.replace(/\/$/, '')}/messages?conversation=${conversationId}`;

    try {
        const { subject } = await sendTemplatedEmail({
            template,
            to: recipient.email,
            variables: {
                first_name: recipient.name?.split(' ')[0] || recipient.name || '',
                full_name: recipient.name || recipient.email,
                chat_link: chatLink,
                sender_name: 'Welp Team'
            },
            metadata: { trigger: 'chat_reply_notification_email', message_id: String(messageId) }
        });

        await logDelivery({
            templateId: template.id,
            triggerKey: trigger.trigger_key,
            recipientEmail: recipient.email,
            recipientUserId: recipient.id,
            recipientType: recipient.role,
            subject,
            status: 'sent',
            metadata: { message_id: String(messageId), conversation_id: String(conversationId) }
        });
        return { sent: true };
    } catch (error) {
        await logDelivery({
            templateId: template.id,
            triggerKey: trigger.trigger_key,
            recipientEmail: recipient.email,
            recipientUserId: recipient.id,
            recipientType: recipient.role,
            subject: template.subject,
            status: 'failed',
            errorMessage: error.message,
            metadata: { message_id: String(messageId) }
        });
        return { sent: false };
    }
};

module.exports = {
    handleBusinessReviewOutreach,
    handleChatReplyNotification
};
