
const { query } = require('../utils/database');
const { moderateReview, analyzeSentiment } = require('../services/mlServices');
const { createAdminNotification } = require('../utils/adminNotifications');


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
        console.log('✅ Reviews table schema updated successfully');
    } catch (error) {
        console.error('Error updating reviews table:', error.message);
    }
};


updateReviewsTable();


const createReview = async (req, res) => {
    try {
        const { companyId, rating, content, isPublic = true } = req.body;


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


        const existingReview = await query(
            'SELECT id FROM reviews WHERE company_id = $1 AND author_id = $2',
            [companyId, req.user.id]
        );

        if (existingReview.rows.length > 0) {
            return res.status(400).json({ error: 'You have already reviewed this company' });
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

        const result = await query(
            `INSERT INTO reviews (
                company_id,
                author_id,
                rating,
                content,
                is_public,
                author_occupation,
                author_workplace_id,
                sentiment_label,
                sentiment_score,
                moderation_reason,
                moderation_status,
                is_flagged,
                flag_reason
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [
                companyId,
                req.user.id,
                rating,
                content,
                isPublic,
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

        const reviewPayload = {
            ...review,
            author: author.rows[0]
        };

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
        const { page = 1, limit = 20, sort = 'newest' } = req.query;


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


        const countResult = await query(
            'SELECT COUNT(*) FROM reviews WHERE company_id = $1 AND COALESCE(is_public, true) = true',
            [companyId]
        );
        const total = parseInt(countResult.rows[0]?.count || 0);


        const result = await query(
            `SELECT
                 r.*,
                 json_build_object(
                         'id', u.id,
                         'displayName', u.display_name,
                         'isAnonymous', u.is_anonymous,
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
             GROUP BY r.id, u.id, c.id
             ORDER BY ${orderBy}
                 LIMIT $2 OFFSET $3`,
            [companyId, validLimit, offset]
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

        const countResult = await query(
            'SELECT COUNT(*) FROM reviews WHERE author_id = $1',
            [req.user.id]
        );
        const total = parseInt(countResult.rows[0]?.count || 0);

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
             ORDER BY r.created_at DESC
                 LIMIT $2 OFFSET $3`,
            [req.user.id, validLimit, offset]
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
                         'isAnonymous', u.is_anonymous,
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
             WHERE company_id = $1 AND is_public = true`,
            [companyId]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get review stats error:', error);
        res.status(500).json({ error: 'Failed to fetch review statistics' });
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
    getCompanyReviewStats
};
