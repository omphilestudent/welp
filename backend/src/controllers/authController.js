const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../utils/database');
const { createAdminNotification } = require('../utils/adminNotifications');
const { enqueueMarketingForUser } = require('../services/marketingEmailService');
const { getTokenFromRequest } = require('../middleware/auth');
const {
    createSubscriptionRecord,
    updateUserSubscriptionTier,
    getPlanDetails,
    DEFAULT_CURRENCY,
    DEFAULT_PLAN_DURATION_DAYS,
    getActiveSubscription,
    getPlanPayload
} = require('../services/subscriptionService');

const ROLE_TO_OWNER = {
    employee: 'user',
    psychologist: 'psychologist',
    business: 'business'
};

const STARTER_PLAN_CODES = {
    employee: 'user_free',
    psychologist: 'psychologist_standard',
    business: 'business_base'
};

const tableExists = async (tableName) => {
    try {
        const result = await query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = $1
            )`,
            [tableName]
        );
        return result.rows[0].exists;
    } catch (error) {
        return false;
    }
};

const columnExists = async (tableName, columnName) => {
    try {
        const result = await query(
            `SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
            )`,
            [tableName, columnName]
        );
        return result.rows[0].exists;
    } catch (error) {
        return false;
    }
};

const ensureClaimRequestsTable = async () => {
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
};

const assignStarterSubscription = async (userId, role = 'employee') => {
    try {
        const normalizedRole = (role || 'employee').toLowerCase();
        const ownerType = ROLE_TO_OWNER[normalizedRole] || 'user';
        const planCode = STARTER_PLAN_CODES[normalizedRole] || 'user_free';
        const plan = await getPlanDetails(ownerType, planCode, DEFAULT_CURRENCY);
        const amountMinor = plan?.amountMinor ?? 0;
        const metadata = plan?.metadata ?? {};

        const { endsAt } = await createSubscriptionRecord({
            ownerType,
            ownerId: userId,
            plan,
            currencyCode: DEFAULT_CURRENCY,
            amountMinor,
            durationDays: DEFAULT_PLAN_DURATION_DAYS,
            metadata
        });

        if (ownerType === 'user') {
            await updateUserSubscriptionTier(userId, 'free', plan?.chatMinutes ?? 30, endsAt);
        }
    } catch (error) {
        console.warn('Starter subscription assignment failed:', error.message);
    }
};

const generateToken = (user, options = {}) => {
    const role = String(user?.role || '').toLowerCase().trim();
    const isAdminRole = ['super_admin', 'superadmin', 'system_admin', 'admin', 'hr_admin'].includes(role);

    const payload = {
        userId: user.id,
        role: user.role,
        tokenVersion: Number(user.token_version ?? 0)
    };

    // Admin roles keep a non-expiring token to avoid frequent forced re-logins.
    if (isAdminRole) {
        return jwt.sign(payload, process.env.JWT_SECRET || 'changeme');
    }

    const rememberExpiry = process.env.JWT_REMEMBER_EXPIRES_IN || '30d';
    const defaultExpiry = process.env.JWT_EXPIRE || process.env.JWT_EXPIRES_IN || '7d';

    return jwt.sign(
        payload,
        process.env.JWT_SECRET || 'changeme',
        { expiresIn: options.rememberMe ? rememberExpiry : defaultExpiry }
    );
};


const getUserByEmailForLogin = async (email) => {
    const hasIsAnonymous = await columnExists('users', 'is_anonymous');
    const hasIsActive = await columnExists('users', 'is_active');
    const hasStatus = await columnExists('users', 'status');
    const hasTokenVersion = await columnExists('users', 'token_version');

    let selectPart = `SELECT id, email, password_hash, role, display_name`;
    selectPart += hasIsAnonymous ? `, is_anonymous` : `, false as is_anonymous`;
    selectPart += hasIsActive ? `, is_active` : `, true as is_active`;
    selectPart += hasStatus ? `, status` : `, NULL::text as status`;
    selectPart += hasTokenVersion ? `, token_version` : `, 0 as token_version`;
    selectPart += `, subscription_tier, subscription_expires, daily_chat_quota_mins, used_chat_minutes, last_chat_reset`;

    return query(
        `${selectPart} FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [email]
    );
};

const getUserByIdForProfile = async (userId) => {
    const hasIsAnonymous = await columnExists('users', 'is_anonymous');
    const hasIsActive = await columnExists('users', 'is_active');

    let selectPart = `SELECT id, email, role, display_name, created_at, avatar_url`;
        selectPart += hasIsAnonymous ? `, is_anonymous` : `, false as is_anonymous`;
        selectPart += hasIsActive ? `, is_active` : `, true as is_active`;
        selectPart += `, subscription_tier, subscription_expires, daily_chat_quota_mins, used_chat_minutes, last_chat_reset`;

    return query(
        `${selectPart} FROM users WHERE id = $1 LIMIT 1`,
        [userId]
    );
};

const registerEmployee = async (req, res) => {
    try {
        const { email, password, displayName, isAnonymous = false } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'An account with this email already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const hasIsActive = await columnExists('users', 'is_active');
        const hasIsVerified = await columnExists('users', 'is_verified');
        const hasIsAnonymous = await columnExists('users', 'is_anonymous');

        const cols = ['email', 'password_hash', 'role', 'display_name'];
        const placeholders = ['$1', '$2', '$3', '$4'];
        const params = [email.toLowerCase(), passwordHash, 'employee', displayName || email.split('@')[0]];
        let idx = 5;

        if (hasIsActive) {
            cols.push('is_active');
            placeholders.push(`$${idx}`);
            params.push(true);
            idx += 1;
        }
        if (hasIsVerified) {
            cols.push('is_verified');
            placeholders.push(`$${idx}`);
            params.push(true);
            idx += 1;
        }
        if (hasIsAnonymous) {
            cols.push('is_anonymous');
            placeholders.push(`$${idx}`);
            params.push(Boolean(isAnonymous));
            idx += 1;
        }

        const result = await query(
            `INSERT INTO users (${cols.join(', ')})
             VALUES (${placeholders.join(', ')})
             RETURNING id, email, display_name, role, token_version, created_at`,
            params
        );

        const user = result.rows[0];
        const token = generateToken(user);

        enqueueMarketingForUser(user.id).catch((error) => {
            console.warn('Marketing enqueue failed:', error.message);
        });

        await assignStarterSubscription(user.id, user.role);

        const employeeOwnerType = ROLE_TO_OWNER[String(user.role || 'employee').toLowerCase()] || 'user';
        const employeeSubscriptionRecord = await getActiveSubscription(employeeOwnerType, user.id);
        const employeeSubscriptionData = await getPlanPayload(employeeSubscriptionRecord, employeeOwnerType);

        return res.status(201).json({
            success: true,
            message: 'Account created successfully',
            token,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.display_name,
                role: user.role,
                subscription: employeeSubscriptionData
            }
        });
    } catch (error) {
        console.error('Register employee error:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'An account with this email already exists' });
        }
        return res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
};

const registerPsychologist = async (req, res) => {
    try {
        const {
            email,
            password,
            displayName,
            licenseNumber,
            licenseBody,
            licenseExpiry,
            yearsExperience,
            qualifications,
            specialisations,
            therapyTypes,
            languages,
            sessionFormats,
            practiceLocation,
            bio,
            website
        } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        if (!licenseNumber || !licenseBody) {
            return res.status(400).json({ error: 'License number and licensing body are required' });
        }

        const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'An account with this email already exists' });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const hasIsActive = await columnExists('users', 'is_active');
        const hasIsVerified = await columnExists('users', 'is_verified');
        const hasStatus = await columnExists('users', 'status');

        const cols = ['email', 'password_hash', 'role', 'display_name'];
        const placeholders = ['$1', '$2', '$3', '$4'];
        const params = [email.toLowerCase(), passwordHash, 'psychologist', displayName || email.split('@')[0]];
        let idx = 5;

        if (hasIsActive) {
            cols.push('is_active');
            placeholders.push(`$${idx}`);
            params.push(false);
            idx += 1;
        }
        if (hasIsVerified) {
            cols.push('is_verified');
            placeholders.push(`$${idx}`);
            params.push(false);
            idx += 1;
        }
        if (hasStatus) {
            cols.push('status');
            placeholders.push(`$${idx}`);
            params.push('pending');
            idx += 1;
        }

        const userResult = await query(
            `INSERT INTO users (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id, email, display_name, role`,
            params
        );
        const user = userResult.rows[0];

        const appTableAvailable = await tableExists('psychologist_applications');
        if (appTableAvailable) {
            const appCols = ['user_id', 'status', 'license_number', 'license_body'];
            const appPlaceholders = ['$1', '$2', '$3', '$4'];
            const appParams = [user.id, 'pending', licenseNumber, licenseBody];
            let appIdx = 5;

            const optionalFields = {
                license_expiry: licenseExpiry || null,
                years_experience: yearsExperience || null,
                qualifications: qualifications || null,
                specialisations: specialisations ? JSON.stringify(specialisations) : null,
                therapy_types: therapyTypes ? JSON.stringify(therapyTypes) : null,
                session_formats: sessionFormats ? JSON.stringify(sessionFormats) : null,
                languages: languages || null,
                practice_location: practiceLocation || null,
                bio: bio || null,
                website: website || null
            };

            for (const [column, value] of Object.entries(optionalFields)) {
                if (value === null) {
                    continue;
                }
                const exists = await columnExists('psychologist_applications', column);
                if (exists) {
                    appCols.push(column);
                    const jsonColumns = ['specialisations', 'therapy_types', 'session_formats'];
                    appPlaceholders.push(jsonColumns.includes(column) ? `$${appIdx}::jsonb` : `$${appIdx}`);
                    appParams.push(value);
                    appIdx += 1;
                }
            }

            await query(
                `INSERT INTO psychologist_applications (${appCols.join(', ')}) VALUES (${appPlaceholders.join(', ')})`,
                appParams
            );
        } else {
            const hasMetadata = await columnExists('users', 'metadata');
            if (hasMetadata) {
                await query(
                    'UPDATE users SET metadata = $1 WHERE id = $2',
                    [JSON.stringify({
                        applicationData: {
                            licenseNumber,
                            licenseBody,
                            licenseExpiry,
                            yearsExperience,
                            qualifications,
                            specialisations,
                            therapyTypes,
                            practiceLocation,
                            bio,
                            website
                        },
                        appliedAt: new Date()
                    }), user.id]
                );
            }
            console.warn('psychologist_applications table not found, application data stored in user metadata.');
        }

        await createAdminNotification({
            type: 'psychologist_application',
            message: `New psychologist application from ${email}`,
            entityType: 'psychologist_application',
            entityId: user.id
        });

        enqueueMarketingForUser(user.id).catch((error) => {
            console.warn('Marketing enqueue failed:', error.message);
        });

        await assignStarterSubscription(user.id, user.role);

        const psychOwnerType = ROLE_TO_OWNER[String(user.role || 'employee').toLowerCase()] || 'user';
        const psychSubscriptionRecord = await getActiveSubscription(psychOwnerType, user.id);
        const psychSubscriptionData = await getPlanPayload(psychSubscriptionRecord, psychOwnerType);

        return res.status(201).json({
            success: true,
            message: 'Application submitted successfully. You will be notified by email once reviewed.',
            userId: user.id,
            subscription: psychSubscriptionData
        });
    } catch (error) {
        console.error('Register psychologist error:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'An account with this email already exists' });
        }
        return res.status(500).json({ error: 'Application submission failed. Please try again.' });
    }
};

const registerBusiness = async (req, res) => {
    try {
        const {
            email,
            password,
            displayName,
            jobTitle,
            companyName,
            companyWebsite,
            industry,
            companySize,
            country,
            companyDescription,
            linkedinUrl,
            registrationNumber,
            claimExistingProfile,
            claimCompanyId,
            howDidYouHear
        } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }
        if (!companyName) {
            return res.status(400).json({ error: 'Company name is required' });
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (claimExistingProfile) {
            if (!claimCompanyId || !uuidRegex.test(claimCompanyId)) {
                return res.status(400).json({ error: 'Select a valid company to claim' });
            }
        }

        const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'An account with this email already exists' });
        }

        if (claimExistingProfile && claimCompanyId) {
            const companyResult = await query(
                'SELECT id, is_claimed FROM companies WHERE id = $1',
                [claimCompanyId]
            );

            if (companyResult.rows.length === 0) {
                return res.status(404).json({ error: 'Selected company could not be found' });
            }
            if (companyResult.rows[0].is_claimed) {
                return res.status(400).json({ error: 'This company has already been claimed' });
            }
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const hasIsActive = await columnExists('users', 'is_active');
        const hasIsVerified = await columnExists('users', 'is_verified');
        const hasStatus = await columnExists('users', 'status');
        const hasJobTitle = await columnExists('users', 'job_title');

        const cols = ['email', 'password_hash', 'role', 'display_name'];
        const placeholders = ['$1', '$2', '$3', '$4'];
        const params = [email.toLowerCase(), passwordHash, 'business', displayName || email.split('@')[0]];
        let idx = 5;

        if (hasIsActive) {
            cols.push('is_active');
            placeholders.push(`$${idx}`);
            params.push(false);
            idx += 1;
        }
        if (hasIsVerified) {
            cols.push('is_verified');
            placeholders.push(`$${idx}`);
            params.push(false);
            idx += 1;
        }
        if (hasStatus) {
            cols.push('status');
            placeholders.push(`$${idx}`);
            params.push('pending');
            idx += 1;
        }
        if (hasJobTitle && jobTitle) {
            cols.push('job_title');
            placeholders.push(`$${idx}`);
            params.push(jobTitle);
            idx += 1;
        }

        const userResult = await query(
            `INSERT INTO users (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id, email, display_name, role`,
            params
        );
        const user = userResult.rows[0];

        const appTableAvailable = await tableExists('business_applications');
        if (appTableAvailable) {
            const appCols = ['user_id', 'status', 'company_name'];
            const appPlaceholders = ['$1', '$2', '$3'];
            const appParams = [user.id, 'pending', companyName];
            let appIdx = 4;

            const optionalFields = {
                job_title: jobTitle || null,
                company_website: companyWebsite || null,
                industry: industry || null,
                company_size: companySize || null,
                country: country || null,
                company_description: companyDescription || null,
                linkedin_url: linkedinUrl || null,
                registration_number: registrationNumber || null,
                claim_existing_profile: claimExistingProfile ?? false,
                claim_company_id: claimCompanyId || null,
                how_did_you_hear: howDidYouHear || null
            };

            for (const [column, value] of Object.entries(optionalFields)) {
                if (value === null || value === undefined) {
                    continue;
                }
                const exists = await columnExists('business_applications', column);
                if (exists) {
                    appCols.push(column);
                    appPlaceholders.push(`$${appIdx}`);
                    appParams.push(value);
                    appIdx += 1;
                }
            }

            await query(
                `INSERT INTO business_applications (${appCols.join(', ')}) VALUES (${appPlaceholders.join(', ')})`,
                appParams
            );
        } else {
            const hasMetadata = await columnExists('users', 'metadata');
            if (hasMetadata) {
                await query(
                    'UPDATE users SET metadata = $1 WHERE id = $2',
                    [JSON.stringify({
                        applicationData: {
                            jobTitle,
                            companyName,
                            companyWebsite,
                            industry,
                            companySize,
                            country,
                            companyDescription,
                            linkedinUrl,
                            registrationNumber,
                            claimExistingProfile,
                            claimCompanyId,
                            howDidYouHear
                        },
                        appliedAt: new Date()
                    }), user.id]
                );
            }
            console.warn('business_applications table not found, application data stored in user metadata.');
        }

        if (claimExistingProfile && claimCompanyId) {
            await ensureClaimRequestsTable();
            await query(
                `INSERT INTO claim_requests (company_id, user_id, business_email, business_phone, position, message)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (company_id, user_id)
                     DO UPDATE SET
                         business_email = EXCLUDED.business_email,
                         business_phone = EXCLUDED.business_phone,
                         position = EXCLUDED.position,
                         message = EXCLUDED.message,
                         status = 'pending',
                         updated_at = CURRENT_TIMESTAMP`,
                [
                    claimCompanyId,
                    user.id,
                    email.toLowerCase(),
                    null,
                    jobTitle || null,
                    'Claim initiated during business registration'
                ]
            );
        }

        await createAdminNotification({
            type: 'business_application',
            message: `New business application from ${email}`,
            entityType: 'business_application',
            entityId: user.id
        });

        enqueueMarketingForUser(user.id).catch((error) => {
            console.warn('Marketing enqueue failed:', error.message);
        });

        await assignStarterSubscription(user.id, user.role);

        const businessOwnerType = ROLE_TO_OWNER[String(user.role || 'employee').toLowerCase()] || 'user';
        const businessSubscriptionRecord = await getActiveSubscription(businessOwnerType, user.id);
        const businessSubscriptionData = await getPlanPayload(businessSubscriptionRecord, businessOwnerType);

        return res.status(201).json({
            success: true,
            message: 'Application submitted successfully. Our team will review your information and reach out within 1–2 business days.',
            userId: user.id,
            subscription: businessSubscriptionData
        });
    } catch (error) {
        console.error('Register business error:', error);
        if (error.code === '23505') {
            return res.status(409).json({ error: 'An account with this email already exists' });
        }
        return res.status(500).json({ error: 'Application submission failed. Please try again.' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password, rememberMe = false } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const loginStart = Date.now();
        const loginEmail = String(email || '').toLowerCase().trim();
        const loginIp = req.ip;
        const userAgent = req.headers['user-agent'];

        const result = await getUserByEmailForLogin(loginEmail);

        if (result.rows.length === 0) {
            console.warn('Login failed: user_not_found', { email: loginEmail, ip: loginIp, ua: userAgent });
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = result.rows[0];
        const normalizedRole = String(user.role || '').toLowerCase().trim();
        const isAdminRole = ['super_admin', 'superadmin', 'system_admin', 'admin', 'hr_admin'].includes(normalizedRole);

        const validPassword = await bcrypt.compare(password, user.password_hash || '');
        if (!validPassword) {
            console.warn('Login failed: invalid_password', { email: loginEmail, role: normalizedRole, isAdminRole, ip: loginIp });
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (user.status === 'pending' || user.is_active === false) {
            const roleMessage = {
                psychologist: 'Your psychologist application is under review. You will be notified once approved.',
                business: 'Your business application is under review. You will be notified once approved.'
            };
            console.warn('Login blocked: inactive_or_pending', {
                email: loginEmail,
                role: normalizedRole,
                isAdminRole,
                status: user.status,
                is_active: user.is_active,
                ip: loginIp
            });
            return res.status(403).json({
                error: roleMessage[user.role] || 'Your account is pending approval.',
                status: 'pending'
            });
        }

        const ownerType = ROLE_TO_OWNER[normalizedRole] || 'user';
        const subscriptionRecord = await getActiveSubscription(ownerType, user.id);
        const subscriptionPayload = await getPlanPayload(subscriptionRecord, ownerType);

        const token = generateToken(user, { rememberMe: Boolean(rememberMe) });

        // Set httpOnly cookie to support cookie-based auth (e.g., HR departments page)
        const cookieOptions = {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
        };
        if (rememberMe || isAdminRole) {
            const rememberDays = Number(process.env.JWT_REMEMBER_COOKIE_DAYS || 30);
            cookieOptions.maxAge = rememberDays * 24 * 60 * 60 * 1000;
        }

        console.info('Login success', {
            email: loginEmail,
            role: normalizedRole,
            isAdminRole,
            rememberMe: Boolean(rememberMe),
            durationMs: Date.now() - loginStart
        });
        res.cookie('token', token, cookieOptions);

        return res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.display_name,
                role: user.role,
                subscription: subscriptionPayload
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Login failed. Please try again.' });
    }
};

const getMe = async (req, res) => {
    try {
        const result = await getUserByIdForProfile(req.user.id);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        const normalizedRole = (user.role || 'employee').toLowerCase();
        const ownerType = ROLE_TO_OWNER[normalizedRole] || 'user';
        const planRecord = await getActiveSubscription(ownerType, user.id);
        const subscriptionPayload = await getPlanPayload(planRecord, ownerType);

        return res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.display_name,
                role: user.role,
                isAnonymous: user.is_anonymous,
                isActive: user.is_active,
                createdAt: user.created_at,
                avatarUrl: user.avatar_url,
                avatar_url: user.avatar_url,
                subscription: subscriptionPayload
            }
        });
    } catch (error) {
        console.error('Get me error:', error);
        return res.status(500).json({ error: 'Failed to fetch user profile' });
    }
};

const logout = async (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    });
    return res.json({ success: true, message: 'Logged out successfully' });
};

const refreshToken = async (req, res) => {
    try {
        const token = getTokenFromRequest(req);
        if (!token) {
            return res.status(401).json({ error: 'Authentication token missing' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                decoded = jwt.decode(token);
                if (!decoded) {
                    return res.status(401).json({ error: 'Refresh token invalid' });
                }
            } else {
                return res.status(401).json({ error: 'Invalid token' });
            }
        }

        const result = await query(
            'SELECT id, email, display_name, role, token_version FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        if (decoded.tokenVersion !== Number(user.token_version ?? 0)) {
            return res.status(401).json({ error: 'Session invalidated. Please log in again.' });
        }

        const newToken = generateToken(user);
        res.cookie('token', newToken, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
        });

        const normalizedRole = (user.role || 'employee').toLowerCase();
        const ownerType = ROLE_TO_OWNER[normalizedRole] || 'user';
        const planRecord = await getActiveSubscription(ownerType, user.id);
        const subscriptionInfo = await getPlanPayload(planRecord, ownerType);

        return res.json({
            success: true,
            token: newToken,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.display_name,
                role: user.role,
                subscription: subscriptionInfo
            }
        });
    } catch (error) {
        console.error('Refresh token error:', error);
        return res.status(500).json({ error: 'Unable to refresh session' });
    }
};

module.exports = {
    registerEmployee,
    registerPsychologist,
    registerBusiness,
    login,
    getMe,
    logout,
    refreshToken
};
