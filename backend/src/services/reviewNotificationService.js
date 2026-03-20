const { query } = require('../utils/database');
const { sendReviewNotificationEmail } = require('../utils/emailService');
const { resolveReviewTypeLabel } = require('../utils/reviewTypes');

const APP_BASE_URL = process.env.APP_BASE_URL
    || process.env.FRONTEND_URL
    || process.env.APP_URL
    || 'https://app.welp.co.za';
const REVIEW_RESPONSE_PATH = '/dashboard?tab=reviews';
const CLAIM_BUSINESS_PATH = '/claim-business';

const TEST_NOTIFICATION_EMAIL = process.env.REVIEW_NOTIFICATION_TEST_EMAIL || 'omphulestudent@gmail.com';
const REVIEW_NOTIFICATION_CC_TEST = String(process.env.REVIEW_NOTIFICATION_CC_TEST ?? 'true').toLowerCase() !== 'false';
const isProduction = process.env.NODE_ENV === 'production';

const parseJson = (value, fallback) => {
    if (!value) return fallback;
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
    }
    if (Array.isArray(fallback) && Array.isArray(value)) return value;
    if (typeof value === 'object') return value;
    return fallback;
};

const extractDomain = (website) => {
    if (!website || typeof website !== 'string') return null;
    let candidate = website.trim();
    if (!candidate) return null;
    if (!candidate.startsWith('http')) {
        candidate = `https://${candidate}`;
    }
    try {
        const url = new URL(candidate);
        return url.hostname.replace(/^www\./i, '');
    } catch {
        return null;
    }
};

const buildFallbackEmails = (domain) => {
    if (!domain) return [];
    return [`complaints@${domain}`, `compliance@${domain}`];
};

const updateReviewNotificationStatus = async (reviewId, status, notes = null) => {
    await query(
        `UPDATE reviews
         SET notification_status = $1,
             notification_notes = $2,
             notification_last_sent_at = CASE
                 WHEN $1 IN ('sent','failed') THEN CURRENT_TIMESTAMP
                 ELSE notification_last_sent_at
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [status, notes, reviewId]
    );
};

const recordNotificationLog = async ({
    reviewId,
    companyId,
    emailTo,
    cc = [],
    subject,
    status,
    error = null,
    metadata = {},
    triggeredBy = null,
    triggerSource = 'system'
}) => {
    const payload = await query(
        `INSERT INTO review_notification_logs (
            review_id,
            company_id,
            email_to,
            cc,
            subject,
            status,
            error,
            metadata,
            triggered_by,
            trigger_source
        ) VALUES (
            $1,$2,$3,$4::jsonb,$5,$6,$7,$8::jsonb,$9,$10
        )
        RETURNING *`,
        [
            reviewId,
            companyId,
            emailTo || 'unavailable',
            JSON.stringify(cc || []),
            subject,
            status,
            error,
            JSON.stringify(metadata || {}),
            triggeredBy,
            triggerSource
        ]
    );
    return payload.rows[0];
};

const fetchReviewContext = async (reviewId) => {
    const result = await query(
        `SELECT
            r.*,
            r.review_type,
            r.review_stage,
            r.review_date,
            c.name          AS company_name,
            c.email         AS company_email,
            c.website       AS company_website,
            c.is_claimed    AS company_is_claimed,
            c.claimed_by,
            c.city          AS company_city,
            c.country       AS company_country,
            owner.email     AS owner_email,
            u.display_name  AS reviewer_name,
            u.location      AS reviewer_location
         FROM reviews r
         JOIN companies c ON c.id = r.company_id
         JOIN users u ON u.id = r.author_id
         LEFT JOIN users owner ON owner.id = c.claimed_by
         WHERE r.id = $1
         LIMIT 1`,
        [reviewId]
    );
    return result.rows[0] || null;
};

const resolveCompanyRecipient = (context) => {
    if (!context) return null;
    const normalizedCompanyEmail = (context.company_email || '').trim();
    const normalizedOwnerEmail = (context.owner_email || '').trim();
    if (context.company_is_claimed) {
        if (normalizedOwnerEmail) {
            return { email: normalizedOwnerEmail, hasProfile: true };
        }
        if (normalizedCompanyEmail) {
            return { email: normalizedCompanyEmail, hasProfile: true };
        }
    } else if (normalizedCompanyEmail) {
        return { email: normalizedCompanyEmail, hasProfile: false };
    }
    const domain = extractDomain(context.company_website);
    const fallbacks = buildFallbackEmails(domain);
    const fallbackEmail = fallbacks.find(Boolean);
    if (fallbackEmail) {
        return { email: fallbackEmail, hasProfile: Boolean(context.company_is_claimed), fallbackEmails: fallbacks };
    }
    return null;
};

const formatReviewMetadata = (context) => {
    const reviewerName = context.is_anonymous
        ? 'Anonymous reviewer'
        : context.reviewer_name || 'Verified user';
    const reviewDate = context.created_at ? new Date(context.created_at).toISOString() : null;
    const location = context.reviewer_location || context.company_city || context.company_country || null;
    return {
        reviewerName,
        reviewDate,
        location,
        reviewTypeLabel: resolveReviewTypeLabel(context.review_type),
        reviewStage: context.review_stage || null,
        reviewDateValue: context.review_date || null
    };
};

const triggerReviewNotification = async (reviewId, { force = false, adminId = null, source = 'system' } = {}) => {
    const context = await fetchReviewContext(reviewId);
    if (!context) {
        return { status: 'not_found' };
    }

    if (!force && context.notification_status === 'sent') {
        return { status: 'already_sent' };
    }

    const recipient = resolveCompanyRecipient(context);
    const metadata = formatReviewMetadata(context);
    const reviewDateReadable = metadata.reviewDate
        ? new Date(metadata.reviewDate).toLocaleDateString()
        : new Date(context.created_at).toLocaleDateString();
    const reviewLocation = metadata.location || 'Not specified';
    const reviewerName = metadata.reviewerName;

    const dashboardUrl = `${APP_BASE_URL}${REVIEW_RESPONSE_PATH}&company=${context.company_id}`;
    const respondUrl = dashboardUrl;
    const claimUrl = `${APP_BASE_URL}${CLAIM_BUSINESS_PATH}?company=${context.company_id}`;

    if (!recipient || !recipient.email) {
        await updateReviewNotificationStatus(reviewId, 'awaiting_contact', 'No contact email available');
        await recordNotificationLog({
            reviewId,
            companyId: context.company_id,
            emailTo: 'unavailable',
            cc: [],
            subject: 'Review notification pending',
            status: 'awaiting_contact',
            error: 'No destination email available',
            metadata: {
                rating: context.rating,
                reviewerName,
                reviewExcerpt: context.content?.slice(0, 160) || '',
                reviewDate: reviewDateReadable,
                type: recipient?.hasProfile ? 'claimed' : 'unclaimed',
                location: reviewLocation
            },
            triggeredBy: adminId,
            triggerSource: source
        });
        return { status: 'awaiting_contact' };
    }

    const baseRecipients = [recipient.email];
    if (TEST_NOTIFICATION_EMAIL && (REVIEW_NOTIFICATION_CC_TEST || !isProduction)) {
        baseRecipients.push(TEST_NOTIFICATION_EMAIL);
    }
    const recipients = Array.from(new Set(baseRecipients.filter(Boolean)));
    if (!recipients.length) {
        await updateReviewNotificationStatus(reviewId, 'awaiting_contact', 'No contact email available');
        await recordNotificationLog({
            reviewId,
            companyId: context.company_id,
            emailTo: 'unavailable',
            cc: [],
            subject: 'Review notification pending',
            status: 'awaiting_contact',
            error: 'No destination email available after filtering',
            metadata: {
                rating: context.rating,
                reviewerName,
                reviewExcerpt: context.content?.slice(0, 160) || '',
                reviewDate: reviewDateReadable,
                type: recipient?.hasProfile ? 'claimed' : 'unclaimed',
                location: reviewLocation
            },
            triggeredBy: adminId,
            triggerSource: source
        });
        return { status: 'awaiting_contact' };
    }

    const emailPayload = {
        to: recipients,
        type: recipient.hasProfile ? 'claimed' : 'unclaimed',
        companyName: context.company_name,
        rating: context.rating,
        reviewContent: context.content,
        reviewDate: reviewDateReadable,
        reviewerName,
        reviewLocation,
        companyCountry: context.company_country,
        reviewType: context.review_type,
        reviewStage: context.review_stage,
        reviewTypeLabel: metadata.reviewTypeLabel,
        dashboardUrl,
        respondUrl,
        claimUrl,
        cc: []
    };

    let emailResult;
    try {
        emailResult = await sendReviewNotificationEmail(emailPayload);
    } catch (error) {
        emailResult = { success: false, error: error.message };
    }
    const status = emailResult.success ? 'sent' : 'failed';
    const errorMessage = emailResult.success ? null : (emailResult.error || 'Unknown email error');
    const defaultSubject = emailPayload.type === 'claimed'
        ? 'New Review Submitted for Your Business'
        : 'A Review Has Been Posted About Your Company';

    await updateReviewNotificationStatus(reviewId, status, errorMessage);
    const log = await recordNotificationLog({
        reviewId,
        companyId: context.company_id,
        emailTo: recipients.join(', '),
        cc: [],
        subject: emailResult.subject || defaultSubject,
        status,
        error: errorMessage,
        metadata: {
            rating: context.rating,
            reviewerName,
            reviewExcerpt: context.content?.slice(0, 280) || '',
            reviewDate: reviewDateReadable,
            type: emailPayload.type,
            reviewType: context.review_type,
            reviewStage: context.review_stage,
            location: reviewLocation
        },
        triggeredBy: adminId,
        triggerSource: source
    });

    if (!emailResult.success) {
        const error = new Error(errorMessage || 'Failed to send review notification');
        error.log = log;
        throw error;
    }

    return { status, log };
};

const listReviewNotificationLogs = async ({ page = 1, limit = 20, status = 'all', search = '' }) => {
    const validPage = Math.max(1, parseInt(page, 10) || 1);
    const validLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (validPage - 1) * validLimit;

    const filters = [];
    const params = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
        filters.push(`l.status = $${paramIndex++}`);
        params.push(status);
    }

    if (search) {
        filters.push(`(
            c.name ILIKE $${paramIndex}
            OR l.email_to ILIKE $${paramIndex}
            OR r.content ILIKE $${paramIndex}
        )`);
        params.push(`%${search.trim()}%`);
        paramIndex++;
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const baseQuery = `
        FROM review_notification_logs l
        JOIN reviews r ON r.id = l.review_id
        JOIN companies c ON c.id = l.company_id
    `;

    const dataQuery = `
        SELECT l.*, c.name AS company_name, r.rating, r.content, r.created_at AS review_created_at
        ${baseQuery}
        ${whereClause}
        ORDER BY l.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    const countQuery = `SELECT COUNT(*) ${baseQuery} ${whereClause}`;

    const dataResult = await query(dataQuery, [...params, validLimit, offset]);
    const countResult = await query(countQuery, params);
    const total = Number(countResult.rows[0]?.count || 0);

    const logs = dataResult.rows.map((row) => ({
        ...row,
        cc: parseJson(row.cc, []),
        metadata: parseJson(row.metadata, {}),
        review_created_at: row.review_created_at,
        created_at: row.created_at
    }));

    return {
        logs,
        pagination: {
            page: validPage,
            limit: validLimit,
            total,
            pages: Math.ceil(total / validLimit) || 0
        }
    };
};

const resendReviewNotificationLog = async (logId, adminId) => {
    const logResult = await query(
        `SELECT review_id
         FROM review_notification_logs
         WHERE id = $1`,
        [logId]
    );
    if (!logResult.rows.length) {
        const error = new Error('Notification log not found');
        error.status = 404;
        throw error;
    }
    return triggerReviewNotification(logResult.rows[0].review_id, {
        force: true,
        adminId,
        source: 'admin_resend'
    });
};

module.exports = {
    triggerReviewNotification,
    listReviewNotificationLogs,
    resendReviewNotificationLog
};
