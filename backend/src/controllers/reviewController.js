// backend/src/controllers/reviewController.js
const { query } = require('../utils/database');

const createReview = async (req, res) => {
    try {
        const { companyId, rating, content, isPublic = true } = req.body;

        // Check if company exists
        const company = await query(
            'SELECT id FROM companies WHERE id = $1',
            [companyId]
        );

        if (company.rows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }

        // Check if user already reviewed this company
        const existingReview = await query(
            'SELECT id FROM reviews WHERE company_id = $1 AND author_id = $2',
            [companyId, req.user.id]
        );

        if (existingReview.rows.length > 0) {
            return res.status(400).json({ error: 'You have already reviewed this company' });
        }

        const result = await query(
            `INSERT INTO reviews (company_id, author_id, rating, content, is_public)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
            [companyId, req.user.id, rating, content, isPublic]
        );

        const review = result.rows[0];

        // Get author info
        const author = await query(
            'SELECT id, display_name, is_anonymous FROM users WHERE id = $1',
            [req.user.id]
        );

        res.status(201).json({
            ...review,
            author: author.rows[0]
        });
    } catch (error) {
        console.error('Create review error:', error);
        res.status(500).json({ error: 'Failed to create review' });
    }
};

const getCompanyReviews = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { page = 1, limit = 20, sort = 'newest' } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

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

        // Get total count
        const countResult = await query(
            'SELECT COUNT(*) FROM reviews WHERE company_id = $1 AND is_public = true',
            [companyId]
        );
        const total = parseInt(countResult.rows[0].count);

        // Get reviews with replies
        const result = await query(
            `SELECT 
        r.*,
        json_build_object(
          'id', u.id,
          'displayName', u.display_name,
          'isAnonymous', u.is_anonymous
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
                'role', au.role
              )
            )
            ORDER BY rep.created_at ASC
          ) FILTER (WHERE rep.id IS NOT NULL), '[]'::json
        ) as replies
       FROM reviews r
       JOIN users u ON r.author_id = u.id
       LEFT JOIN replies rep ON r.id = rep.review_id
       LEFT JOIN users au ON rep.author_id = au.id
       WHERE r.company_id = $1 AND r.is_public = true
       GROUP BY r.id, u.id
       ORDER BY ${orderBy}
       LIMIT $2 OFFSET $3`,
            [companyId, parseInt(limit), offset]
        );

        res.json({
            reviews: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
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

        // Check if review exists and belongs to user
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

        // Check 24-hour window
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

        // Check if review exists and belongs to user
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

        // Check 24-hour window
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

        // Check if review exists
        const review = await query(
            'SELECT * FROM reviews WHERE id = $1',
            [reviewId]
        );

        if (review.rows.length === 0) {
            return res.status(404).json({ error: 'Review not found' });
        }

        // Check if user can reply (business can only reply to their company's reviews)
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

        // Get author info
        const author = await query(
            'SELECT id, display_name, role FROM users WHERE id = $1',
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

// Get user's own reviews
const getMyReviews = async (req, res) => {
    try {
        const result = await query(
            `SELECT 
        r.*,
        json_build_object(
          'id', c.id,
          'name', c.name,
          'logo_url', c.logo_url
        ) as company
       FROM reviews r
       JOIN companies c ON r.company_id = c.id
       WHERE r.author_id = $1
       ORDER BY r.created_at DESC`,
            [req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get my reviews error:', error);
        res.status(500).json({ error: 'Failed to fetch your reviews' });
    }
};

// Get review by ID
const getReviewById = async (req, res) => {
    try {
        const { reviewId } = req.params;

        const result = await query(
            `SELECT 
        r.*,
        json_build_object(
          'id', u.id,
          'displayName', u.display_name,
          'isAnonymous', u.is_anonymous
        ) as author,
        json_build_object(
          'id', c.id,
          'name', c.name,
          'logo_url', c.logo_url
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
                'role', au.role
              )
            )
            ORDER BY rep.created_at ASC
          ) FILTER (WHERE rep.id IS NOT NULL), '[]'::json
        ) as replies
       FROM reviews r
       JOIN users u ON r.author_id = u.id
       JOIN companies c ON r.company_id = c.id
       LEFT JOIN replies rep ON r.id = rep.review_id
       LEFT JOIN users au ON rep.author_id = au.id
       WHERE r.id = $1
       GROUP BY r.id, u.id, c.id`,
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

// Report a review (for moderation)
const reportReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { reason } = req.body;

        // Create reports table if not exists
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

// Get company review statistics
const getCompanyReviewStats = async (req, res) => {
    try {
        const { companyId } = req.params;

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