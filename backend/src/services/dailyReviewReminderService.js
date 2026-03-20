const cron = require('node-cron');
const { query } = require('../utils/database');
const { sendDailyReviewReminderEmail } = require('../utils/emailService');
const { REVIEW_TYPES } = require('../utils/reviewTypes');

const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'Africa/Johannesburg';
const REMINDER_CRON = process.env.DAILY_REVIEW_REMINDER_CRON || '0 17 * * *';

const toLocalDate = (timezone) => {
    const localeDate = new Date().toLocaleDateString('en-CA', { timeZone: timezone || DEFAULT_TIMEZONE });
    return localeDate;
};

const shouldSendReminder = async ({ userId, reviewDate, workplaceId }) => {
    if (!reviewDate) return false;
    const existingReminder = await query(
        `SELECT 1 FROM review_daily_reminder_logs WHERE user_id = $1 AND reminder_date = $2`,
        [userId, reviewDate]
    );
    if (existingReminder.rows.length) return false;

    if (!workplaceId) return false;

    const submitted = await query(
        `SELECT 1 FROM reviews
         WHERE author_id = $1
           AND review_type = $2
           AND review_date = $3
           AND company_id = $4
         LIMIT 1`,
        [userId, REVIEW_TYPES.DAILY, reviewDate, workplaceId]
    );
    return submitted.rows.length === 0;
};

const runDailyReviewReminders = async () => {
    const usersResult = await query(
        `SELECT
            u.id,
            u.email,
            u.display_name,
            u.workplace_id,
            COALESCE(us.email_notifications, true) as email_notifications,
            COALESCE(us.review_notifications, true) as review_notifications,
            COALESCE(us.timezone, $1) as timezone,
            c.name as company_name
         FROM users u
         LEFT JOIN user_settings us ON us.user_id = u.id
         LEFT JOIN companies c ON c.id = u.workplace_id
         WHERE LOWER(u.role) = 'employee'
           AND u.email IS NOT NULL`,
        [DEFAULT_TIMEZONE]
    );

    for (const user of usersResult.rows) {
        if (!user.email_notifications || !user.review_notifications) {
            continue;
        }
        const reviewDate = toLocalDate(user.timezone || DEFAULT_TIMEZONE);
        const eligible = await shouldSendReminder({
            userId: user.id,
            reviewDate,
            workplaceId: user.workplace_id
        });

        if (!eligible) continue;

        const checklistUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`;
        const result = await sendDailyReviewReminderEmail({
            to: [user.email],
            companyName: user.company_name || 'your workplace',
            checklistUrl
        });

        await query(
            `INSERT INTO review_daily_reminder_logs (user_id, reminder_date, status, metadata)
             VALUES ($1, $2, $3, $4::jsonb)
             ON CONFLICT (user_id, reminder_date) DO NOTHING`,
            [
                user.id,
                reviewDate,
                result.success ? 'sent' : 'failed',
                JSON.stringify({ email: user.email, companyId: user.workplace_id })
            ]
        );
    }
};

const startDailyReviewReminderScheduler = () => {
    const job = cron.schedule(REMINDER_CRON, () => {
        runDailyReviewReminders().catch((error) => {
            console.warn('Daily review reminder scheduler error:', error.message);
        });
    }, { timezone: DEFAULT_TIMEZONE });
    console.log('✅ Daily review reminder scheduler initialized');
    return job;
};

module.exports = {
    runDailyReviewReminders,
    startDailyReviewReminderScheduler
};
