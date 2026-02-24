// backend/src/controllers/companyController.js
const { query } = require('../utils/database');
const { sendClaimInvitation } = require('../utils/emailService');

const searchCompanies = async (req, res) => {
    try {
        const { q, page = 1, limit = 20, industry } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let whereClause = '';
        const params = [];
        let paramIndex = 1;

        if (q) {
            whereClause += ` WHERE (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR industry ILIKE $${paramIndex})`;
            params.push(`%${q}%`);
            paramIndex++;
        }

        if (industry) {
            whereClause += whereClause ? ` AND industry = $${paramIndex}` : ` WHERE industry = $${paramIndex}`;
            params.push(industry);
            paramIndex++;
        }

        // Get total count
        const countResult = await query(
            `SELECT COUNT(*) FROM companies${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0].count);

        // Get companies with review stats
        const result = await query(
            `SELECT 
        c.*,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(r.id) as review_count
       FROM companies c
       LEFT JOIN reviews r ON c.id = r.company_id AND r.is_public = true
       ${whereClause}
       GROUP BY c.id
       ORDER BY c.name
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, parseInt(limit), offset]
        );

        const companies = result.rows.map(company => ({
            ...company,
            avgRating: parseFloat(company.avg_rating).toFixed(1),
            reviewCount: parseInt(company.review_count)
        }));

        res.json({
            companies,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Search companies error:', error);
        res.status(500).json({ error: 'Failed to search companies' });
    }
};

const getCompany = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `SELECT 
        c.*,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(r.id) as review_count,
        json_agg(DISTINCT jsonb_build_object('id', u.id, 'displayName', u.display_name)) FILTER (WHERE u.id IS NOT NULL) as owners
       FROM companies c
       LEFT JOIN reviews r ON c.id = r.company_id AND r.is_public = true
       LEFT JOIN company_owners co ON c.id = co.company_id
       LEFT JOIN users u ON co.user_id = u.id
       WHERE c.id = $1
       GROUP BY c.id`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }

        const company = result.rows[0];
        res.json({
            ...company,
            avgRating: parseFloat(company.avg_rating).toFixed(1),
            reviewCount: parseInt(company.review_count),
            owners: company.owners || []
        });
    } catch (error) {
        console.error('Get company error:', error);
        res.status(500).json({ error: 'Failed to fetch company' });
    }
};

const createCompany = async (req, res) => {
    try {
        const { name, description, industry, website, email, phone, address } = req.body;

        // Check if company already exists
        const existing = await query(
            'SELECT id FROM companies WHERE name = $1',
            [name]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Company already exists' });
        }

        const result = await query(
            `INSERT INTO companies (name, description, industry, website, email, phone, address, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
            [name, description, industry, website, email, phone, address, req.user.id]
        );

        const company = result.rows[0];

        // Send email invitation if company email provided
        if (email) {
            await sendClaimInvitation(email, name, company.id);
        }

        res.status(201).json(company);
    } catch (error) {
        console.error('Create company error:', error);
        res.status(500).json({ error: 'Failed to create company' });
    }
};

const claimCompany = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if company exists and not claimed
        const company = await query(
            'SELECT * FROM companies WHERE id = $1',
            [id]
        );

        if (company.rows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }

        if (company.rows[0].is_claimed) {
            return res.status(400).json({ error: 'Company already claimed' });
        }

        // Update company and add owner
        await query('BEGIN');

        await query(
            'UPDATE companies SET is_claimed = true WHERE id = $1',
            [id]
        );

        await query(
            'INSERT INTO company_owners (company_id, user_id) VALUES ($1, $2)',
            [id, req.user.id]
        );

        await query('COMMIT');

        res.json({ message: 'Company claimed successfully' });
    } catch (error) {
        await query('ROLLBACK');
        console.error('Claim company error:', error);
        res.status(500).json({ error: 'Failed to claim company' });
    }
};

const getIndustries = async (req, res) => {
    try {
        const result = await query(
            'SELECT DISTINCT industry FROM companies WHERE industry IS NOT NULL ORDER BY industry'
        );
        res.json(result.rows.map(row => row.industry));
    } catch (error) {
        console.error('Get industries error:', error);
        res.status(500).json({ error: 'Failed to fetch industries' });
    }
};

// Get user's companies (for business users)
const getMyCompanies = async (req, res) => {
    try {
        const result = await query(
            `SELECT 
        c.*,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(r.id) as review_count
       FROM companies c
       LEFT JOIN company_owners co ON c.id = co.company_id
       LEFT JOIN reviews r ON c.id = r.company_id AND r.is_public = true
       WHERE co.user_id = $1
       GROUP BY c.id
       ORDER BY c.name`,
            [req.user.id]
        );

        const companies = result.rows.map(company => ({
            ...company,
            avg_rating: parseFloat(company.avg_rating).toFixed(1),
            review_count: parseInt(company.review_count)
        }));

        res.json(companies);
    } catch (error) {
        console.error('Get my companies error:', error);
        res.status(500).json({ error: 'Failed to fetch your companies' });
    }
};

// Update company details (for business owners)
const updateCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const { description, website, phone, address, logo_url } = req.body;

        // Check if user owns this company
        const ownership = await query(
            'SELECT * FROM company_owners WHERE company_id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (ownership.rows.length === 0) {
            return res.status(403).json({ error: 'Not authorized to update this company' });
        }

        const result = await query(
            `UPDATE companies 
       SET description = COALESCE($1, description),
           website = COALESCE($2, website),
           phone = COALESCE($3, phone),
           address = COALESCE($4, address),
           logo_url = COALESCE($5, logo_url),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
            [description, website, phone, address, logo_url, id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update company error:', error);
        res.status(500).json({ error: 'Failed to update company' });
    }
};

// Get company reviews for business dashboard
const getCompanyReviewsForBusiness = async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Check if user owns this company
        const ownership = await query(
            'SELECT * FROM company_owners WHERE company_id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (ownership.rows.length === 0) {
            return res.status(403).json({ error: 'Not authorized to view these reviews' });
        }

        // Get total count
        const countResult = await query(
            'SELECT COUNT(*) FROM reviews WHERE company_id = $1',
            [id]
        );
        const total = parseInt(countResult.rows[0].count);

        // Get reviews (including private ones for business)
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
              'createdAt', rep.created_at
            )
            ORDER BY rep.created_at ASC
          ) FILTER (WHERE rep.id IS NOT NULL), '[]'::json
        ) as replies
       FROM reviews r
       JOIN users u ON r.author_id = u.id
       LEFT JOIN replies rep ON r.id = rep.review_id
       WHERE r.company_id = $1
       GROUP BY r.id, u.id
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
            [id, parseInt(limit), offset]
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
        console.error('Get business reviews error:', error);
        res.status(500).json({ error: 'Failed to fetch company reviews' });
    }
};

// Get unclaimed companies (for discovery)
const getUnclaimedCompanies = async (req, res) => {
    try {
        const result = await query(
            `SELECT 
        c.*,
        COUNT(r.id) as review_count
       FROM companies c
       LEFT JOIN reviews r ON c.id = r.company_id
       WHERE c.is_claimed = false
       GROUP BY c.id
       ORDER BY review_count DESC
       LIMIT 50`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get unclaimed companies error:', error);
        res.status(500).json({ error: 'Failed to fetch unclaimed companies' });
    }
};

module.exports = {
    searchCompanies,
    getCompany,
    createCompany,
    claimCompany,
    getIndustries,
    getMyCompanies,
    updateCompany,
    getCompanyReviewsForBusiness,
    getUnclaimedCompanies
};