const { query } = require('../utils/database');

const TABLE_CACHE_TTL = 5 * 60 * 1000;
const tableCache = new Map();

const ensureTable = async (tableName) => {
    if (!tableName) return false;
    const cached = tableCache.get(tableName);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.present;
    }
    try {
        const result = await query('SELECT to_regclass($1) AS exists', [`public.${tableName}`]);
        const present = Boolean(result.rows[0]?.exists);
        tableCache.set(tableName, { present, expiresAt: Date.now() + TABLE_CACHE_TTL });
        return present;
    } catch (error) {
        console.error(`Table introspection failed for ${tableName}:`, error.message);
        tableCache.set(tableName, { present: false, expiresAt: Date.now() + TABLE_CACHE_TTL });
        return false;
    }
};

const APPLICATION_CONFIG = {
    psychologist: {
        table: 'psychologist_applications',
        steps: [
            { key: 'documents', column: 'document', label: 'Documents verified' },
            { key: 'ownership', column: 'ownership', label: 'Ownership confirmed' },
            { key: 'experience', column: 'experience', label: 'Experience verified' }
        ],
        requiredDocuments: [
            { type: 'license', label: 'Professional license or certification' },
            { type: 'government_id', label: 'Government-issued identification' },
            { type: 'qualification', label: 'Proof of qualifications' }
        ],
        profileLabel: 'Psychologist'
    },
    business: {
        table: 'business_applications',
        steps: [
            { key: 'documents', column: 'document', label: 'Documents verified' },
            { key: 'ownership', column: 'ownership', label: 'Ownership confirmed' }
        ],
        requiredDocuments: [
            { type: 'registration_certificate', label: 'Business registration certificate' },
            { type: 'ownership_proof', label: 'Proof of ownership or authorization' }
        ],
        profileLabel: 'Business Owner'
    }
};

const STATUS_LABELS = {
    pending_review: 'Pending Review',
    under_verification: 'Under Verification',
    awaiting_information: 'Awaiting Additional Information',
    approved: 'Approved',
    rejected: 'Rejected'
};

const SUPPORTED_ACTIONS = new Set([
    'verify_documents',
    'verify_ownership',
    'verify_experience',
    'request_info',
    'approve',
    'reject'
]);

const parseJson = (raw, fallback) => {
    if (raw === null || raw === undefined) return fallback;
    if (typeof raw === 'object') return raw;
    try {
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
};

const normalizeDocType = (value) => {
    if (!value) return null;
    const normalized = String(value).toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
    return normalized || null;
};

const normalizeRequiredDocumentsConfig = (docs = []) => docs.map((doc, index) => {
    if (typeof doc === 'string') {
        return {
            type: normalizeDocType(doc) || `document_${index}`,
            label: doc
        };
    }
    return {
        type: normalizeDocType(doc?.type) || `document_${index}`,
        label: doc?.label || doc?.name || doc?.type || `Document ${index + 1}`
    };
});

const findRequiredDocLabel = (config, type) => {
    if (!type) return null;
    const match = (config.requiredDocuments || []).find((doc) => normalizeDocType(doc.type) === type);
    return match?.label || null;
};

const formatDocumentRecord = (doc, index, row, config) => {
    if (!doc) return null;
    if (typeof doc === 'string') {
        return formatDocumentRecord({ url: doc }, index, row, config);
    }
    const url = doc.url || doc.href || doc.path || doc.location || null;
    if (!url) return null;
    const type = normalizeDocType(doc.type || doc.documentType || doc.id || `doc_${index}`) || `doc_${index}`;
    const label = doc.label
        || findRequiredDocLabel(config, type)
        || doc.name
        || doc.filename
        || `Document ${index + 1}`;
    return {
        id: doc.id || `${type}_${index}`,
        type,
        label,
        url,
        filename: doc.filename || doc.originalName || null,
        uploadedAt: doc.uploadedAt || doc.uploaded_at || row.updated_at || row.created_at || null
    };
};

const normalizeDocuments = (row, config) => {
    const docs = parseJson(row.documents, null);
    if (Array.isArray(docs)) {
        return docs
            .map((doc, index) => formatDocumentRecord(doc, index, row, config))
            .filter(Boolean);
    }
    if (docs && typeof docs === 'object') {
        return Object.entries(docs)
            .map(([key, value], index) => formatDocumentRecord({ ...(value || {}), type: value?.type || key }, index, row, config))
            .filter(Boolean);
    }
    return [];
};

Object.values(APPLICATION_CONFIG).forEach((config) => {
    config.requiredDocuments = normalizeRequiredDocumentsConfig(config.requiredDocuments);
});

const buildChecklist = (row, config) => {
    const checklist = {};
    config.steps.forEach((step) => {
        const prefix = step.column;
        checklist[step.key] = {
            verified: Boolean(row[`${prefix}_verified`]),
            verifiedAt: row[`${prefix}_verified_at`] || null,
            verifiedBy: row[`${prefix}_verified_by`] || null,
            verifiedByName: row[`${prefix}_verified_by_name`] || null,
            notes: row[`${prefix}_notes`] || null
        };
    });
    return checklist;
};

const buildTimeline = (row, config) => {
    const timeline = [];
    if (row.created_at) {
        timeline.push({
            key: 'submitted',
            label: 'Application submitted',
            at: row.created_at
        });
    }
    config.steps.forEach((step) => {
        const at = row[`${step.column}_verified_at`];
        if (at) {
            timeline.push({
                key: step.key,
                label: step.label,
                at
            });
        }
    });
    if (row.reviewed_at) {
        const decisionLabel = row.status === 'approved'
            ? 'Application approved'
            : row.status === 'rejected'
                ? 'Application rejected'
                : 'Application reviewed';
        timeline.push({
            key: 'decision',
            label: decisionLabel,
            at: row.reviewed_at,
            status: row.status
        });
    }
    return timeline.sort((a, b) => {
        const timeA = new Date(a.at || row.created_at || 0).getTime();
        const timeB = new Date(b.at || row.created_at || 0).getTime();
        return timeA - timeB;
    });
};

const mapApplicationRow = (row, type) => {
    const config = APPLICATION_CONFIG[type];
    if (!config || !row) return null;
    const checklist = buildChecklist(row, config);
    const totalSteps = config.steps.length;
    const completedSteps = config.steps.filter((step) => checklist[step.key]?.verified).length;
    const status = row.status || 'pending_review';
    return {
        id: row.id,
        application_type: type,
        applicantId: row.user_id || row.applicant_id || null,
        applicant_name: row.user_name || row.full_name || row.company_name || row.applicant_name || null,
        applicant_email: row.user_email || row.email || row.business_email || null,
        profile_type: config.profileLabel,
        status,
        statusLabel: STATUS_LABELS[status] || status,
        submittedAt: row.created_at,
        updatedAt: row.updated_at,
        checklist,
        verificationProgress: totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0,
        readyForDecision: completedSteps === totalSteps,
        requiredDocuments: config.requiredDocuments,
        documents: normalizeDocuments(row, config),
        adminNotes: row.admin_notes || null,
        metadata: {
            licenseNumber: row.license_number || row.licenseNumber || null,
            licenseBody: row.license_body || null,
            licenseExpiry: row.license_expiry || null,
            yearsExperience: row.years_experience || row.years_of_experience || null,
            qualifications: row.qualifications || null,
            registrationNumber: row.registration_number || null,
            companyName: row.company_name || null,
            jobTitle: row.job_title || null,
            country: row.country || null,
            contactInformation: parseJson(row.contact_information, null)
        },
        reviewedBy: row.reviewed_by || null,
        reviewedByName: row.reviewed_by_name || null,
        timeline: buildTimeline(row, config)
    };
};

const buildBaseQuery = (config) => {
    const selectParts = [
        'app.*',
        'u.email AS user_email',
        'u.display_name AS user_name'
    ];
    const joins = [
        'LEFT JOIN users u ON app.user_id = u.id'
    ];

    config.steps.forEach((step) => {
        const alias = `${step.column}_reviewer`;
        selectParts.push(`${alias}.display_name AS ${step.column}_verified_by_name`);
        joins.push(`LEFT JOIN users ${alias} ON app.${step.column}_verified_by = ${alias}.id`);
    });

    selectParts.push('review_admin.display_name AS reviewed_by_name');
    joins.push('LEFT JOIN users review_admin ON app.reviewed_by = review_admin.id');

    return `
        SELECT ${selectParts.join(', ')}
        FROM ${config.table} app
        ${joins.join('\n        ')}
    `;
};

const listApplications = async ({ status = 'all', type = 'all' } = {}) => {
    const aggregated = [];
    const targets = type === 'all'
        ? Object.keys(APPLICATION_CONFIG)
        : [type];

    for (const target of targets) {
        const config = APPLICATION_CONFIG[target];
        if (!config) continue;
        if (!await ensureTable(config.table)) continue;

        const params = [];
        const filters = [];
        if (status && status !== 'all') {
            filters.push(`app.status = $${params.length + 1}`);
            params.push(status);
        }

        let sql = buildBaseQuery(config);
        if (filters.length) {
            sql += ` WHERE ${filters.join(' AND ')}`;
        }
        sql += ' ORDER BY COALESCE(app.updated_at, app.created_at) DESC';

        const result = await query(sql, params);
        result.rows.forEach((row) => {
            const mapped = mapApplicationRow(row, target);
            if (mapped) {
                aggregated.push(mapped);
            }
        });
    }

    return aggregated.sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.submittedAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.submittedAt || 0).getTime();
        return bTime - aTime;
    });
};

const selectApplicationRowById = async (type, id) => {
    const config = APPLICATION_CONFIG[type];
    if (!config) return null;
    if (!await ensureTable(config.table)) return null;
    const sql = `${buildBaseQuery(config)} WHERE app.id = $1 LIMIT 1`;
    const result = await query(sql, [id]);
    return result.rows[0] || null;
};

const applyApplicationAction = async ({
    type,
    id,
    action,
    adminId,
    notes
}) => {
    const config = APPLICATION_CONFIG[type];
    if (!config) throw new Error('Invalid application type supplied');
    if (!SUPPORTED_ACTIONS.has(action)) throw new Error('Unsupported workflow action');
    if (!await ensureTable(config.table)) {
        return null;
    }

    const current = await selectApplicationRowById(type, id);
    if (!current) {
        return null;
    }

    const updates = [];
    const params = [];
    let idx = 1;
    const setColumn = (column, value) => {
        updates.push(`${column} = $${idx}`);
        params.push(value);
        idx += 1;
    };

    const markStep = (prefix) => {
        updates.push(`${prefix}_verified = TRUE`);
        updates.push(`${prefix}_verified_at = CURRENT_TIMESTAMP`);
        setColumn(`${prefix}_verified_by`, adminId);
        if (notes !== undefined) {
            setColumn(`${prefix}_notes`, notes || null);
        }
    };

    let nextStatus = current.status || 'pending_review';

    switch (action) {
        case 'verify_documents':
            markStep('document');
            if (nextStatus !== 'approved') {
                nextStatus = 'under_verification';
            }
            break;
        case 'verify_ownership':
            markStep('ownership');
            if (nextStatus !== 'approved') {
                nextStatus = 'under_verification';
            }
            break;
        case 'verify_experience':
            if (type !== 'psychologist') {
                throw new Error('Experience verification is only available for psychologist applications');
            }
            markStep('experience');
            if (nextStatus !== 'approved') {
                nextStatus = 'under_verification';
            }
            break;
        case 'request_info':
            nextStatus = 'awaiting_information';
            if (notes !== undefined) {
                setColumn('admin_notes', notes || null);
            }
            break;
        case 'approve':
            nextStatus = 'approved';
            updates.push('reviewed_at = CURRENT_TIMESTAMP');
            setColumn('reviewed_by', adminId);
            if (notes !== undefined) {
                setColumn('admin_notes', notes || null);
            }
            break;
        case 'reject':
            nextStatus = 'rejected';
            updates.push('reviewed_at = CURRENT_TIMESTAMP');
            setColumn('reviewed_by', adminId);
            setColumn('admin_notes', notes || 'Application rejected');
            break;
        default:
            break;
    }

    if (nextStatus !== (current.status || 'pending_review')) {
        setColumn('status', nextStatus);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const updateSql = `
        UPDATE ${config.table}
        SET ${updates.join(', ')}
        WHERE id = $${idx}
        RETURNING id
    `;
    params.push(id);
    const updateResult = await query(updateSql, params);
    if (!updateResult.rows.length) {
        return null;
    }

    const updatedRow = await selectApplicationRowById(type, id);
    return {
        previous: current,
        updated: updatedRow,
        summary: mapApplicationRow(updatedRow, type)
    };
};

const getLatestApplicationStatusForUser = async ({ userId, role }) => {
    if (!userId) return null;
    const normalizedRole = (role || '').toLowerCase();
    const type = normalizedRole === 'business'
        ? 'business'
        : normalizedRole === 'psychologist'
            ? 'psychologist'
            : null;
    if (!type) return null;
    const config = APPLICATION_CONFIG[type];
    if (!config) return null;
    if (!await ensureTable(config.table)) return null;
    const result = await query(
        `${buildBaseQuery(config)} WHERE app.user_id = $1 ORDER BY app.created_at DESC LIMIT 1`,
        [userId]
    );
    if (!result.rows.length) return null;
    return mapApplicationRow(result.rows[0], type);
};

module.exports = {
    listApplications,
    applyApplicationAction,
    getLatestApplicationStatusForUser,
    STATUS_LABELS
};
