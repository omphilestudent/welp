
const { query } = require('../utils/database');
const { sendClaimInvitation } = require('../utils/emailService');
const { scrapeCompanyFromWebsite } = require('../services/companyScraperService');


const searchCompanies = async (req, res) => {
    try {
        const { q, page = 1, limit = 20, industry, unclaimed } = req.query;


        const validPage = Math.max(1, parseInt(page) || 1);
        const validLimit = Math.min(50, Math.max(1, parseInt(limit) || 20));
        const offset = (validPage - 1) * validLimit;

        let whereClause = '';
        const params = [];
        let paramIndex = 1;


        if (q && q.trim() !== '') {
            whereClause += ` WHERE (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR industry ILIKE $${paramIndex})`;
            params.push(`%${q.trim()}%`);
            paramIndex++;
        }

        if (industry && industry.trim() !== '') {
            whereClause += whereClause ? ` AND industry = $${paramIndex}` : ` WHERE industry = $${paramIndex}`;
            params.push(industry.trim());
            paramIndex++;
        }


        if (unclaimed === 'true') {
            if (whereClause) {
                whereClause += ` AND is_claimed = false`;
            } else {
                whereClause = ` WHERE is_claimed = false`;
            }
        }


        const countResult = await query(
            `SELECT COUNT(*) FROM companies${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0]?.count || 0);


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
            [...params, validLimit, offset]
        );

        const companies = result.rows.map(company => ({
            ...company,
            avg_rating: parseFloat(company.avg_rating || 0).toFixed(1),
            review_count: parseInt(company.review_count || 0)
        }));

        res.json({
            companies,
            pagination: {
                page: validPage,
                limit: validLimit,
                total,
                pages: Math.ceil(total / validLimit)
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


        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            return res.status(400).json({ error: 'Invalid company ID format' });
        }

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
            avg_rating: parseFloat(company.avg_rating || 0).toFixed(1),
            review_count: parseInt(company.review_count || 0),
            owners: company.owners?.filter(o => o.id !== null) || []
        });
    } catch (error) {
        console.error('Get company error:', error);
        res.status(500).json({ error: 'Failed to fetch company' });
    }
};


const createCompany = async (req, res) => {
    try {
        const { name, description, industry, website, email, phone, address } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Company name is required' });
        }

        const existing = await query(
            'SELECT id FROM companies WHERE name = $1',
            [name.trim()]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Company already exists' });
        }

        let scrapedLogoUrl = null;
        let scrapedDescription = null;
        if (website) {
            try {
                const scraped = await scrapeCompanyFromWebsite(website);
                scrapedLogoUrl = scraped?.logo_url || null;
                scrapedDescription = scraped?.description || null;
            } catch (scrapeError) {
                console.warn('Company scrape failed during create:', scrapeError.message);
            }
        }

        const result = await query(
            `INSERT INTO companies (name, description, industry, website, email, phone, address, logo_url, created_by_user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 RETURNING *`,
            [
                name.trim(),
                description || scrapedDescription,
                industry,
                website,
                email,
                phone,
                address,
                scrapedLogoUrl,
                req.user.id
            ]
        );

        const company = result.rows[0];

        if (email) {
            try {
                await sendClaimInvitation(email, name, company.id);
            } catch (emailError) {
                console.error('Failed to send claim invitation email:', emailError);
            }
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
            "SELECT DISTINCT industry FROM companies WHERE industry IS NOT NULL AND industry != '' ORDER BY industry"
        );
        res.json(result.rows.map(row => row.industry));
    } catch (error) {
        console.error('Get industries error:', error);
        res.status(500).json({ error: 'Failed to fetch industries' });
    }
};


const getMyCompanies = async (req, res) => {
    try {
        const result = await query(
            `SELECT
                 c.*,
                 COALESCE(AVG(r.rating), 0) as avg_rating,
                 COUNT(r.id) as review_count,
                 json_agg(DISTINCT jsonb_build_object('id', u.id, 'displayName', u.display_name)) FILTER (WHERE u.id IS NOT NULL) as owners
             FROM companies c
                      LEFT JOIN company_owners co ON c.id = co.company_id
                      LEFT JOIN users u ON co.user_id = u.id
                      LEFT JOIN reviews r ON c.id = r.company_id AND r.is_public = true
             WHERE co.user_id = $1
             GROUP BY c.id
             ORDER BY c.name`,
            [req.user.id]
        );

        const companies = result.rows.map(company => ({
            ...company,
            avg_rating: parseFloat(company.avg_rating || 0).toFixed(1),
            review_count: parseInt(company.review_count || 0),
            owners: company.owners?.filter(o => o.id !== null) || []
        }));

        res.json(companies);
    } catch (error) {
        console.error('Get my companies error:', error);
        res.status(500).json({ error: 'Failed to fetch your companies' });
    }
};


const updateCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const { description, website, phone, address, logo_url } = req.body;

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


const getCompanyReviewsForBusiness = async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const validPage = Math.max(1, parseInt(page) || 1);
        const validLimit = Math.min(50, Math.max(1, parseInt(limit) || 20));
        const offset = (validPage - 1) * validLimit;

        const ownership = await query(
            'SELECT * FROM company_owners WHERE company_id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (ownership.rows.length === 0) {
            return res.status(403).json({ error: 'Not authorized to view these reviews' });
        }

        const countResult = await query(
            'SELECT COUNT(*) FROM reviews WHERE company_id = $1',
            [id]
        );
        const total = parseInt(countResult.rows[0]?.count || 0);

        const result = await query(
            `SELECT
                 r.*,
                 json_build_object(
                         'id', u.id,
                         'displayName', u.display_name,
                         'isAnonymous', u.is_anonymous
                 ) as author
             FROM reviews r
                      JOIN users u ON r.author_id = u.id
             WHERE r.company_id = $1
             ORDER BY r.created_at DESC
                 LIMIT $2 OFFSET $3`,
            [id, validLimit, offset]
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
        console.error('Get business reviews error:', error);
        res.status(500).json({ error: 'Failed to fetch company reviews' });
    }
};


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


const requestClaimCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const { businessEmail, businessPhone, position, message } = req.body;


        if (!businessEmail || !businessEmail.includes('@')) {
            return res.status(400).json({ error: 'Valid business email is required' });
        }

        if (!businessPhone) {
            return res.status(400).json({ error: 'Business phone is required' });
        }

        if (!position) {
            return res.status(400).json({ error: 'Your position is required' });
        }

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


        await query(`
            CREATE TABLE IF NOT EXISTS claim_requests (
                                                          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                business_email VARCHAR(255) NOT NULL,
                business_phone VARCHAR(50),
                position VARCHAR(100),
                message TEXT,
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(company_id, user_id)
                )
        `);

        const existing = await query(
            'SELECT * FROM claim_requests WHERE company_id = $1 AND user_id = $2',
            [id, req.user.id]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Claim request already submitted' });
        }

        const result = await query(
            `INSERT INTO claim_requests (company_id, user_id, business_email, business_phone, position, message)
             VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
            [id, req.user.id, businessEmail, businessPhone, position, message]
        );

        res.status(201).json({
            message: 'Claim request submitted successfully. An admin will review your request.',
            request: result.rows[0]
        });
    } catch (error) {
        console.error('Request claim company error:', error);
        res.status(500).json({ error: 'Failed to submit claim request' });
    }
};


const getMyClaimRequests = async (req, res) => {
    try {
        const result = await query(
            `SELECT
                 cr.*,
                 json_build_object(
                         'id', c.id,
                         'name', c.name,
                         'logo_url', c.logo_url,
                         'industry', c.industry,
                         'is_claimed', c.is_claimed
                 ) as company
             FROM claim_requests cr
                      JOIN companies c ON cr.company_id = c.id
             WHERE cr.user_id = $1
             ORDER BY cr.created_at DESC`,
            [req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get my claim requests error:', error);
        res.status(500).json({ error: 'Failed to fetch claim requests' });
    }
};


const verifyBusinessEmail = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Valid email is required' });
        }


        await query(`
            CREATE TABLE IF NOT EXISTS email_verifications (
                                                               id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) NOT NULL,
                code VARCHAR(6) NOT NULL,
                user_id UUID REFERENCES users(id),
                expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '10 minutes',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
        `);


        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();


        await query('DELETE FROM email_verifications WHERE email = $1', [email]);


        await query(
            'INSERT INTO email_verifications (email, code, user_id) VALUES ($1, $2, $3)',
            [email, verificationCode, req.user.id]
        );


        console.log(`📧 Verification code for ${email}: ${verificationCode}`);




        res.json({ message: 'Verification code sent to your email' });
    } catch (error) {
        console.error('Verify business email error:', error);
        res.status(500).json({ error: 'Failed to send verification code' });
    }
};


const confirmEmailVerification = async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ error: 'Email and code are required' });
        }

        const result = await query(
            `SELECT * FROM email_verifications
             WHERE email = $1 AND code = $2 AND expires_at > CURRENT_TIMESTAMP
             ORDER BY created_at DESC LIMIT 1`,
            [email, code]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired verification code' });
        }


        await query('DELETE FROM email_verifications WHERE id = $1', [result.rows[0].id]);

        res.json({ message: 'Email verified successfully' });
    } catch (error) {
        console.error('Confirm email verification error:', error);
        res.status(500).json({ error: 'Failed to verify email' });
    }
};


const getPendingClaimRequests = async (req, res) => {
    try {

        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const result = await query(
            `SELECT
                cr.*,
                json_build_object(
                    'id', c.id,
                    'name', c.name,
                    'logo_url', c.logo_url,
                    'industry', c.industry
                ) as company,
                json_build_object(
                    'id', u.id,
                    'displayName', u.display_name,
                    'email', u.email
                ) as user
             FROM claim_requests cr
             JOIN companies c ON cr.company_id = c.id
             JOIN users u ON cr.user_id = u.id
             WHERE cr.status = 'pending'
             ORDER BY cr.created_at ASC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get pending claims error:', error);
        res.status(500).json({ error: 'Failed to fetch pending claims' });
    }
};


const approveClaimRequest = async (req, res) => {
    try {
        const { requestId } = req.params;


        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await query('BEGIN');


        const claimRequest = await query(
            'SELECT * FROM claim_requests WHERE id = $1',
            [requestId]
        );

        if (claimRequest.rows.length === 0) {
            await query('ROLLBACK');
            return res.status(404).json({ error: 'Claim request not found' });
        }


        await query(
            'UPDATE claim_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['approved', requestId]
        );


        await query(
            'UPDATE companies SET is_claimed = true WHERE id = $1',
            [claimRequest.rows[0].company_id]
        );


        await query(
            'INSERT INTO company_owners (company_id, user_id) VALUES ($1, $2)',
            [claimRequest.rows[0].company_id, claimRequest.rows[0].user_id]
        );

        await query('COMMIT');

        res.json({ message: 'Claim request approved successfully' });
    } catch (error) {
        await query('ROLLBACK');
        console.error('Approve claim error:', error);
        res.status(500).json({ error: 'Failed to approve claim request' });
    }
};


const rejectClaimRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { reason } = req.body;


        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await query(
            'UPDATE claim_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['rejected', requestId]
        );

        res.json({ message: 'Claim request rejected' });
    } catch (error) {
        console.error('Reject claim error:', error);
        res.status(500).json({ error: 'Failed to reject claim request' });
    }
};

const scrapeCompany = async (req, res) => {
    try {
        const { website } = req.body;

        if (!website) {
            return res.status(400).json({ error: 'Website URL is required' });
        }

        const scraped = await scrapeCompanyFromWebsite(website);

        const result = await query(
            `INSERT INTO companies (name, description, website, logo_url, created_by_user_id)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (name)
             DO UPDATE SET
                description = COALESCE(EXCLUDED.description, companies.description),
                website = COALESCE(EXCLUDED.website, companies.website),
                logo_url = COALESCE(EXCLUDED.logo_url, companies.logo_url),
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [scraped.name, scraped.description, scraped.website, scraped.logo_url, req.user.id]
        );

        return res.status(201).json({
            message: 'Company data scraped and stored successfully',
            company: result.rows[0],
            scraped
        });
    } catch (error) {
        console.error('Scrape company error:', error);
        return res.status(500).json({ error: error.message || 'Failed to scrape company data' });
    }
};

const scrapeMissingCompanyInfo = async (req, res) => {
    try {
        const { id } = req.params;

        const companyResult = await query('SELECT * FROM companies WHERE id = $1', [id]);
        if (companyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }

        const company = companyResult.rows[0];
        const website = company.website;
        if (!website) {
            return res.status(400).json({ error: 'Company website is required to scrape data' });
        }

        if (req.user.role === 'business') {
            const ownership = await query(
                'SELECT * FROM company_owners WHERE company_id = $1 AND user_id = $2',
                [id, req.user.id]
            );
            if (ownership.rows.length === 0) {
                return res.status(403).json({ error: 'Not authorized to update this company' });
            }
        }

        const scraped = await scrapeCompanyFromWebsite(website);

        const description = company.description && company.description.trim() !== '' ? company.description : scraped.description;
        const logoUrl = company.logo_url && company.logo_url.trim() !== '' ? company.logo_url : scraped.logo_url;
        const websiteFinal = company.website && company.website.trim() !== '' ? company.website : scraped.website;

        const result = await query(
            `UPDATE companies
             SET description = $1,
                 logo_url = $2,
                 website = $3,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4
             RETURNING *`,
            [description || company.description, logoUrl || company.logo_url, websiteFinal || company.website, id]
        );

        return res.json({
            message: 'Company information updated successfully',
            company: result.rows[0],
            scraped
        });
    } catch (error) {
        console.error('Scrape missing company info error:', error);
        return res.status(500).json({ error: error.message || 'Failed to update company information' });
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
    getUnclaimedCompanies,
    requestClaimCompany,
    getMyClaimRequests,
    verifyBusinessEmail,
    confirmEmailVerification,
    scrapeCompany,
    scrapeMissingCompanyInfo,
    getPendingClaimRequests,
    approveClaimRequest,
    rejectClaimRequest
};
