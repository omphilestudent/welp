
const crypto = require('crypto');
const { query } = require('../utils/database');
const { sendClaimInvitation } = require('../utils/emailService');
const { scrapeCompanyFromWebsite } = require('../services/companyScraperService');
const { enrichCompanyWithOSM } = require('../services/companyEnrichmentService');
const { generateAutoReview } = require('../services/autoReviewService');
const { getBusinessPlanSnapshotByBusinessId, getBusinessDailyApiLimit } = require('../utils/businessPlan');
const { getUsageRecord } = require('../services/businessApiUsageService');

const ADMIN_ROLES = new Set(['admin', 'super_admin', 'superadmin', 'system_admin', 'hr_admin']);
const OWNER_ACCESS_ROLES = new Set(['business', ...ADMIN_ROLES]);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const columnExists = async (tableName, columnName) => {
    const result = await query(
        `SELECT 1
         FROM information_schema.columns
         WHERE table_name = $1 AND column_name = $2
         LIMIT 1`,
        [tableName, columnName]
    );
    return result.rows.length > 0;
};

const resolveCompanyIdParam = (params = {}) => params.id || params.companyId;

const formatCompanyRow = (company = {}) => ({
    ...company,
    avg_rating: parseFloat(company.avg_rating || 0).toFixed(1),
    review_count: parseInt(company.review_count || 0, 10),
    owners: company.owners?.filter((owner) => owner && owner.id) || []
});

const isAdminUser = (user) => {
    if (!user) return false;
    const normalizedRole = String(user.role || '').toLowerCase();
    return ADMIN_ROLES.has(normalizedRole);
};

const ensureCompanyOwnerMetadata = async () => {
    try {
        await query(`
            ALTER TABLE company_owners
                ADD COLUMN IF NOT EXISTS last_review_viewed_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS last_dashboard_visit_at TIMESTAMP
        `);
    } catch (error) {
        console.warn('Company owner metadata migration skipped:', error.message);
    }
};

ensureCompanyOwnerMetadata();

const syncCompanyClaimStatus = async () => {
    try {
        // Mark companies as claimed when an owner record already exists
        await query(`
            UPDATE companies c
            SET is_claimed = true,
                claimed_by = COALESCE(c.claimed_by, co.user_id)
            FROM company_owners co
            WHERE c.id = co.company_id
              AND c.is_claimed IS NOT TRUE
        `);

        // Auto-claim companies created by approved business accounts
        await query(`
            UPDATE companies c
            SET is_claimed = true,
                claimed_by = COALESCE(c.claimed_by, c.created_by_user_id)
            WHERE c.is_claimed IS NOT TRUE
              AND c.created_by_user_id IS NOT NULL
              AND EXISTS (
                  SELECT 1
                  FROM users u
                  WHERE u.id = c.created_by_user_id
                    AND LOWER(u.role) = 'business'
              )
        `);

        // Ensure owner records exist for claimed companies
        await query(`
            INSERT INTO company_owners (company_id, user_id)
            SELECT c.id, c.claimed_by
            FROM companies c
                     LEFT JOIN company_owners co
                               ON co.company_id = c.id AND co.user_id = c.claimed_by
            WHERE c.claimed_by IS NOT NULL
              AND co.user_id IS NULL
        `);
    } catch (error) {
        console.warn('Company claim status sync skipped:', error.message);
    }
};

syncCompanyClaimStatus();

const ensureReviewCompanyColumn = async () => {
    try {
        await query(`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS company_id UUID`);
    } catch (error) {
        console.warn('reviews.company_id ensure skipped:', error.message);
    }
    try {
        const hasBusinessId = await columnExists('reviews', 'business_id');
        if (!hasBusinessId) {
            console.warn('reviews company_id backfill skipped: reviews.business_id column does not exist');
            return;
        }
        await query(
            `UPDATE reviews
             SET company_id = COALESCE(company_id, business_id)
             WHERE company_id IS NULL AND business_id IS NOT NULL`
        );
    } catch (error) {
        console.warn('reviews company_id backfill skipped:', error.message);
    }
    try {
        await query(`CREATE INDEX IF NOT EXISTS idx_reviews_company_id ON reviews(company_id)`);
    } catch (error) {
        console.warn('reviews.company_id index skipped:', error.message);
    }
};

ensureReviewCompanyColumn();

const COMPANY_SELECT_SQL = `
    SELECT
        c.*,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(r.id) as review_count,
        json_agg(DISTINCT jsonb_build_object('id', u.id, 'displayName', u.display_name)) FILTER (WHERE u.id IS NOT NULL) as owners
    FROM companies c
    LEFT JOIN reviews r ON c.id = r.company_id AND r.is_public = true
    LEFT JOIN company_owners co ON c.id = co.company_id
    LEFT JOIN users u ON co.user_id = u.id
    WHERE c.id = $1
    GROUP BY c.id
`;

const fetchCompanyByIdStrict = async (companyId) => {
    const result = await query(COMPANY_SELECT_SQL, [companyId]);
    if (result.rows.length === 0) {
        const error = new Error('Company not found');
        error.statusCode = 404;
        throw error;
    }
    return formatCompanyRow(result.rows[0]);
};

const assertCompanyOwnership = async (companyId, user) => {
    if (!user) {
        const error = new Error('Authentication required');
        error.statusCode = 401;
        throw error;
    }

    if (isAdminUser(user)) {
        return null;
    }

    const ownership = await query(
        'SELECT * FROM company_owners WHERE company_id = $1 AND user_id = $2',
        [companyId, user.id]
    );

    if (ownership.rows.length === 0) {
        const error = new Error('Not authorized to manage this company');
        error.statusCode = 403;
        throw error;
    }

    return ownership.rows[0];
};

const fetchRecentPublicReviews = async (companyId, limit = 5) => {
    const result = await query(
        `SELECT
             r.*,
             json_build_object(
                 'id', u.id,
                 'displayName', u.display_name,
                 'isAnonymous', COALESCE(r.is_anonymous, u.is_anonymous),
                 'avatarUrl', u.avatar_url
             ) as author,
             COALESCE(replies_data.replies, '[]'::json) as replies
         FROM reviews r
                  JOIN users u ON r.author_id = u.id
                  LEFT JOIN LATERAL (
             SELECT json_agg(json_build_object(
                 'id', rp.id,
                 'content', rp.content,
                 'authorRole', rp.author_role,
                 'createdAt', rp.created_at,
                 'author', json_build_object(
                     'id', ru.id,
                     'displayName', ru.display_name,
                     'role', ru.role,
                     'avatarUrl', ru.avatar_url
                 )
             ) ORDER BY rp.created_at ASC) AS replies
             FROM replies rp
                      JOIN users ru ON rp.author_id = ru.id
             WHERE rp.review_id = r.id
         ) AS replies_data ON true
         WHERE r.company_id = $1
           AND r.is_public = true
         ORDER BY r.created_at DESC
         LIMIT $2`,
        [companyId, Math.max(1, limit)]
    );

    return result.rows.map((row) => ({
        ...row,
        replies: row.replies || []
    }));
};

const handleControllerError = (res, error, fallbackMessage = 'Unexpected server error') => {
    const status = error.statusCode || 500;
    if (status >= 500) {
        console.error(fallbackMessage, error);
    }
    return res.status(status).json({ error: error.message || fallbackMessage });
};


const pickValue = (current, ...fallbacks) => {
    const hasCurrent = typeof current === 'string' ? current.trim() !== '' : current !== null && current !== undefined;
    if (hasCurrent) return current;
    for (const value of fallbacks) {
        if (value === undefined || value === null) continue;
        if (typeof value === 'string' && value.trim() === '') continue;
        return value;
    }
    return null;
};

const scrapeAndUpdateCompany = async (company) => {
    const website = company?.website;
    if (!website) return null;

    const scraped = await scrapeCompanyFromWebsite(website);
    let enrichmentData = null;
    try {
        enrichmentData = await enrichCompanyWithOSM({
            name: company.name,
            city: company.city || scraped?.city,
            country: company.country || scraped?.country
        });
    } catch (error) {
        console.warn('Scrape missing info enrichment failed:', error?.message);
    }

    const enrichmentJson = enrichmentData ? JSON.stringify(enrichmentData) : null;
    const description = pickValue(company.description, scraped?.description);
    const logoUrl = pickValue(company.logo_url, scraped?.logo_url);
    const websiteFinal = pickValue(company.website, scraped?.website);
    const emailFinal = pickValue(company.email, scraped?.email, enrichmentData?.email);
    const phoneFinal = pickValue(company.phone, scraped?.phone, enrichmentData?.phone);
    const addressFinal = pickValue(company.address, scraped?.address, enrichmentData?.address);
    const cityFinal = pickValue(
        company.city,
        scraped?.city,
        enrichmentData?.raw?.address?.city,
        enrichmentData?.raw?.address?.town,
        enrichmentData?.raw?.address?.village
    );
    const countryFinal = pickValue(
        company.country,
        scraped?.country,
        enrichmentData?.raw?.address?.country
    );

    const result = await query(
        `UPDATE companies
         SET description = $1,
             logo_url = $2,
             website = $3,
             email = $4,
             phone = $5,
             address = $6,
             city = $7,
             country = $8,
             enrichment_data = COALESCE($9, enrichment_data),
             needs_enrichment = $10,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $11
         RETURNING *`,
        [
            description,
            logoUrl,
            websiteFinal,
            emailFinal,
            phoneFinal,
            addressFinal,
            cityFinal,
            countryFinal,
            enrichmentJson,
            false,
            company.id
        ]
    );

    return { company: result.rows[0], scraped };
};

const searchCompanies = async (req, res) => {
    try {
        const {
            q,
            search,
            page = 1,
            limit = 20,
            industry,
            unclaimed,
            claimed
        } = req.query;

        const validPage = Math.max(1, parseInt(page) || 1);
        const validLimit = Math.min(50, Math.max(1, parseInt(limit) || 20));
        const offset = (validPage - 1) * validLimit;

        const params = [];
        let paramIndex = 1;
        const conditions = ["c.status = 'active'"];

        const rawSearch = typeof q === 'string' && q.trim() !== '' ? q : search;
        const trimmedSearch = typeof rawSearch === 'string' ? rawSearch.trim() : '';

        if (trimmedSearch) {
            conditions.push('(c.name ILIKE $' + paramIndex + ' OR c.description ILIKE $' + paramIndex + ' OR c.industry ILIKE $' + paramIndex + ')');
            params.push('%' + trimmedSearch + '%');
            paramIndex++;
        }

        if (industry && industry.trim() !== '') {
            conditions.push('c.industry = $' + paramIndex);
            params.push(industry.trim());
            paramIndex++;
        }

        if (unclaimed === 'true') {
            conditions.push('c.is_claimed = false');
        } else if (claimed === 'true') {
            conditions.push('c.is_claimed = true');
        }

        const whereClause = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';

        const countResult = await query(
            'SELECT COUNT(*) FROM companies c' + whereClause,
            params
        );
        const total = parseInt(countResult.rows[0]?.count || 0);

        const resultSql = 'SELECT c.*, '
            + 'COALESCE(AVG(r.rating), 0) as avg_rating, '
            + 'COUNT(r.id) as review_count '
            + 'FROM companies c '
            + 'LEFT JOIN reviews r ON c.id = r.company_id AND r.is_public = true '
            + whereClause
            + ' GROUP BY c.id '
            + 'ORDER BY c.name '
            + 'LIMIT $' + paramIndex + ' OFFSET $' + (paramIndex + 1);

        const result = await query(resultSql, [...params, validLimit, offset]);

        const shouldAutoScrape = true;
        if (shouldAutoScrape) {
            const candidates = result.rows
                .filter(company => company.website && company.needs_enrichment)
                .slice(0, 6);
            candidates.forEach(company => {
                scrapeAndUpdateCompany(company).catch(error => {
                    console.warn('Auto scrape failed for search:', company.id, error?.message);
                });
            });
        }

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
        const companyId = resolveCompanyIdParam(req.params);
        if (!companyId || !UUID_REGEX.test(companyId)) {
            return res.status(400).json({ error: 'Invalid company ID format' });
        }

        const company = await fetchCompanyByIdStrict(companyId);
        return res.json(company);
    } catch (error) {
        return handleControllerError(res, error, 'Failed to fetch company');
    }
};

const getCompanyClaimStatus = async (req, res) => {
    try {
        const companyId = resolveCompanyIdParam(req.params);
        if (!companyId || !UUID_REGEX.test(companyId)) {
            return res.status(400).json({ error: 'Invalid company ID format' });
        }

        const result = await query(
            `SELECT id, is_claimed, is_verified, claimed_by, verified_by, verified_at
             FROM companies WHERE id = $1`,
            [companyId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }

        const row = result.rows[0];
        return res.json({
            id: row.id,
            is_claimed: row.is_claimed,
            is_verified: row.is_verified,
            claimed_by: row.claimed_by,
            verified_by: row.verified_by,
            verified_at: row.verified_at
        });
    } catch (error) {
        return handleControllerError(res, error, 'Failed to fetch claim status');
    }
};
const getBusinessProfile = async (req, res) => {
    try {
        const companyId = resolveCompanyIdParam(req.params);
        if (!companyId || !UUID_REGEX.test(companyId)) {
            return res.status(400).json({ error: 'Invalid company ID format' });
        }

        const reviewLimit = Math.min(10, Math.max(1, parseInt(req.query.reviewLimit, 10) || 5));
        const [company, recentReviews] = await Promise.all([
            fetchCompanyByIdStrict(companyId),
            fetchRecentPublicReviews(companyId, reviewLimit)
        ]);

        return res.json({
            ...company,
            recentReviews
        });
    } catch (error) {
        return handleControllerError(res, error, 'Failed to load business profile');
    }
};


const createCompany = async (req, res) => {
    try {
        const { name, description, industry, website, email, phone, address, city, country, registrationNumber, registration_number } = req.body;

        const cleanedName = name?.trim();
        const cleanedCountry = country?.trim();

        if (!cleanedName) {
            return res.status(400).json({ error: 'Company name is required' });
        }

        if (!cleanedCountry) {
            return res.status(400).json({ error: 'Country is required' });
        }

        const cleanedDescription = description?.trim();
        const cleanedIndustry = industry?.trim() || null;
        const cleanedWebsite = website?.trim() || null;
        const cleanedEmail = email?.trim() || null;
        const cleanedPhone = phone?.trim() || null;
        const cleanedAddress = address?.trim() || null;
        const cleanedCity = city?.trim() || null;
        const cleanedRegistration = (registrationNumber || registration_number || '')?.trim() || null;

        const existing = await query(
            'SELECT id FROM companies WHERE name = $1',
            [cleanedName]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Company already exists' });
        }

        let enrichmentData = null;
        try {
            enrichmentData = await enrichCompanyWithOSM({
                name: cleanedName,
                country: cleanedCountry,
                city: cleanedCity
            });
        } catch (enrichError) {
            console.warn('Company enrichment failed:', enrichError?.message);
        }

        let scrapedLogoUrl = null;
        let scrapedDescription = null;
        let scrapedEmail = null;
        let scrapedPhone = null;
        let scrapedAddress = null;
        let scrapedCity = null;
        let scrapedCountry = null;
        if (cleanedWebsite) {
            try {
                const scraped = await scrapeCompanyFromWebsite(cleanedWebsite);
                scrapedLogoUrl = scraped?.logo_url || null;
                scrapedDescription = scraped?.description || null;
                scrapedEmail = scraped?.email || null;
                scrapedPhone = scraped?.phone || null;
                scrapedAddress = scraped?.address || null;
                scrapedCity = scraped?.city || null;
                scrapedCountry = scraped?.country || null;
            } catch (scrapeError) {
                console.warn('Company scrape failed during create:', scrapeError.message);
            }
        }

        const finalWebsite = cleanedWebsite || enrichmentData?.website || null;
        const finalAddress = cleanedAddress || scrapedAddress || enrichmentData?.address || null;
        const finalPhone = cleanedPhone || scrapedPhone || enrichmentData?.phone || null;
        const finalEmail = cleanedEmail || scrapedEmail || enrichmentData?.email || null;
        const derivedCity = scrapedCity
            || enrichmentData?.raw?.address?.city
            || enrichmentData?.raw?.address?.town
            || enrichmentData?.raw?.address?.village
            || null;
        const finalCity = cleanedCity || derivedCity;
        const finalDescription = cleanedDescription || scrapedDescription || null;
        const finalStatus = 'pending';
        const needsEnrichment = true;
        const enrichmentJson = enrichmentData ? JSON.stringify(enrichmentData) : null;
        const isBusinessCreator = String(req.user?.role || '').toLowerCase() === 'business';

        const insertColumns = [
            'name',
            'description',
            'industry',
            'website',
            'email',
            'phone',
            'address',
            'city',
            'country',
            'registration_number',
            'logo_url',
            'status',
            'needs_enrichment',
            'enrichment_data',
            'created_by_user_id'
        ];
        const insertValues = [
            cleanedName,
            finalDescription,
            cleanedIndustry,
            finalWebsite,
            finalEmail,
            finalPhone,
            finalAddress,
            finalCity,
            cleanedCountry,
            cleanedRegistration,
            scrapedLogoUrl,
            finalStatus,
            needsEnrichment,
            enrichmentJson,
            req.user.id
        ];

        if (isBusinessCreator) {
            insertColumns.push('is_claimed', 'claimed_by');
            insertValues.push(true, req.user.id);
        }

        const placeholders = insertColumns.map((_, idx) => `$${idx + 1}`);

        const result = await query(
            `INSERT INTO companies (${insertColumns.join(', ')})
             VALUES (${placeholders.join(', ')})
             RETURNING *`,
            insertValues
        );

        const company = result.rows[0];

        if (isBusinessCreator) {
            try {
                await query(
                    `INSERT INTO company_owners (company_id, user_id)
                     VALUES ($1, $2)
                     ON CONFLICT (company_id, user_id) DO NOTHING`,
                    [company.id, req.user.id]
                );
            } catch (ownerError) {
                console.warn('Auto-claim owner sync failed:', ownerError.message);
            }
        }

        try {
            await generateAutoReview({
                companyId: company.id,
                userId: req.user.id,
                companyName: cleanedName,
                description: finalDescription
            });
        } catch (autoReviewError) {
            console.warn('Auto review generation failed:', autoReviewError.message);
        }

        if (finalEmail) {
            try {
                await sendClaimInvitation(finalEmail, cleanedName, company.id);
            } catch (emailError) {
                console.error('Failed to send claim invitation email:', emailError);
            }
        }

        const responseMessage = isBusinessCreator
            ? 'Company created and linked to your business profile.'
            : 'Company submitted for review. Admins will verify it shortly.';

        res.status(201).json({
            message: responseMessage,
            company
        });
    } catch (error) {
        console.error('Create company error:', error);
        res.status(500).json({ error: 'Failed to create company' });
    }
};


const claimCompany = async (req, res) => {
    let transactionStarted = false;
    try {
        const companyId = resolveCompanyIdParam(req.params);
        if (!companyId || !UUID_REGEX.test(companyId)) {
            return res.status(400).json({ error: 'Invalid company ID format' });
        }

        const company = await query(
            'SELECT * FROM companies WHERE id = $1',
            [companyId]
        );

        if (company.rows.length === 0) {
            return res.status(404).json({ error: 'Company not found' });
        }

        if (company.rows[0].is_claimed) {
            return res.status(400).json({ error: 'Company already claimed' });
        }

        await query('BEGIN');
        transactionStarted = true;

        await query(
            'UPDATE companies SET is_claimed = true, claimed_by = $1 WHERE id = $2',
            [req.user.id, companyId]
        );

        await query(
            `INSERT INTO company_owners (company_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (company_id, user_id) DO NOTHING`,
            [companyId, req.user.id]
        );

        await query(
            `INSERT INTO business_email_preferences (business_id, allow_unregistered_review_emails, stop_after_registration)
             VALUES ($1, false, true)
             ON CONFLICT (business_id) DO UPDATE
                SET allow_unregistered_review_emails = false,
                    stop_after_registration = true,
                    updated_at = CURRENT_TIMESTAMP`,
            [companyId]
        );

        await query('COMMIT');
        transactionStarted = false;
        const updatedCompany = await fetchCompanyByIdStrict(companyId);

        res.json({
            message: 'Company claimed successfully',
            company: updatedCompany
        });
    } catch (error) {
        if (transactionStarted) {
            try {
                await query('ROLLBACK');
            } catch (rollbackError) {
                console.error('Claim company rollback failed:', rollbackError.message);
            }
        }
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
        // Ensure claimed/created companies are linked to the owner
        await query(
            `INSERT INTO company_owners (company_id, user_id)
             SELECT c.id, $1
             FROM companies c
                      LEFT JOIN company_owners co
                                ON co.company_id = c.id AND co.user_id = $1
             WHERE co.user_id IS NULL
               AND (c.claimed_by = $1 OR c.created_by_user_id = $1)`,
            [req.user.id]
        );

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
        const companyId = resolveCompanyIdParam(req.params);
        if (!companyId || !UUID_REGEX.test(companyId)) {
            return res.status(400).json({ error: 'Invalid company ID format' });
        }

        await assertCompanyOwnership(companyId, req.user);

        const fieldOrder = [
            ['name', 'name'],
            ['industry', 'industry'],
            ['description', 'description'],
            ['website', 'website'],
            ['phone', 'phone'],
            ['email', 'email'],
            ['location', 'address'],
            ['address', 'address'],
            ['city', 'city'],
            ['country', 'country'],
            ['registration_number', 'registration_number'],
            ['registrationNumber', 'registration_number'],
            ['logo_url', 'logo_url'],
            ['logoUrl', 'logo_url']
        ];

        const normalize = (value, field) => {
            if (value === null || value === undefined) return null;
            if (typeof value === 'string') {
                const trimmed = value.trim();
                if (trimmed === '') return null;
                if (field === 'website' && !/^https?:\/\//i.test(trimmed)) {
                    return `https://${trimmed}`;
                }
                return trimmed;
            }
            return value;
        };

        const payload = {};
        fieldOrder.forEach(([key, column]) => {
            if (Object.prototype.hasOwnProperty.call(req.body, key)) {
                const normalized = normalize(req.body[key], column);
                if (normalized !== undefined) {
                    payload[column] = normalized;
                }
            }
        });

        if (Object.keys(payload).length === 0) {
            return res.status(400).json({ error: 'No updates were provided' });
        }

        const setClauses = [];
        const values = [];
        let paramIndex = 1;
        for (const [column, value] of Object.entries(payload)) {
            setClauses.push(`${column} = $${paramIndex}`);
            values.push(value);
            paramIndex += 1;
        }
        setClauses.push('updated_at = CURRENT_TIMESTAMP');
        values.push(companyId);

        await query(
            `UPDATE companies
             SET ${setClauses.join(', ')}
             WHERE id = $${paramIndex}`,
            values
        );

        const updatedCompany = await fetchCompanyByIdStrict(companyId);
        return res.json(updatedCompany);
    } catch (error) {
        return handleControllerError(res, error, 'Failed to update company');
    }
};


const getCompanyReviewsForBusiness = async (req, res) => {
    try {
        const companyId = resolveCompanyIdParam(req.params);
        if (!companyId || !UUID_REGEX.test(companyId)) {
            return res.status(400).json({ error: 'Invalid company ID format' });
        }
        const { page = 1, limit = 20, rating, type, sort } = req.query;

        const validPage = Math.max(1, parseInt(page) || 1);
        const validLimit = Math.min(50, Math.max(1, parseInt(limit) || 20));
        const offset = (validPage - 1) * validLimit;

        const ownership = await assertCompanyOwnership(companyId, req.user);
        const lastViewedAt = ownership?.last_review_viewed_at ? new Date(ownership.last_review_viewed_at) : null;

        const conditions = ['r.company_id = $1'];
        const params = [companyId];
        let paramIndex = 2;

        if (rating) {
            conditions.push(`r.rating = $${paramIndex}`);
            params.push(parseInt(rating, 10));
            paramIndex += 1;
        }

        if (type === 'anonymous') {
            conditions.push('COALESCE(r.is_anonymous, u.is_anonymous, false) = true');
        } else if (type === 'employee') {
            conditions.push('COALESCE(r.is_anonymous, u.is_anonymous, false) = false');
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const orderMap = {
            newest: 'r.created_at DESC',
            oldest: 'r.created_at ASC',
            highest: 'r.rating DESC, r.created_at DESC',
            lowest: 'r.rating ASC, r.created_at DESC'
        };
        const orderBy = orderMap[sort] || orderMap.newest;

        const countResult = await query(
            `SELECT COUNT(*)
             FROM reviews r
                      JOIN users u ON r.author_id = u.id
             ${whereClause}`,
            params
        );
        const total = parseInt(countResult.rows[0]?.count || 0);

        const result = await query(
            `SELECT
                 r.*,
                 json_build_object(
                         'id', u.id,
                         'displayName', u.display_name,
                         'isAnonymous', COALESCE(r.is_anonymous, u.is_anonymous),
                         'avatarUrl', u.avatar_url,
                         'role', u.role
                 ) as author,
                 COALESCE(replies_data.replies, '[]'::json) as replies
             FROM reviews r
                      JOIN users u ON r.author_id = u.id
                      LEFT JOIN LATERAL (
                 SELECT json_agg(json_build_object(
                     'id', rp.id,
                     'content', rp.content,
                     'authorRole', rp.author_role,
                     'createdAt', rp.created_at,
                     'author', json_build_object(
                         'id', ru.id,
                         'displayName', ru.display_name,
                         'role', ru.role,
                         'avatarUrl', ru.avatar_url
                     )
                 ) ORDER BY rp.created_at ASC) AS replies
                 FROM replies rp
                          JOIN users ru ON rp.author_id = ru.id
                 WHERE rp.review_id = r.id
             ) AS replies_data ON true
             ${whereClause}
             ORDER BY ${orderBy}
                 LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
            [...params, validLimit, offset]
        );

        const reviews = result.rows.map((review) => ({
            ...review,
            replies: review.replies || [],
            author: review.author,
            isNew: !lastViewedAt || new Date(review.created_at) > lastViewedAt
        }));

        if (ownership) {
            try {
                await query(
                    'UPDATE company_owners SET last_review_viewed_at = CURRENT_TIMESTAMP WHERE company_id = $1 AND user_id = $2',
                    [companyId, req.user.id]
                );
            } catch (updateError) {
                console.warn('company_owners metadata update skipped:', updateError.message);
            }
        }

        res.json({
            reviews,
            pagination: {
                page: validPage,
                limit: validLimit,
                total,
                pages: Math.ceil(total / validLimit)
            },
            lastViewedAt
        });
    } catch (error) {
        return handleControllerError(res, error, 'Failed to fetch company reviews');
    }
};

const getCompanyAnalytics = async (req, res) => {
    try {
        const companyId = resolveCompanyIdParam(req.params);
        if (!companyId || !UUID_REGEX.test(companyId)) {
            return res.status(400).json({ error: 'Invalid company ID format' });
        }

        await assertCompanyOwnership(companyId, req.user);

        const metricsResult = await query(
            `SELECT
                 ROUND(COALESCE(AVG(r.rating), 0)::numeric, 2) as avg_rating,
                 COUNT(r.id) as total_reviews,
                 COUNT(CASE WHEN COALESCE(r.is_anonymous, u.is_anonymous, false) THEN 1 END) as anonymous_reviews,
                 COUNT(CASE WHEN NOT COALESCE(r.is_anonymous, u.is_anonymous, false) THEN 1 END) as employee_reviews
             FROM reviews r
                      LEFT JOIN users u ON r.author_id = u.id
             WHERE r.company_id = $1`,
            [companyId]
        );

        const distributionResult = await query(
            `SELECT rating, COUNT(*) as count
             FROM reviews
             WHERE company_id = $1
             GROUP BY rating`,
            [companyId]
        );

        const trendResult = await query(
            `SELECT
                 DATE_TRUNC('month', created_at) as bucket,
                 COUNT(*) as count
             FROM reviews
             WHERE company_id = $1
               AND created_at >= NOW() - INTERVAL '12 months'
             GROUP BY bucket
             ORDER BY bucket`,
            [companyId]
        );

        const responseResult = await query(
            `SELECT COUNT(DISTINCT r.id) as responded
             FROM reviews r
                      JOIN replies rp ON rp.review_id = r.id
             WHERE r.company_id = $1
               AND rp.author_role = 'business'`,
            [companyId]
        );

        const metrics = metricsResult.rows[0] || {};
        const totalReviews = Number(metrics.total_reviews || 0);

        const ratingDistribution = {
            5: 0,
            4: 0,
            3: 0,
            2: 0,
            1: 0
        };
        distributionResult.rows.forEach((row) => {
            const rating = Number(row.rating);
            if (ratingDistribution[rating] !== undefined) {
                ratingDistribution[rating] = Number(row.count || 0);
            }
        });

        const trend = trendResult.rows.map((row) => ({
            bucket: row.bucket,
            count: Number(row.count || 0)
        }));

        const responded = Number(responseResult.rows[0]?.responded || 0);

        return res.json({
            averageRating: Number(metrics.avg_rating || 0).toFixed(2),
            totalReviews,
            ratingDistribution,
            employeeVsAnonymous: {
                employee: Number(metrics.employee_reviews || 0),
                anonymous: Number(metrics.anonymous_reviews || 0)
            },
            responseRate: totalReviews === 0 ? 0 : Number((responded / totalReviews).toFixed(2)),
            trendGranularity: 'month',
            trend,
            lastUpdated: new Date().toISOString()
        });
    } catch (error) {
        return handleControllerError(res, error, 'Failed to fetch company analytics');
    }
};

/* â”€â”€ Business API keys â”€â”€ */
const generateApiKey = () => {
    const raw = crypto.randomBytes(32).toString('hex');
    const keyPrefix = raw.slice(0, 8);
    const keyHash = crypto.createHash('sha256').update(raw).digest('hex');
    return { raw, keyPrefix, keyHash };
};

const getCompanyApiKeys = async (req, res) => {
    try {
        const companyId = resolveCompanyIdParam(req.params);
        if (!companyId || !UUID_REGEX.test(companyId)) {
            return res.status(400).json({ error: 'Invalid company ID format' });
        }

        await assertCompanyOwnership(companyId, req.user);

        const result = await query(
            `SELECT id, company_id, name, key_prefix, last_used_at, revoked_at, created_at
             FROM business_api_keys
             WHERE company_id = $1
             ORDER BY created_at DESC`,
            [companyId]
        );

        res.json({ keys: result.rows });
    } catch (error) {
        return handleControllerError(res, error, 'Failed to fetch API keys');
    }
};

const getCompanyApiUsage = async (req, res) => {
    try {
        const companyId = resolveCompanyIdParam(req.params);
        if (!companyId || !UUID_REGEX.test(companyId)) {
            return res.status(400).json({ error: 'Invalid company ID format' });
        }

        await assertCompanyOwnership(companyId, req.user);

        const planSnapshot = await getBusinessPlanSnapshotByBusinessId(companyId);
        const dailyLimit = getBusinessDailyApiLimit(planSnapshot);
        const usage = await getUsageRecord(companyId, new Date());
        const usedToday = Number(usage?.request_count || 0);
        const remainingToday = Number.isFinite(dailyLimit) ? Math.max(dailyLimit - usedToday, 0) : null;

        res.json({
            plan: planSnapshot?.planCode || 'business_free_tier',
            dailyLimit,
            usedToday,
            remainingToday,
            usageDate: new Date().toISOString().slice(0, 10),
            resetsAt: new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
        });
    } catch (error) {
        return handleControllerError(res, error, 'Failed to fetch API usage');
    }
};

const createCompanyApiKey = async (req, res) => {
    try {
        const companyId = resolveCompanyIdParam(req.params);
        if (!companyId || !UUID_REGEX.test(companyId)) {
            return res.status(400).json({ error: 'Invalid company ID format' });
        }

        await assertCompanyOwnership(companyId, req.user);

        const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
        if (name.length > 100) {
            return res.status(400).json({ error: 'API key name is too long' });
        }
        const { raw, keyPrefix, keyHash } = generateApiKey();

        const result = await query(
            `INSERT INTO business_api_keys (company_id, created_by, name, key_prefix, key_hash)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, company_id, name, key_prefix, last_used_at, revoked_at, created_at`,
            [companyId, req.user.id, name || null, keyPrefix, keyHash]
        );

        res.status(201).json({
            apiKey: result.rows[0],
            key: raw
        });
    } catch (error) {
        return handleControllerError(res, error, 'Failed to create API key');
    }
};

const revokeCompanyApiKey = async (req, res) => {
    try {
        const companyId = resolveCompanyIdParam(req.params);
        const { keyId } = req.params;
        if (!companyId || !UUID_REGEX.test(companyId) || !UUID_REGEX.test(keyId)) {
            return res.status(400).json({ error: 'Invalid company ID format' });
        }

        await assertCompanyOwnership(companyId, req.user);

        const result = await query(
            `UPDATE business_api_keys
             SET revoked_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND company_id = $2
             RETURNING id, company_id, name, key_prefix, last_used_at, revoked_at, created_at`,
            [keyId, companyId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'API key not found' });
        }

        res.json({ apiKey: result.rows[0] });
    } catch (error) {
        return handleControllerError(res, error, 'Failed to revoke API key');
    }
};

const uploadCompanyLogo = async (req, res) => {
    try {
        const companyId = resolveCompanyIdParam(req.params);
        if (!companyId || !UUID_REGEX.test(companyId)) {
            return res.status(400).json({ error: 'Invalid company ID format' });
        }

        await assertCompanyOwnership(companyId, req.user);

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const logoUrl = `/uploads/company-logos/${req.file.filename}`;
        await query(
            `UPDATE companies
             SET logo_url = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [logoUrl, companyId]
        );

        const updatedCompany = await fetchCompanyByIdStrict(companyId);
        res.json({ message: 'Logo updated successfully', logoUrl, company: updatedCompany });
    } catch (error) {
        return handleControllerError(res, error, 'Failed to upload logo');
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
        const normalizedRole = String(req.user?.role || '').toLowerCase().trim();
        if (!ADMIN_ROLES.has(normalizedRole)) {
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

        const normalizedRole = String(req.user?.role || '').toLowerCase().trim();
        if (!ADMIN_ROLES.has(normalizedRole)) {
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
            `UPDATE companies
             SET is_claimed = true,
                 claimed_by = $1,
                 is_verified = true,
                 verified_by = $2,
                 verified_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [claimRequest.rows[0].user_id, req.user.id, claimRequest.rows[0].company_id]
        );


        await query(
            `INSERT INTO company_owners (company_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (company_id, user_id) DO NOTHING`,
            [claimRequest.rows[0].company_id, claimRequest.rows[0].user_id]
        );

        await query(
            `INSERT INTO business_email_preferences (business_id, allow_unregistered_review_emails, stop_after_registration)
             VALUES ($1, false, true)
             ON CONFLICT (business_id) DO UPDATE
                SET allow_unregistered_review_emails = false,
                    stop_after_registration = true,
                    updated_at = CURRENT_TIMESTAMP`,
            [claimRequest.rows[0].company_id]
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

        const normalizedRole = String(req.user?.role || '').toLowerCase().trim();
        if (!ADMIN_ROLES.has(normalizedRole)) {
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

const unclaimCompany = async (req, res) => {
    try {
        const companyId = resolveCompanyIdParam(req.params);
        if (!companyId || !UUID_REGEX.test(companyId)) {
            return res.status(400).json({ error: 'Invalid company ID format' });
        }

        const normalizedRole = String(req.user?.role || '').toLowerCase().trim();
        if (!ADMIN_ROLES.has(normalizedRole)) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        await query('BEGIN');

        await query(
            `UPDATE companies
             SET is_claimed = false,
                 is_verified = false,
                 claimed_by = NULL,
                 verified_by = NULL,
                 verified_at = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [companyId]
        );

        await query('DELETE FROM company_owners WHERE company_id = $1', [companyId]);

        await query('COMMIT');

        const updated = await fetchCompanyByIdStrict(companyId);
        return res.json({ message: 'Company unclaimed', company: updated });
    } catch (error) {
        try { await query('ROLLBACK'); } catch {}
        return handleControllerError(res, error, 'Failed to unclaim company');
    }
};
const scrapeCompany = async (req, res) => {
    try {
        const { website } = req.body;

        if (!website) {
            return res.status(400).json({ error: 'Website URL is required' });
        }

        const scraped = await scrapeCompanyFromWebsite(website);
        let enrichmentData = null;
        try {
            enrichmentData = await enrichCompanyWithOSM({
                name: scraped?.name,
                city: scraped?.city,
                country: scraped?.country
            });
        } catch (error) {
            console.warn('Scrape company enrichment failed:', error?.message);
        }

        const enrichmentJson = enrichmentData ? JSON.stringify(enrichmentData) : null;
        const finalAddress = scraped?.address || enrichmentData?.address || null;
        const finalCity = scraped?.city
            || enrichmentData?.raw?.address?.city
            || enrichmentData?.raw?.address?.town
            || enrichmentData?.raw?.address?.village
            || null;
        const finalCountry = scraped?.country
            || enrichmentData?.raw?.address?.country
            || null;
        const finalPhone = scraped?.phone || enrichmentData?.phone || null;
        const finalEmail = scraped?.email || enrichmentData?.email || null;

        const result = await query(
            `INSERT INTO companies (name, description, website, logo_url, email, phone, address, city, country, enrichment_data, needs_enrichment, created_by_user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (name)
             DO UPDATE SET
                description = COALESCE(EXCLUDED.description, companies.description),
                website = COALESCE(EXCLUDED.website, companies.website),
                logo_url = COALESCE(EXCLUDED.logo_url, companies.logo_url),
                email = COALESCE(EXCLUDED.email, companies.email),
                phone = COALESCE(EXCLUDED.phone, companies.phone),
                address = COALESCE(EXCLUDED.address, companies.address),
                city = COALESCE(EXCLUDED.city, companies.city),
                country = COALESCE(EXCLUDED.country, companies.country),
                enrichment_data = COALESCE(EXCLUDED.enrichment_data, companies.enrichment_data),
                needs_enrichment = COALESCE(EXCLUDED.needs_enrichment, companies.needs_enrichment),
                updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [
                scraped.name,
                scraped.description,
                scraped.website,
                scraped.logo_url,
                finalEmail,
                finalPhone,
                finalAddress,
                finalCity,
                finalCountry,
                enrichmentJson,
                false,
                req.user.id
            ]
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

        const updated = await scrapeAndUpdateCompany(company);

        return res.json({
            message: 'Company information updated successfully',
            company: updated?.company,
            scraped: updated?.scraped
        });
    } catch (error) {
        console.error('Scrape missing company info error:', error);
        return res.status(500).json({ error: error.message || 'Failed to update company information' });
    }
};


module.exports = {
    searchCompanies,
    getCompany,
    getCompanyClaimStatus,
    getBusinessProfile,
    createCompany,
    claimCompany,
    getIndustries,
    getMyCompanies,
    updateCompany,
    getCompanyReviewsForBusiness,
    getCompanyAnalytics,
    getCompanyApiUsage,
    getCompanyApiKeys,
    createCompanyApiKey,
    revokeCompanyApiKey,
    uploadCompanyLogo,
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
    ,
    unclaimCompany
};
