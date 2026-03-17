const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../utils/database');
const { createAdminNotification } = require('../utils/adminNotifications');
const { emitFlowEvent } = require('../services/flowEngine');
const { enqueueMarketingForUser } = require('../services/marketingEmailService');
const { getTokenFromRequest } = require('../middleware/auth');
const { fetchSessionSettings } = require('../utils/sessionSettings');
const {
    createSubscriptionRecord,
    updateUserSubscriptionTier,
    getPlanDetails,
    DEFAULT_CURRENCY,
    DEFAULT_PLAN_DURATION_DAYS,
    getActiveSubscription,
    getPlanPayload
} = require('../services/subscriptionService');
const { getLatestApplicationStatusForUser } = require('../services/applicationWorkflowService');

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

const APPLICATION_DOCUMENT_REQUIREMENTS = {
    psychologist: {
        license: 'Professional license or certification',
        government_id: 'Government-issued identification',
        qualification: 'Proof of qualifications'
    },
    business: {
        registration_certificate: 'Business registration certificate',
        ownership_proof: 'Proof of ownership or authorization'
    }
};

const sanitizeDocumentType = (value, fallback = 'document') => {
    if (!value) return fallback;
    const normalized = String(value).toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
    return normalized || fallback;
};

const normalizeDocumentEntry = (doc, fallbackKey = '', configKey = 'document') => {
    if (!doc) return null;
    if (typeof doc === 'string') {
        return normalizeDocumentEntry({ url: doc, type: fallbackKey || configKey }, fallbackKey, configKey);
    }
    const url = (doc.url || doc.href || doc.path || doc.location || '').trim();
    if (!url) return null;
    const type = sanitizeDocumentType(doc.type || doc.documentType || fallbackKey || configKey);
    const label = doc.label || doc.name || doc.displayName || APPLICATION_DOCUMENT_REQUIREMENTS.psychologist?.[type]
        || APPLICATION_DOCUMENT_REQUIREMENTS.business?.[type]
        || (fallbackKey ? fallbackKey.replace(/_/g, ' ') : 'Document');
    return {
        id: doc.id || `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        label,
        url,
        filename: doc.filename || doc.originalName || null,
        uploadedAt: doc.uploadedAt || doc.uploaded_at || new Date().toISOString()
    };
};

const parseApplicationDocuments = (rawDocuments, defaultKey) => {
    if (!rawDocuments) return [];
    let source = rawDocuments;
    if (typeof rawDocuments === 'string') {
        try {
            source = JSON.parse(rawDocuments);
        } catch (error) {
            console.warn('Failed to parse documents payload:', error.message);
            return [];
        }
    }
    if (Array.isArray(source)) {
        return source
            .map((doc, index) => normalizeDocumentEntry(doc, `doc_${index}`, defaultKey))
            .filter(Boolean);
    }
    if (typeof source === 'object') {
        return Object.entries(source)
            .map(([key, value]) => normalizeDocumentEntry({ ...value, type: value?.type || key }, key, defaultKey))
            .filter(Boolean);
    }
    return [];
};

const ensureRequiredDocuments = (documents, requirementMap = {}) => {
    const missing = Object.entries(requirementMap)
        .filter(([key]) => !documents.some((doc) => doc.type === key && doc.url))
        .map(([, label]) => label);
    if (missing.length > 0) {
        const message = `Missing required documents: ${missing.join(', ')}`;
        const error = new Error(message);
        error.statusCode = 400;
        throw error;
    }
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

    let selectPart = `SELECT id, email, password_hash, role, display_name, avatar_url`;
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

        emitFlowEvent('user.signup', {
            userId: user.id,
            email: user.email,
            role: user.role,
            displayName: user.display_name,
            source: 'employee_registration'
        }).catch((eventError) => {
            console.warn('Flow event dispatch failed (signup):', eventError.message);
        });

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
            website,
            documents
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

        const documentPayload = parseApplicationDocuments(documents, 'psychologist_document');
        try {
            ensureRequiredDocuments(documentPayload, APPLICATION_DOCUMENT_REQUIREMENTS.psychologist);
        } catch (error) {
            return res.status(error.statusCode || 400).json({ error: error.message });
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
            params.push('pending_review');
            idx += 1;
        }

        const userResult = await query(
            `INSERT INTO users (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id, email, display_name, role`,
            params
        );
        const user = userResult.rows[0];

        const appTableAvailable = await tableExists('psychologist_applications');
        if (appTableAvailable) {
            const hasUserIdColumn = await columnExists('psychologist_applications', 'user_id');
            const hasEmailColumn = await columnExists('psychologist_applications', 'email');
            const hasFullNameColumn = await columnExists('psychologist_applications', 'full_name');

            if (hasUserIdColumn) {
                const appCols = ['user_id', 'status', 'license_number', 'license_body'];
                const appPlaceholders = ['$1', '$2', '$3', '$4'];
                const appParams = [user.id, 'pending_review', licenseNumber, licenseBody];
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

                const hasDocColumn = await columnExists('psychologist_applications', 'documents');
                if (hasDocColumn) {
                    appCols.push('documents');
                    appPlaceholders.push(`$${appIdx}::jsonb`);
                    appParams.push(JSON.stringify(documentPayload));
                    appIdx += 1;
                }

                await query(
                    `INSERT INTO psychologist_applications (${appCols.join(', ')}) VALUES (${appPlaceholders.join(', ')})`,
                    appParams
                );
            } else if (hasEmailColumn || hasFullNameColumn) {
                const normalizeList = (value) => {
                    if (!value) return null;
                    if (Array.isArray(value)) return value;
                    return String(value)
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean);
                };

                const legacyCols = [];
                const legacyPlaceholders = [];
                const legacyParams = [];
                let legacyIdx = 1;

                if (hasFullNameColumn) {
                    legacyCols.push('full_name');
                    legacyPlaceholders.push(`$${legacyIdx++}`);
                    legacyParams.push(displayName || email.split('@')[0]);
                }
                if (hasEmailColumn) {
                    legacyCols.push('email');
                    legacyPlaceholders.push(`$${legacyIdx++}`);
                    legacyParams.push(email.toLowerCase());
                }

                const hasLicenseNumber = await columnExists('psychologist_applications', 'license_number');
                if (hasLicenseNumber) {
                    legacyCols.push('license_number');
                    legacyPlaceholders.push(`$${legacyIdx++}`);
                    legacyParams.push(licenseNumber);
                }

                const hasIssuingBody = await columnExists('psychologist_applications', 'license_issuing_body');
                const hasLicenseBody = await columnExists('psychologist_applications', 'license_body');
                if (hasIssuingBody || hasLicenseBody) {
                    legacyCols.push(hasIssuingBody ? 'license_issuing_body' : 'license_body');
                    legacyPlaceholders.push(`$${legacyIdx++}`);
                    legacyParams.push(licenseBody);
                }

                const hasYearsOfExperience = await columnExists('psychologist_applications', 'years_of_experience');
                const hasYearsExperience = await columnExists('psychologist_applications', 'years_experience');
                if (hasYearsOfExperience || hasYearsExperience) {
                    legacyCols.push(hasYearsOfExperience ? 'years_of_experience' : 'years_experience');
                    legacyPlaceholders.push(`$${legacyIdx++}`);
                    legacyParams.push(yearsExperience || null);
                }

                const legacyOptionalMap = [
                    { column: 'specialization', value: specialisations },
                    { column: 'specialisations', value: specialisations },
                    { column: 'qualifications', value: normalizeList(qualifications) },
                    { column: 'biography', value: bio || null },
                    { column: 'practice_location', value: practiceLocation || null },
                    { column: 'website', value: website || null },
                    { column: 'languages', value: normalizeList(languages) },
                    { column: 'consultation_modes', value: normalizeList(therapyTypes) },
                    { column: 'session_formats', value: normalizeList(sessionFormats) }
                ];

                for (const entry of legacyOptionalMap) {
                    if (entry.value == null) {
                        continue;
                    }
                    const exists = await columnExists('psychologist_applications', entry.column);
                    if (exists) {
                        legacyCols.push(entry.column);
                        legacyPlaceholders.push(`$${legacyIdx++}`);
                        legacyParams.push(entry.value);
                    }
                }

                const hasLegacyStatus = await columnExists('psychologist_applications', 'status');
                if (hasLegacyStatus) {
                    legacyCols.push('status');
                    legacyPlaceholders.push(`$${legacyIdx++}`);
                    legacyParams.push('pending_review');
                }

                if (legacyCols.length > 0) {
                    await query(
                        `INSERT INTO psychologist_applications (${legacyCols.join(', ')}) VALUES (${legacyPlaceholders.join(', ')})`,
                        legacyParams
                    );
                }
            }
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
                            website,
                            documents: documentPayload
                        },
                        appliedAt: new Date()
                    }), user.id]
                );
            }
            console.warn('psychologist_applications table not found, application data stored in user metadata.');
        }

        try {
            await createAdminNotification({
                type: 'psychologist_application',
                message: `New psychologist application from ${email}`,
                entityType: 'psychologist_application',
                entityId: user.id
            });
        } catch (error) {
            console.warn('Admin notification failed:', error.message);
        }

        enqueueMarketingForUser(user.id).catch((error) => {
            console.warn('Marketing enqueue failed:', error.message);
        });

        let psychSubscriptionData = null;
        try {
            await assignStarterSubscription(user.id, user.role);
            const psychOwnerType = ROLE_TO_OWNER[String(user.role || 'employee').toLowerCase()] || 'user';
            const psychSubscriptionRecord = await getActiveSubscription(psychOwnerType, user.id);
            psychSubscriptionData = await getPlanPayload(psychSubscriptionRecord, psychOwnerType);
        } catch (error) {
            console.warn('Starter subscription failed:', error.message);
        }

        let applicationStatus = null;
        try {
            applicationStatus = await getLatestApplicationStatusForUser({ userId: user.id, role: user.role });
        } catch (error) {
            console.warn('Application status lookup failed:', error.message);
        }

        emitFlowEvent('user.signup', {
            userId: user.id,
            email: user.email,
            role: user.role,
            displayName: user.display_name,
            source: 'psychologist_registration'
        }).catch((eventError) => {
            console.warn('Flow event dispatch failed (psychologist signup):', eventError.message);
        });

        return res.status(201).json({
            success: true,
            message: 'Application submitted successfully. You will be notified by email once reviewed.',
            userId: user.id,
            subscription: psychSubscriptionData,
            applicationStatus
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
            howDidYouHear,
            documents,
            contactPhone
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
        const normalizedRegistrationNumber = String(registrationNumber || '').trim();
        if (!normalizedRegistrationNumber) {
            return res.status(400).json({ error: 'Business registration number is required' });
        }
        const normalizedContactPhone = String(contactPhone || '').trim();
        if (!normalizedContactPhone) {
            return res.status(400).json({ error: 'A business contact phone number is required' });
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

        const documentPayload = parseApplicationDocuments(documents, 'business_document');
        try {
            ensureRequiredDocuments(documentPayload, APPLICATION_DOCUMENT_REQUIREMENTS.business);
        } catch (error) {
            return res.status(error.statusCode || 400).json({ error: error.message });
        }

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
            params.push('pending_review');
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
            const appParams = [user.id, 'pending_review', companyName];
            let appIdx = 4;

            const optionalFields = {
                job_title: jobTitle || null,
                company_website: companyWebsite || null,
                industry: industry || null,
                company_size: companySize || null,
                country: country || null,
                company_description: companyDescription || null,
                linkedin_url: linkedinUrl || null,
                registration_number: normalizedRegistrationNumber,
                claim_existing_profile: claimExistingProfile ?? false,
                claim_company_id: claimCompanyId || null,
                how_did_you_hear: howDidYouHear || null,
                contact_information: {
                    name: displayName,
                    email: email.toLowerCase(),
                    phone: normalizedContactPhone,
                    jobTitle: jobTitle || null
                }
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

            const hasDocColumn = await columnExists('business_applications', 'documents');
            if (hasDocColumn) {
                appCols.push('documents');
                appPlaceholders.push(`$${appIdx}::jsonb`);
                appParams.push(JSON.stringify(documentPayload));
                appIdx += 1;
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
                            registrationNumber: normalizedRegistrationNumber,
                            claimExistingProfile,
                            claimCompanyId,
                            howDidYouHear,
                            contactInformation: {
                                name: displayName,
                                email: email.toLowerCase(),
                                phone: normalizedContactPhone,
                                jobTitle
                            },
                            documents: documentPayload
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
        const applicationStatus = await getLatestApplicationStatusForUser({ userId: user.id, role: user.role });

        emitFlowEvent('user.signup', {
            userId: user.id,
            email: user.email,
            role: user.role,
            displayName: user.display_name,
            source: 'business_registration',
            companyName
        }).catch((eventError) => {
            console.warn('Flow event dispatch failed (business signup):', eventError.message);
        });

        return res.status(201).json({
            success: true,
            message: 'Application submitted successfully. Our team will review your information and reach out within 1–2 business days.',
            userId: user.id,
            subscription: businessSubscriptionData,
            applicationStatus
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

        const normalizedStatus = String(user.status || '').toLowerCase();
        const blockedStatuses = new Set(['pending', 'pending_review', 'under_verification', 'awaiting_information']);
        if (blockedStatuses.has(normalizedStatus) || user.is_active === false) {
            const roleMessage = {
                psychologist: normalizedStatus === 'awaiting_information'
                    ? 'We need a bit more information to finish verifying your psychologist account.'
                    : 'Your psychologist application is under review. You will be notified once approved.',
                business: normalizedStatus === 'awaiting_information'
                    ? 'We need additional information to verify your business application.'
                    : 'Your business application is under review. You will be notified once approved.'
            };
            console.warn('Login blocked: inactive_or_pending', {
                email: loginEmail,
                role: normalizedRole,
                isAdminRole,
                status: normalizedStatus,
                is_active: user.is_active,
                ip: loginIp
            });
            return res.status(403).json({
                error: roleMessage[user.role] || 'Your account is pending approval.',
                status: normalizedStatus || 'pending'
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

        const applicationStatus = await getLatestApplicationStatusForUser({ userId: user.id, role: user.role });

        try {
            const hasLastLogin = await columnExists('users', 'last_login');
            const hasLastActive = await columnExists('users', 'last_active');
            if (hasLastLogin || hasLastActive) {
                const setParts = [];
                if (hasLastLogin) setParts.push('last_login = CURRENT_TIMESTAMP');
                if (hasLastActive) setParts.push('last_active = CURRENT_TIMESTAMP');
                await query(`UPDATE users SET ${setParts.join(', ')} WHERE id = $1`, [user.id]);
            }
        } catch (updateError) {
            console.warn('Failed to update login activity:', updateError.message);
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
                display_name: user.display_name,
                role: user.role,
                avatarUrl: user.avatar_url,
                avatar_url: user.avatar_url,
                status: user.status,
                subscription: subscriptionPayload,
                applicationStatus
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
        const applicationStatus = await getLatestApplicationStatusForUser({ userId: user.id, role: user.role });

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
                subscription: subscriptionPayload,
                applicationStatus
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

const getSessionSettings = async (req, res) => {
    try {
        const settings = await fetchSessionSettings();
        return res.json({
            inactivityTimeout: settings.inactivityTimeoutMinutes,
            inactivityTimeoutMinutes: settings.inactivityTimeoutMinutes,
            autoLogoutEnabled: settings.autoLogoutEnabled
        });
    } catch (error) {
        console.error('Session settings fetch failed:', error);
        return res.status(500).json({ error: 'Failed to fetch session settings' });
    }
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
        const applicationStatus = await getLatestApplicationStatusForUser({ userId: user.id, role: user.role });

        return res.json({
            success: true,
            token: newToken,
            user: {
                id: user.id,
                email: user.email,
                displayName: user.display_name,
                role: user.role,
                subscription: subscriptionInfo,
                applicationStatus
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
    getSessionSettings,
    logout,
    refreshToken
};
