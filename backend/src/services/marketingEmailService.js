const jwt = require('jsonwebtoken');
const { query } = require('../utils/database');
const { sendMarketingEmail } = require('../utils/emailService');

const DEFAULT_TEMPLATES = [
    {
        name: 'Welcome to Premium',
        subject: 'Unlock full support with Welp Premium',
        body_html: `
            <p>Hi {{name}},</p>
            <p>Thanks for joining Welp. With Premium, you get extended chat and video time, faster responses, and a consistent wellbeing routine.</p>
            <p>Upgrade anytime to unlock the full experience.</p>
        `,
        body_text: 'Thanks for joining Welp. Premium gives you more support and faster responses. Upgrade anytime.'
    },
    {
        name: 'Your Next Step',
        subject: 'See what Premium can do for you',
        body_html: `
            <p>Hi {{name}},</p>
            <p>Premium helps you stay on track with more sessions and priority support.</p>
            <p>Whenever you are ready, upgrade in your dashboard.</p>
        `,
        body_text: 'Premium helps you stay on track with more sessions and priority support. Upgrade in your dashboard.'
    },
    {
        name: 'Support That Fits',
        subject: 'More time. More support. Welp Premium',
        body_html: `
            <p>Hi {{name}},</p>
            <p>Premium gives you more time with your psychologist and priority access when you need it most.</p>
            <p>Upgrade when it feels right.</p>
        `,
        body_text: 'Premium gives you more time with your psychologist and priority access. Upgrade when it feels right.'
    }
];

const buildUnsubscribeToken = (userId) => {
    const secret = process.env.JWT_SECRET || 'changeme';
    return jwt.sign(
        { sub: userId, type: 'marketing_unsubscribe' },
        secret,
        { expiresIn: process.env.MARKETING_UNSUBSCRIBE_EXPIRES_IN || '180d' }
    );
};

const buildUnsubscribeUrl = (token) => {
    const base = process.env.BACKEND_URL || 'http://localhost:5000';
    return `${base.replace(/\/$/, '')}/api/marketing/unsubscribe?token=${encodeURIComponent(token)}`;
};

const wrapMarketingHtml = (bodyHtml, unsubscribeUrl) => `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; background: #f3f4f6; }
    .container { max-width: 640px; margin: 0 auto; padding: 24px; }
    .card { background: #ffffff; border-radius: 12px; padding: 28px; border: 1px solid #e5e7eb; }
    .footer { font-size: 12px; color: #6b7280; text-align: center; margin-top: 16px; }
    a { color: #4f46e5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>You are receiving this email because you have a free Welp account.</p>
      <p><a href="${unsubscribeUrl}">Unsubscribe from marketing emails</a></p>
    </div>
  </div>
</body>
</html>`;

const renderTemplate = (template, user) => {
    const name = user?.display_name || user?.email || 'there';
    const replacements = {
        '{{name}}': name,
        '{{email}}': user?.email || '',
        '{{role}}': user?.role || ''
    };

    const replaceTokens = (content) => {
        let updated = content || '';
        Object.entries(replacements).forEach(([key, value]) => {
            updated = updated.split(key).join(value);
        });
        return updated;
    };

    return {
        subject: replaceTokens(template.subject),
        body_html: replaceTokens(template.body_html),
        body_text: replaceTokens(template.body_text)
    };
};

const initMarketingTables = async () => {
    await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await query(`
        CREATE TABLE IF NOT EXISTS user_settings (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            theme VARCHAR(10) DEFAULT 'light',
            email_notifications BOOLEAN DEFAULT true,
            message_notifications BOOLEAN DEFAULT true,
            review_notifications BOOLEAN DEFAULT true,
            marketing_notifications BOOLEAN DEFAULT true,
            product_updates BOOLEAN DEFAULT true,
            security_alerts BOOLEAN DEFAULT true,
            profile_visibility VARCHAR(20) DEFAULT 'public',
            data_sharing BOOLEAN DEFAULT false,
            language VARCHAR(10) DEFAULT 'en',
            timezone VARCHAR(50) DEFAULT 'UTC',
            two_factor_enabled BOOLEAN DEFAULT false,
            login_alerts BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS marketing_email_templates (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(150) NOT NULL,
            subject VARCHAR(255) NOT NULL,
            body_html TEXT NOT NULL,
            body_text TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await query(`
        CREATE TABLE IF NOT EXISTS marketing_email_queue (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            template_id UUID REFERENCES marketing_email_templates(id) ON DELETE CASCADE,
            scheduled_at TIMESTAMP NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            attempts INT DEFAULT 0,
            last_error TEXT,
            sent_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_marketing_queue_status ON marketing_email_queue(status, scheduled_at)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_marketing_queue_user ON marketing_email_queue(user_id)`);

    const existing = await query('SELECT COUNT(*) FROM marketing_email_templates');
    if (Number(existing.rows[0]?.count || 0) === 0) {
        for (const template of DEFAULT_TEMPLATES) {
            await query(
                `INSERT INTO marketing_email_templates (name, subject, body_html, body_text, is_active)
                 VALUES ($1, $2, $3, $4, true)`,
                [template.name, template.subject, template.body_html, template.body_text]
            );
        }
    }
};

const shouldSkipMarketingForUser = async (userId) => {
    const settings = await query(
        'SELECT marketing_notifications, email_notifications FROM user_settings WHERE user_id = $1',
        [userId]
    );
    if (settings.rows.length > 0 && settings.rows[0].marketing_notifications === false) {
        return true;
    }
    if (settings.rows.length > 0 && settings.rows[0].email_notifications === false) {
        return true;
    }

    const premium = await query(
        `SELECT 1 FROM subscriptions WHERE user_id = $1 AND status = 'active' AND plan = 'premium' LIMIT 1`,
        [userId]
    );
    return premium.rows.length > 0;
};

const enqueueMarketingForUser = async (userId, count = 3) => {
    if (!userId) return;
    if (await shouldSkipMarketingForUser(userId)) return;

    const existing = await query(
        `SELECT COUNT(*) FROM marketing_email_queue WHERE user_id = $1 AND status = 'pending'`,
        [userId]
    );
    if (Number(existing.rows[0]?.count || 0) >= count) return;

    const templates = await query(
        `SELECT * FROM marketing_email_templates WHERE is_active = true`
    );
    if (templates.rows.length === 0) return;

    let scheduledAt = Date.now() + (6 * 60 * 60 * 1000) + Math.floor(Math.random() * 12 * 60 * 60 * 1000);
    for (let i = 0; i < count; i += 1) {
        const template = templates.rows[Math.floor(Math.random() * templates.rows.length)];
        scheduledAt += Math.floor((2 + Math.random() * 4) * 24 * 60 * 60 * 1000);

        await query(
            `INSERT INTO marketing_email_queue (user_id, template_id, scheduled_at)
             VALUES ($1, $2, to_timestamp($3 / 1000.0))`,
            [userId, template.id, scheduledAt]
        );
    }
};

const processMarketingQueue = async (batchSize = 25) => {
    const result = await query(
        `SELECT q.id, q.user_id, q.template_id, t.subject, t.body_html, t.body_text,
                u.email, u.display_name, u.role
         FROM marketing_email_queue q
         JOIN marketing_email_templates t ON t.id = q.template_id
         JOIN users u ON u.id = q.user_id
         LEFT JOIN user_settings us ON us.user_id = u.id
         WHERE q.status = 'pending'
           AND q.scheduled_at <= CURRENT_TIMESTAMP
           AND t.is_active = true
           AND (us.marketing_notifications IS NULL OR us.marketing_notifications = true)
           AND (us.email_notifications IS NULL OR us.email_notifications = true)
           AND NOT EXISTS (
               SELECT 1 FROM subscriptions s
               WHERE s.user_id = u.id AND s.status = 'active' AND s.plan = 'premium'
           )
         ORDER BY q.scheduled_at ASC
         LIMIT $1`,
        [batchSize]
    );

    for (const row of result.rows) {
        const rendered = renderTemplate(row, row);
        const token = buildUnsubscribeToken(row.user_id);
        const unsubscribeUrl = buildUnsubscribeUrl(token);
        const html = wrapMarketingHtml(rendered.body_html, unsubscribeUrl);

        const response = await sendMarketingEmail({
            to: row.email,
            subject: rendered.subject,
            html,
            text: rendered.body_text
        });

        if (response.success) {
            await query(
                `UPDATE marketing_email_queue
                 SET status = 'sent', sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [row.id]
            );
        } else {
            await query(
                `UPDATE marketing_email_queue
                 SET status = 'failed', attempts = attempts + 1, last_error = $2, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [row.id, response.error || 'Unknown error']
            );
        }
    }
};

const startMarketingScheduler = () => {
    const intervalMinutes = Number(process.env.MARKETING_SCHEDULER_MINUTES || 5);
    setInterval(() => {
        processMarketingQueue().catch(error => {
            console.warn('Marketing scheduler error:', error.message);
        });
    }, intervalMinutes * 60 * 1000);
};

module.exports = {
    initMarketingTables,
    enqueueMarketingForUser,
    processMarketingQueue,
    startMarketingScheduler,
    renderTemplate,
    wrapMarketingHtml,
    buildUnsubscribeToken,
    buildUnsubscribeUrl
};
