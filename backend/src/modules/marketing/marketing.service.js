const database = require('../../utils/database');
const { sendTemplatedEmail } = require('./marketing.mailer');

const TEMPLATE_KEYS = {
    employeeCampaign: 'employee_subscription_campaign',
    psychologistCampaign: 'psychologist_subscription_campaign',
    businessReviewTrigger: 'business_unregistered_review_trigger',
    chatUserTrigger: 'chat_notification_user_recipient',
    chatPsychTrigger: 'chat_notification_psychologist_recipient'
};

const listTemplates = async () => {
    const result = await database.query('SELECT * FROM marketing_email_templates ORDER BY updated_at DESC');
    return result.rows;
};

const getTemplateById = async (id) => {
    const result = await database.query('SELECT * FROM marketing_email_templates WHERE id = $1', [id]);
    return result.rows[0] || null;
};

const getTemplateByKey = async (key) => {
    const result = await database.query('SELECT * FROM marketing_email_templates WHERE key = $1', [key]);
    return result.rows[0] || null;
};

const createTemplate = async ({ key, name, category, audience, subject, preheader, htmlBody, textBody, logoAssetPath, isActive, userId }) => {
    const result = await database.query(
        `INSERT INTO marketing_email_templates (key, name, category, audience, subject, preheader, html_body, text_body, logo_asset_path, is_active, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *`,
        [key, name, category, audience, subject, preheader, htmlBody, textBody, logoAssetPath, isActive !== false, userId, userId]
    );
    return result.rows[0];
};

const updateTemplate = async (id, payload) => {
    const fields = [
        ['name', payload.name],
        ['subject', payload.subject],
        ['preheader', payload.preheader],
        ['html_body', payload.html_body],
        ['text_body', payload.text_body],
        ['logo_asset_path', payload.logo_asset_path],
        ['is_active', payload.is_active]
    ];
    const updates = [];
    const values = [];
    let idx = 1;
    for (const [field, value] of fields) {
        if (value !== undefined) {
            updates.push(`${field} = $${idx++}`);
            values.push(value);
        }
    }
    if (!updates.length) {
        return getTemplateById(id);
    }
    values.push(id);
    const result = await database.query(
        `UPDATE marketing_email_templates SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *`,
        values
    );
    return result.rows[0] || null;
};

const listCampaigns = async () => {
    const result = await database.query(
        `SELECT c.*, t.name as template_name
         FROM marketing_campaigns c
         LEFT JOIN marketing_email_templates t ON t.id = c.template_id
         ORDER BY c.created_at DESC`
    );
    return result.rows;
};

const createCampaign = async (payload, userId) => {
    const result = await database.query(
        `INSERT INTO marketing_campaigns (template_id, name, audience_type, send_type, frequency_type, days_of_week, is_active, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
            payload.template_id,
            payload.name,
            payload.audience_type,
            payload.send_type || 'scheduled',
            payload.frequency_type || 'weekly',
            JSON.stringify(payload.days_of_week || []),
            payload.is_active !== false,
            userId,
            userId
        ]
    );
    return result.rows[0];
};

const updateCampaign = async (id, payload, userId) => {
    const fields = [
        ['template_id', payload.template_id],
        ['name', payload.name],
        ['audience_type', payload.audience_type],
        ['send_type', payload.send_type],
        ['frequency_type', payload.frequency_type],
        ['days_of_week', payload.days_of_week ? JSON.stringify(payload.days_of_week) : undefined],
        ['is_active', payload.is_active]
    ];
    const updates = [];
    const values = [];
    let idx = 1;
    for (const [field, value] of fields) {
        if (value !== undefined) {
            updates.push(`${field} = $${idx++}`);
            values.push(value);
        }
    }
    updates.push(`updated_by = $${idx++}`);
    values.push(userId);
    values.push(id);
    const result = await database.query(
        `UPDATE marketing_campaigns SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx} RETURNING *`,
        values
    );
    return result.rows[0] || null;
};

const listTriggers = async () => {
    const result = await database.query(
        `SELECT t.*,
                COALESCE(l.total_sends, 0) AS total_sends,
                COALESCE(l.failure_count, 0) AS failure_count,
                l.last_sent_at,
                tmpl.key AS template_key,
                tmpl.name AS template_name
         FROM email_trigger_configs t
         LEFT JOIN (
             SELECT trigger_key,
                    COUNT(*) AS total_sends,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failure_count,
                    MAX(sent_at) AS last_sent_at
             FROM email_delivery_logs
             WHERE trigger_key IS NOT NULL
             GROUP BY trigger_key
         ) l ON l.trigger_key = t.trigger_key
         LEFT JOIN marketing_email_templates tmpl
           ON tmpl.key = CASE t.trigger_key
               WHEN 'business_unregistered_review_email' THEN $1
               WHEN 'chat_reply_notification_email' THEN $2
               ELSE NULL
           END
         ORDER BY t.created_at DESC`,
        [TEMPLATE_KEYS.businessReviewTrigger, TEMPLATE_KEYS.chatUserTrigger]
    );
    return result.rows;
};

const updateTrigger = async (triggerKey, payload, userId) => {
    const result = await database.query(
        `UPDATE email_trigger_configs
         SET is_enabled = $1, config = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP
         WHERE trigger_key = $4
         RETURNING *`,
        [payload.is_enabled !== false, JSON.stringify(payload.config || {}), userId, triggerKey]
    );
    return result.rows[0] || null;
};

const listLogs = async (filters = {}) => {
    const clauses = [];
    const values = [];
    let idx = 1;
    if (filters.status) {
        clauses.push(`status = $${idx++}`);
        values.push(filters.status);
    }
    if (filters.audience) {
        clauses.push(`recipient_type = $${idx++}`);
        values.push(filters.audience);
    }
    if (filters.trigger_key) {
        clauses.push(`trigger_key = $${idx++}`);
        values.push(filters.trigger_key);
    }
    if (filters.campaign_id) {
        clauses.push(`campaign_id = $${idx++}`);
        values.push(filters.campaign_id);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await database.query(
        `SELECT * FROM email_delivery_logs ${where} ORDER BY created_at DESC LIMIT 200`,
        values
    );
    return result.rows;
};

const getSettings = async () => {
    const result = await database.query(`SELECT value FROM system_settings WHERE key = 'marketing_settings'`);
    return result.rows[0]?.value || {};
};

const updateSettings = async (payload) => {
    await database.query(
        `INSERT INTO system_settings (key, value)
         VALUES ('marketing_settings', $1::jsonb)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
        [JSON.stringify(payload || {})]
    );
    return payload;
};

const logDelivery = async ({ templateId, campaignId, triggerKey, recipientEmail, recipientUserId, recipientType, subject, status, errorMessage, metadata }) => {
    const result = await database.query(
        `INSERT INTO email_delivery_logs (template_id, campaign_id, trigger_key, recipient_email, recipient_user_id, recipient_type, subject, status, error_message, metadata, sent_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
            templateId,
            campaignId || null,
            triggerKey || null,
            recipientEmail,
            recipientUserId || null,
            recipientType,
            subject,
            status,
            errorMessage || null,
            JSON.stringify(metadata || {}),
            status === 'sent' ? new Date() : null
        ]
    );
    return result.rows[0];
};

const resolveRecipients = async (audienceType) => {
    const roles = audienceType === 'employee' ? ['employee'] : ['psychologist'];
    const result = await database.query(
        `SELECT u.id, u.email, u.display_name, u.role, u.is_active,
                COALESCE(s.marketing_notifications, true) as marketing_notifications
         FROM users u
         LEFT JOIN user_settings s ON s.user_id = u.id
         WHERE u.role = ANY($1) AND u.is_active = true`,
        [roles]
    );
    return result.rows.filter((row) => row.marketing_notifications !== false);
};

const hasSentToday = async (campaignId, recipientEmail) => {
    const result = await database.query(
        `SELECT 1 FROM email_delivery_logs
         WHERE campaign_id = $1 AND recipient_email = $2 AND created_at::date = CURRENT_DATE
         LIMIT 1`,
        [campaignId, recipientEmail]
    );
    return result.rows.length > 0;
};

const runCampaign = async (campaign, options = {}) => {
    const settings = await getSettings();
    if (campaign.audience_type === 'employee' && settings.employee_marketing_enabled === false) {
        return { sent: 0, skipped: 0 };
    }
    if (campaign.audience_type === 'psychologist' && settings.psychologist_marketing_enabled === false) {
        return { sent: 0, skipped: 0 };
    }
    const template = await getTemplateById(campaign.template_id);
    if (!template || template.is_active === false) return { sent: 0, skipped: 0 };
    const recipients = await resolveRecipients(campaign.audience_type);
    let sent = 0;
    let skipped = 0;
    for (const recipient of recipients) {
        if (!recipient.email) continue;
        if (!options.force && await hasSentToday(campaign.id, recipient.email)) {
            skipped += 1;
            continue;
        }
        const variables = {
            first_name: recipient.display_name?.split(' ')[0] || recipient.display_name || '',
            full_name: recipient.display_name || recipient.email,
            sender_name: settings.sender_name || 'Welp Team',
            product_name: 'Welp',
            subscription_name: campaign.audience_type === 'employee' ? 'Employee Support' : 'Psychologist Partner'
        };
        try {
            const { subject } = await sendTemplatedEmail({
                template,
                to: recipient.email,
                variables,
                metadata: { campaignId: campaign.id }
            });
            await logDelivery({
                templateId: template.id,
                campaignId: campaign.id,
                recipientEmail: recipient.email,
                recipientUserId: recipient.id,
                recipientType: campaign.audience_type,
                subject,
                status: 'sent',
                metadata: { campaign: campaign.name }
            });
            sent += 1;
        } catch (error) {
            await logDelivery({
                templateId: template.id,
                campaignId: campaign.id,
                recipientEmail: recipient.email,
                recipientUserId: recipient.id,
                recipientType: campaign.audience_type,
                subject: template.subject,
                status: 'failed',
                errorMessage: error.message,
                metadata: { campaign: campaign.name }
            });
        }
    }
    await database.query(
        `UPDATE marketing_campaigns SET last_run_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [campaign.id]
    );
    return { sent, skipped };
};

module.exports = {
    TEMPLATE_KEYS,
    listTemplates,
    getTemplateById,
    getTemplateByKey,
    createTemplate,
    updateTemplate,
    listCampaigns,
    createCampaign,
    updateCampaign,
    listTriggers,
    updateTrigger,
    listLogs,
    getSettings,
    updateSettings,
    logDelivery,
    resolveRecipients,
    runCampaign
};
