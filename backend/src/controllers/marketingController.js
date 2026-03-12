const jwt = require('jsonwebtoken');
const { query } = require('../utils/database');
const {
    renderTemplate,
    wrapMarketingHtml,
    buildUnsubscribeToken,
    buildUnsubscribeUrl
} = require('../services/marketingEmailService');
const { sendMarketingEmail } = require('../utils/emailService');

const listTemplates = async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM marketing_email_templates ORDER BY updated_at DESC'
        );
        res.json({ templates: result.rows });
    } catch (error) {
        console.error('List templates error:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
};

const createTemplate = async (req, res) => {
    try {
        const { name, subject, body_html, body_text, is_active } = req.body;
        const result = await query(
            `INSERT INTO marketing_email_templates (name, subject, body_html, body_text, is_active)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [name, subject, body_html, body_text || null, is_active !== false]
        );
        res.status(201).json({ template: result.rows[0] });
    } catch (error) {
        console.error('Create template error:', error);
        res.status(500).json({ error: 'Failed to create template' });
    }
};

const updateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, subject, body_html, body_text, is_active } = req.body;
        const result = await query(
            `UPDATE marketing_email_templates
             SET name = $1,
                 subject = $2,
                 body_html = $3,
                 body_text = $4,
                 is_active = $5,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $6
             RETURNING *`,
            [name, subject, body_html, body_text || null, is_active !== false, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }
        res.json({ template: result.rows[0] });
    } catch (error) {
        console.error('Update template error:', error);
        res.status(500).json({ error: 'Failed to update template' });
    }
};

const deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        await query('DELETE FROM marketing_email_templates WHERE id = $1', [id]);
        res.json({ message: 'Template deleted' });
    } catch (error) {
        console.error('Delete template error:', error);
        res.status(500).json({ error: 'Failed to delete template' });
    }
};

const sendTemplateTest = async (req, res) => {
    try {
        const { id } = req.params;
        const { email, userId } = req.body;

        if (!email && !userId) {
            return res.status(400).json({ error: 'Email or userId is required' });
        }

        const templateResult = await query(
            'SELECT * FROM marketing_email_templates WHERE id = $1',
            [id]
        );
        if (templateResult.rows.length === 0) {
            return res.status(404).json({ error: 'Template not found' });
        }
        const template = templateResult.rows[0];

        let user = null;
        if (userId || email) {
            const userResult = await query(
                `SELECT id, email, display_name, role FROM users WHERE ${userId ? 'id = $1' : 'LOWER(email) = LOWER($1)'} LIMIT 1`,
                [userId || email]
            );
            if (userResult.rows.length > 0) {
                user = userResult.rows[0];
            }
        }

        const rendered = renderTemplate(template, user || { email });
        const unsubscribeToken = user?.id ? buildUnsubscribeToken(user.id) : buildUnsubscribeToken(req.user.id);
        const unsubscribeUrl = buildUnsubscribeUrl(unsubscribeToken);
        const html = wrapMarketingHtml(rendered.body_html, unsubscribeUrl);

        const result = await sendMarketingEmail({
            to: email || user?.email,
            subject: `[TEST] ${rendered.subject}`,
            html,
            text: rendered.body_text
        });

        if (!result.success) {
            return res.status(500).json({ error: result.error || 'Failed to send test email' });
        }

        res.json({ message: 'Test email sent' });
    } catch (error) {
        console.error('Send test email error:', error);
        res.status(500).json({ error: 'Failed to send test email' });
    }
};

const unsubscribeMarketing = async (req, res) => {
    try {
        const token = req.query.token;
        if (!token) {
            return res.status(400).send('Missing token');
        }

        const secret = process.env.JWT_SECRET || 'changeme';
        const payload = jwt.verify(token, secret);
        if (!payload || payload.type !== 'marketing_unsubscribe') {
            return res.status(400).send('Invalid token');
        }

        await query(
            `INSERT INTO user_settings (user_id, marketing_notifications)
             VALUES ($1, false)
             ON CONFLICT (user_id)
             DO UPDATE SET marketing_notifications = false, updated_at = CURRENT_TIMESTAMP`,
            [payload.sub]
        );

        res.send(`
            <html>
              <body style="font-family: Arial, sans-serif; padding: 40px;">
                <h2>You have been unsubscribed.</h2>
                <p>You will no longer receive marketing emails from Welp.</p>
              </body>
            </html>
        `);
    } catch (error) {
        console.error('Unsubscribe error:', error);
        res.status(400).send('Invalid or expired token');
    }
};

module.exports = {
    listTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    sendTemplateTest,
    unsubscribeMarketing
};
