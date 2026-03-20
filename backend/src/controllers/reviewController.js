
const { query } = require('../utils/database');
const { moderateReview, analyzeSentiment } = require('../services/mlServices');
const { createAdminNotification } = require('../utils/adminNotifications');
const { triggerReviewNotification } = require('../services/reviewNotificationService');
const { handleBusinessReviewOutreach } = require('../modules/marketing/marketing.triggers');
const {
    REVIEW_TYPES,
    ONBOARDING_STAGES,
    normalizeReviewType,
    normalizeReviewStage
} = require('../utils/reviewTypes');


const updateReviewsTable = async () => {
    try {
        await query(`
            ALTER TABLE reviews
            ADD COLUMN IF NOT EXISTS author_occupation VARCHAR(255),
            ADD COLUMN IF NOT EXISTS author_workplace_id UUID REFERENCES companies(id),
            ADD COLUMN IF NOT EXISTS sentiment_label VARCHAR(32),
            ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC(5,4),
            ADD COLUMN IF NOT EXISTS moderation_reason VARCHAR(255),
            ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(32)
        `);
        await query("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS notification_status VARCHAR(32) DEFAULT 'pending'");
        await query("ALTER TABLE reviews ALTER COLUMN notification_status SET DEFAULT 'pending'");
        await query("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS notification_notes TEXT");
        await query("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS notification_last_sent_at TIMESTAMP");
        await query("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_type VARCHAR(32) DEFAULT 'company_review'");
        await query("ALTER TABLE reviews ALTER COLUMN review_type SET DEFAULT 'company_review'");
        await query("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_stage VARCHAR(32)");
        await query("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_date DATE");
        await query("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_week_start DATE");
        console.log('✅ Reviews table schema updated successfully');
    } catch (error) {
        console.error('Error updating reviews table:', error.message);
    }
};


updateReviewsTable();


const createReview = async (req, res) => {
    try {
        const {
            companyId,
            rating,
            content,
            isPublic = true,
            isAnonymous = false,
            reviewType,
            reviewStage,
            reviewDate
        } = req.body;


        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(companyId)) {
            return res.status(400).json({ error: 'Invalid company ID format' });
        }


        const company = await query(
            'SELECT id FROM companies WHERE id = $1',
            [companyId]
        );

        if (company.rows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }


        const user = await query(
            `SELECT
                u.occupation,
                u.workplace_id,
                json_build_object(
                    'id', c.id,
                    'name', c.name
                ) as workplace
             FROM users u
             LEFT JOIN companies c ON u.workplace_id = c.id
             WHERE u.id = $1`,
            [req.user.id]
        );

        let moderation = { is_flagged: false, reason: null };
        try {
            const moderationResult = await moderateReview(content);
            if (moderationResult && typeof moderationResult === 'object') {
                moderation = moderationResult;
            }
        } catch (err) {
            console.warn('ML moderation unavailable, allowing review:', err.message);
        }

        let sentiment = { sentiment: 'neutral', score: 0 };
        try {
            const sentimentResult = await analyzeSentiment(content);
            if (sentimentResult && typeof sentimentResult === 'object') {
                sentiment = sentimentResult;
            }
        } catch (err) {
            console.warn('ML sentiment unavailable, defaulting to neutral:', err.message);
        }

        const decisionRaw = String(
            moderation?.decision ||
            moderation?.action ||
            moderation?.status ||
            moderation?.result ||
            ''
        ).toLowerCase();

        let moderationStatus = 'approved';
        if (moderation?.is_flagged || decisionRaw === 'flag' || decisionRaw === 'flagged') {
            moderationStatus = 'flagged';
        } else if (moderation?.is_rejected || decisionRaw === 'reject' || decisionRaw === 'rejected') {
            moderationStatus = 'rejected';
        }

        const normalizedReviewType = normalizeReviewType(reviewType);
        const normalizedStage = normalizeReviewStage(reviewStage);

        if (normalizedReviewType === REVIEW_TYPES.ONBOARDING && !normalizedStage) {
            return res.status(400).json({ error: `Review stage is required for onboarding reviews (${ONBOARDING_STAGES.join(', ')})` });
        }

        if (normalizedReviewType !== REVIEW_TYPES.ONBOARDING && normalizedStage) {
            return res.status(400).json({ error: 'Review stage is only allowed for onboarding reviews' });
        }

        const reviewDateInput = normalizedReviewType === REVIEW_TYPES.DAILY ? (reviewDate || null) : null;

        const result = await query(
            `INSERT INTO reviews (
                company_id,
                author_id,
                rating,
                content,
                review_type,
                review_stage,
                review_date,
                review_week_start,
                is_public,
                is_anonymous,
                author_occupation,
                author_workplace_id,
                sentiment_label,
                sentiment_score,
                moderation_reason,
                moderation_status,
                is_flagged,
                flag_reason
             )
             VALUES (
                $1, $2, $3, $4,
                $5, $6,
                CASE
                    WHEN $5 = 'daily_work_review' THEN COALESCE($7::date, (now() AT TIME ZONE 'Africa/Johannesburg')::date)
                    ELSE NULL
                END,
                CASE
                    WHEN $5 = 'daily_work_review' THEN date_trunc('week', COALESCE($7::date, (now() AT TIME ZONE 'Africa/Johannesburg')::date))::date
                    ELSE NULL
                END,
                $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
             )
             RETURNING *`,
            [
                companyId,
                req.user.id,
                rating,
                content,
                normalizedReviewType,
                normalizedStage,
                reviewDateInput,
                isPublic,
                Boolean(isAnonymous),
                user.rows[0]?.occupation,
                user.rows[0]?.workplace_id,
                sentiment.sentiment,
                sentiment.score,
                moderation.reason,
                moderationStatus,
                moderationStatus === 'flagged',
                moderation.reason
            ]
        );

        const review = result.rows[0];


        const author = await query(
            `SELECT
                u.id,
                u.display_name,
                u.role,
                u.is_anonymous,
                u.occupation,
                u.avatar_url,
                u.workplace_id,
                json_build_object(
                    'id', c.id,
                    'name', c.name,
                    'logo_url', c.logo_url
                ) as workplace
             FROM users u
             LEFT JOIN companies c ON u.workplace_id = c.id
             WHERE u.id = $1`,
            [req.user.id]
        );

        const authorRow = author.rows[0] || {};

        const reviewPayload = {
            ...review,
            author: {
                ...authorRow,
                is_anonymous: Boolean(review.is_anonymous) || Boolean(authorRow?.is_anonymous)
            }
        };

        triggerReviewNotification(review.id).catch((notifyError) => {
            console.error('Review notification trigger failed:', notifyError.message);
        });
        handleBusinessReviewOutreach({ reviewId: review.id }).catch((error) => {
            console.error('Business review outreach error:', error.message);
        });

        await createAdminNotification({
            type: 'review_moderation',
            message: `Review auto ${moderationStatus} for company ${companyId}`,
            entityType: 'review',
            entityId: review.id
        });

        res.status(201).json(reviewPayload);
    } catch (error) {
        console.error('Create review error:', error);
        res.status(500).json({ error: 'Failed to create review' });
    }
};


const getCompanyReviews = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { page = 1, limit = 20, sort = 'newest', type } = req.query;


        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(companyId)) {
            return res.status(400).json({ error: 'Invalid company ID format' });
        }

        const validPage = Math.max(1, parseInt(page) || 1);
        const validLimit = Math.min(50, Math.max(1, parseInt(limit) || 20));
        const offset = (validPage - 1) * validLimit;

        let orderBy = 'r.created_at DESC';
        switch (sort) {
            case 'oldest':
                orderBy = 'r.created_at ASC';
                break;
            case 'highest':
                orderBy = 'r.rating DESC';
                break;
            case 'lowest':
                orderBy = 'r.rating ASC';
                break;
        }


        const normalizedType = type ? normalizeReviewType(type) : null;
        const countParams = [companyId];
        let countSql = 'SELECT COUNT(*) FROM reviews WHERE company_id = $1 AND COALESCE(is_public, true) = true';
        if (normalizedType) {
            countSql += ' AND review_type = $2';
            countParams.push(normalizedType);
        }
        const countResult = await query(countSql, countParams);
        const total = parseInt(countResult.rows[0]?.count || 0);


        const queryParams = [companyId, validLimit, offset];
        let typeFilter = '';
        if (normalizedType) {
            typeFilter = 'AND r.review_type = $4';
            queryParams.push(normalizedType);
        }

        const result = await query(
            `SELECT
                 r.*,
                 json_build_object(
                          'id', u.id,
                          'displayName', u.display_name,
                          'role', u.role,
                          'isAnonymous', COALESCE(r.is_anonymous, u.is_anonymous),
                          'occupation', r.author_occupation,
                          'avatarUrl', u.avatar_url,
                          'workplace', CASE
                                          WHEN r.author_workplace_id IS NOT NULL THEN
                                              json_build_object(
                                                      'id', c.id,
                                                      'name', c.name,
                                                      'logo_url', c.logo_url
                                              )
                                          ELSE NULL
                             END
                 ) as author,
                 COALESCE(
                         json_agg(
                                 json_build_object(
                                         'id', rep.id,
                                         'content', rep.content,
                                         'authorRole', rep.author_role,
                                         'createdAt', rep.created_at,
                                         'author', json_build_object(
                                                 'id', au.id,
                                                 'displayName', au.display_name,
                                                 'role', au.role,
                                                 'avatarUrl', au.avatar_url
                                                   )
                                 )
                                     ORDER BY rep.created_at ASC
                         ) FILTER (WHERE rep.id IS NOT NULL), '[]'::json
                 ) as replies
             FROM reviews r
                      JOIN users u ON r.author_id = u.id
                      LEFT JOIN companies c ON r.author_workplace_id = c.id
                      LEFT JOIN replies rep ON r.id = rep.review_id
                      LEFT JOIN users au ON rep.author_id = au.id
             WHERE r.company_id = $1 AND COALESCE(r.is_public, true) = true
             ${typeFilter}
             GROUP BY r.id, u.id, c.id
             ORDER BY ${orderBy}
                 LIMIT $2 OFFSET $3`,
            queryParams
        );

        res.json({
            reviews: result.rows,
            pagination: {
                page: validPage,
                limit: validLimit,
                total,
                pages: Math.ceil(total / validLimit)
            }
        });
    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
};

const updateReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { content, rating, isPublic } = req.body;


        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(reviewId)) {
            return res.status(400).json({ error: 'Invalid review ID format' });
        }


        const review = await query(
            'SELECT * FROM reviews WHERE id = $1',
            [reviewId]
        );

        if (review.rows.length === 0) {
            return res.status(404).json({ error: 'Review not found' });
        }

        const routeCompanyId = req.params.companyId || req.params.id;
        if (routeCompanyId && String(review.rows[0].company_id) !== String(routeCompanyId)) {
            return res.status(400).json({ error: 'Review does not belong to this business' });
        }

        if (review.rows[0].author_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }


        const now = new Date();
        const createdAt = new Date(review.rows[0].created_at);
        const hoursDiff = (now - createdAt) / (1000 * 60 * 60);

        if (hoursDiff > 24) {
            return res.status(400).json({ error: 'Review can only be edited within 24 hours' });
        }

        const updateFields = [];
        const values = [];
        let paramIndex = 1;

        if (content) {
            updateFields.push(`content = $${paramIndex}`);
            values.push(content);
            paramIndex++;
        }
        if (rating) {
            updateFields.push(`rating = $${paramIndex}`);
            values.push(rating);
            paramIndex++;
        }
        if (isPublic !== undefined) {
            updateFields.push(`is_public = $${paramIndex}`);
            values.push(isPublic);
            paramIndex++;
        }

        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

        const result = await query(
            `UPDATE reviews SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            [...values, reviewId]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update review error:', error);
        res.status(500).json({ error: 'Failed to update review' });
    }
};

const deleteReview = async (req, res) => {
    try {
        const { reviewId } = req.params;


        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(reviewId)) {
            return res.status(400).json({ error: 'Invalid review ID format' });
        }


        const review = await query(
            'SELECT * FROM reviews WHERE id = $1',
            [reviewId]
        );

        if (review.rows.length === 0) {
            return res.status(404).json({ error: 'Review not found' });
        }

        if (review.rows[0].author_id !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized' });
        }


        const now = new Date();
        const createdAt = new Date(review.rows[0].created_at);
        const hoursDiff = (now - createdAt) / (1000 * 60 * 60);

        if (hoursDiff > 24) {
            return res.status(400).json({ error: 'Review can only be deleted within 24 hours' });
        }

        await query('DELETE FROM reviews WHERE id = $1', [reviewId]);

        res.json({ message: 'Review deleted successfully' });
    } catch (error) {
        console.error('Delete review error:', error);
        res.status(500).json({ error: 'Failed to delete review' });
    }
};

const addReply = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { content } = req.body;


        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(reviewId)) {
            return res.status(400).json({ error: 'Invalid review ID format' });
        }


        const review = await query(
            'SELECT * FROM reviews WHERE id = $1',
            [reviewId]
        );

        if (review.rows.length === 0) {
            return res.status(404).json({ error: 'Review not found' });
        }


        if (req.user.role === 'business') {
            const companyOwner = await query(
                'SELECT * FROM company_owners WHERE company_id = $1 AND user_id = $2',
                [review.rows[0].company_id, req.user.id]
            );

            if (companyOwner.rows.length === 0) {
                return res.status(403).json({ error: 'Not authorized to reply to this review' });
            }
        }

        const result = await query(
            `INSERT INTO replies (review_id, author_id, author_role, content)
             VALUES ($1, $2, $3, $4)
                 RETURNING *`,
            [reviewId, req.user.id, req.user.role, content]
        );


        const author = await query(
            'SELECT id, display_name, role, avatar_url FROM users WHERE id = $1',
            [req.user.id]
        );

        res.status(201).json({
            ...result.rows[0],
            author: author.rows[0]
        });
    } catch (error) {
        console.error('Add reply error:', error);
        res.status(500).json({ error: 'Failed to add reply' });
    }
};


const getMyReviews = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const validPage = Math.max(1, parseInt(page) || 1);
        const validLimit = Math.min(50, Math.max(1, parseInt(limit) || 20));
        const offset = (validPage - 1) * validLimit;

        const { type } = req.query;
        const normalizedType = type ? normalizeReviewType(type) : null;
        const countParams = [req.user.id];
        let countSql = 'SELECT COUNT(*) FROM reviews WHERE author_id = $1';
        if (normalizedType) {
            countSql += ' AND review_type = $2';
            countParams.push(normalizedType);
        }
        const countResult = await query(countSql, countParams);
        const total = parseInt(countResult.rows[0]?.count || 0);

        const queryParams = [req.user.id, validLimit, offset];
        let typeFilter = '';
        if (normalizedType) {
            typeFilter = 'AND r.review_type = $4';
            queryParams.push(normalizedType);
        }

        const result = await query(
            `SELECT
                 r.*,
                 json_build_object(
                         'id', c.id,
                         'name', c.name,
                         'logo_url', c.logo_url
                 ) as company,
                json_build_object(
                        'id', u.id,
                        'displayName', u.display_name,
                        'isAnonymous', COALESCE(r.is_anonymous, u.is_anonymous),
                        'occupation', u.occupation,
                        'avatarUrl', u.avatar_url,
                        'workplace', CASE
                                         WHEN u.workplace_id IS NOT NULL THEN
                                             json_build_object(
                                                     'id', w.id,
                                                      'name', w.name,
                                                      'logo_url', w.logo_url
                                              )
                                          ELSE NULL
                             END
                 ) as author
             FROM reviews r
                      JOIN companies c ON r.company_id = c.id
                      JOIN users u ON r.author_id = u.id
                      LEFT JOIN companies w ON u.workplace_id = w.id
             WHERE r.author_id = $1
             ${typeFilter}
             ORDER BY r.created_at DESC
                 LIMIT $2 OFFSET $3`,
            queryParams
        );

        res.json({
            reviews: result.rows,
            pagination: {
                page: validPage,
                limit: validLimit,
                total,
                pages: Math.ceil(total / validLimit)
            }
        });
    } catch (error) {
        console.error('Get my reviews error:', error);
        res.status(500).json({ error: 'Failed to fetch your reviews' });
    }
};


const getReviewById = async (req, res) => {
    try {
        const { reviewId } = req.params;


        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(reviewId)) {
            return res.status(400).json({ error: 'Invalid review ID format' });
        }

        const result = await query(
            `SELECT
                 r.*,
                json_build_object(
                        'id', u.id,
                        'displayName', u.display_name,
                        'isAnonymous', COALESCE(r.is_anonymous, u.is_anonymous),
                        'occupation', r.author_occupation,
                        'avatarUrl', u.avatar_url,
                         'workplace', CASE
                                          WHEN r.author_workplace_id IS NOT NULL THEN
                                              json_build_object(
                                                      'id', c.id,
                                                      'name', c.name,
                                                      'logo_url', c.logo_url
                                              )
                                          ELSE NULL
                             END
                 ) as author,
                 json_build_object(
                         'id', comp.id,
                         'name', comp.name,
                         'logo_url', comp.logo_url
                 ) as company,
                 COALESCE(
                         json_agg(
                                 json_build_object(
                                         'id', rep.id,
                                         'content', rep.content,
                                         'authorRole', rep.author_role,
                                         'createdAt', rep.created_at,
                                         'author', json_build_object(
                                                 'id', au.id,
                                                 'displayName', au.display_name,
                                                 'role', au.role,
                                                 'avatarUrl', au.avatar_url
                                                   )
                                 )
                                     ORDER BY rep.created_at ASC
                         ) FILTER (WHERE rep.id IS NOT NULL), '[]'::json
                 ) as replies
             FROM reviews r
                      JOIN users u ON r.author_id = u.id
                      JOIN companies comp ON r.company_id = comp.id
                      LEFT JOIN companies c ON r.author_workplace_id = c.id
                      LEFT JOIN replies rep ON r.id = rep.review_id
                      LEFT JOIN users au ON rep.author_id = au.id
             WHERE r.id = $1
             GROUP BY r.id, u.id, comp.id, c.id`,
            [reviewId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Review not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get review error:', error);
        res.status(500).json({ error: 'Failed to fetch review' });
    }
};


const reportReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { reason } = req.body;


        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(reviewId)) {
            return res.status(400).json({ error: 'Invalid review ID format' });
        }


        await query(`
            CREATE TABLE IF NOT EXISTS review_reports (
                                                          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
                reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
                reason TEXT NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(review_id, reporter_id)
                )
        `);

        await query(
            `INSERT INTO review_reports (review_id, reporter_id, reason)
             VALUES ($1, $2, $3)
                 ON CONFLICT (review_id, reporter_id) DO NOTHING
             RETURNING id`,
            [reviewId, req.user.id, reason]
        );

        res.json({ message: 'Review reported successfully' });
    } catch (error) {
        console.error('Report review error:', error);
        res.status(500).json({ error: 'Failed to report review' });
    }
};


const getCompanyReviewStats = async (req, res) => {
    try {
        const { companyId } = req.params;


        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(companyId)) {
            return res.status(400).json({ error: 'Invalid company ID format' });
        }

        const result = await query(
            `SELECT
                 COUNT(*) as total_reviews,
                 COALESCE(AVG(rating), 0) as average_rating,
                 COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
                 COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
                 COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
                 COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
                 COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star,
                 COUNT(DISTINCT author_id) as unique_reviewers
             FROM reviews
             WHERE company_id = $1 AND is_public = true AND review_type = $2`,
            [companyId, REVIEW_TYPES.COMPANY]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get review stats error:', error);
        res.status(500).json({ error: 'Failed to fetch review statistics' });
    }
};

const getDailyReviewChecklist = async (req, res) => {
    try {
        const userId = req.user.id;
        const settings = await query(
            `SELECT u.workplace_id,
                    COALESCE(us.timezone, 'Africa/Johannesburg') as timezone
             FROM users u
             LEFT JOIN user_settings us ON us.user_id = u.id
             WHERE u.id = $1`,
            [userId]
        );
        const workplaceId = settings.rows[0]?.workplace_id || null;
        const timezone = settings.rows[0]?.timezone || 'Africa/Johannesburg';

        const dateResult = await query(
            `SELECT
                 (now() AT TIME ZONE $1)::date as today,
                 date_trunc('week', (now() AT TIME ZONE $1)::date)::date as week_start`,
            [timezone]
        );

        const today = dateResult.rows[0]?.today;
        const weekStart = dateResult.rows[0]?.week_start;

        if (!weekStart) {
            return res.json({ weekStart: null, days: [], workplaceId });
        }

        const reviewsResult = await query(
            `SELECT review_date
             FROM reviews
             WHERE author_id = $1
               AND review_type = $2
               AND review_date BETWEEN $3 AND ($3::date + INTERVAL '6 days')
               ${workplaceId ? 'AND company_id = $4' : ''}`,
            workplaceId
                ? [userId, REVIEW_TYPES.DAILY, weekStart, workplaceId]
                : [userId, REVIEW_TYPES.DAILY, weekStart]
        );

        const completedDates = new Set(reviewsResult.rows.map((row) => String(row.review_date)));
        const days = [];
        for (let i = 0; i < 7; i += 1) {
            const dayRes = await query(`SELECT ($1::date + $2::int) as day_date`, [weekStart, i]);
            const dayDate = dayRes.rows[0]?.day_date;
            days.push({
                date: dayDate,
                label: dayDate ? new Date(dayDate).toLocaleDateString('en-ZA', { weekday: 'short' }) : '',
                completed: dayDate ? completedDates.has(String(dayDate)) : false,
                isToday: today ? String(dayDate) === String(today) : false
            });
        }

        return res.json({
            weekStart,
            today,
            workplaceId,
            days
        });
    } catch (error) {
        console.error('Get daily review checklist error:', error);
        return res.status(500).json({ error: 'Failed to load daily review checklist' });
    }
};

module.exports = {
    createReview,
    getCompanyReviews,
    getMyReviews,
    getReviewById,
    updateReview,
    deleteReview,
    addReply,
    reportReview,
    getCompanyReviewStats,
    getDailyReviewChecklist
};
