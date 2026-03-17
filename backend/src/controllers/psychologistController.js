
const { query } = require('../utils/database');
const { sendApplicationConfirmation } = require('../utils/emailService');

const tableExists = async (tableName) => {
    try {
        const result = await query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = $1
            )`,
            [tableName]
        );
        return result.rows[0]?.exists === true;
    } catch {
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
        return result.rows[0]?.exists === true;
    } catch {
        return false;
    }
};

const getColumnType = async (tableName, columnName) => {
    try {
        const result = await query(
            `SELECT data_type
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
             LIMIT 1`,
            [tableName, columnName]
        );
        return result.rows[0]?.data_type || null;
    } catch {
        return null;
    }
};

const normalizeArray = (value) => {
    if (!value) return null;
    if (Array.isArray(value)) return value;
    return String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
};

const normalizeDocumentEntry = (doc, fallbackType, defaultKey) => {
    if (!doc) return null;
    if (typeof doc === 'string') {
        return normalizeDocumentEntry({ url: doc }, fallbackType, defaultKey);
    }
    const url = doc.url || doc.href || doc.path || doc.location || null;
    if (!url) return null;
    const type = doc.type || doc.documentType || doc.id || fallbackType || defaultKey;
    return {
        id: doc.id || `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        label: doc.label || doc.name || doc.filename || doc.originalName || type,
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
        } catch {
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

const applyAsPsychologist = async (req, res) => {
    try {
        const {
            fullName,
            email,
            licenseNumber,
            licenseIssuingBody,
            yearsOfExperience,
            specialization,
            qualifications,
            biography,
            phoneNumber,
            address,
            website,
            linkedin,
            consultationModes,
            languages,
            acceptedAgeGroups,
            emergencyContact,
            avatarUrl,
            skipDocuments
        } = req.body;


        if (!fullName || !email || !licenseNumber || !licenseIssuingBody || !yearsOfExperience) {
            return res.status(400).json({ error: 'Missing required fields' });
        }


        const tableAvailable = await tableExists('psychologist_applications');
        if (!tableAvailable) {
            return res.status(500).json({ error: 'Application storage is not available. Please try again later.' });
        }

        const hasEmail = await columnExists('psychologist_applications', 'email');
        if (hasEmail) {
            const existing = await query(
                'SELECT id FROM psychologist_applications WHERE email = $1 LIMIT 1',
                [email]
            );
            if (existing.rows.length > 0) {
                return res.status(400).json({ error: 'Application already submitted' });
            }
        }

        const columnValues = {
            full_name: fullName,
            email,
            license_number: licenseNumber,
            license_issuing_body: licenseIssuingBody,
            license_body: licenseIssuingBody,
            years_of_experience: yearsOfExperience,
            years_experience: yearsOfExperience,
            specialization: normalizeArray(specialization),
            specialisations: normalizeArray(specialization),
            qualifications: normalizeArray(qualifications),
            biography,
            bio: biography,
            phone_number: phoneNumber,
            address,
            website,
            linkedin,
            consultation_modes: normalizeArray(consultationModes),
            therapy_types: normalizeArray(consultationModes),
            languages: normalizeArray(languages),
            accepted_age_groups: normalizeArray(acceptedAgeGroups),
            emergency_contact: emergencyContact || null,
            avatar_url: avatarUrl,
            status: 'pending_review',
            kyc_status: skipDocuments ? 'not_submitted' : 'not_submitted',
            documents_submitted: false,
            can_use_profile: false
        };

        const cols = [];
        const placeholders = [];
        const params = [];
        let idx = 1;

        for (const [column, value] of Object.entries(columnValues)) {
            if (value === null || value === undefined) continue;
            const exists = await columnExists('psychologist_applications', column);
            if (!exists) continue;

            const columnType = await getColumnType('psychologist_applications', column);
            cols.push(column);
            if (columnType === 'jsonb' || columnType === 'json') {
                placeholders.push(`$${idx}::jsonb`);
                params.push(JSON.stringify(value));
            } else {
                placeholders.push(`$${idx}`);
                params.push(value);
            }
            idx += 1;
        }

        if (!cols.length) {
            return res.status(500).json({ error: 'Application schema is unavailable. Please contact support.' });
        }

        const result = await query(
            `INSERT INTO psychologist_applications (${cols.join(', ')})
             VALUES (${placeholders.join(', ')})
             RETURNING *`,
            params
        );


        try {
            await sendApplicationConfirmation(email, fullName);
        } catch (emailError) {
            console.log('Email confirmation logged to console');
        }

        res.status(201).json({
            message: 'Application submitted successfully. We will review your credentials and get back to you within 3-5 business days.',
            application: result.rows[0]
        });
    } catch (error) {
        console.error('Apply as psychologist error:', error);
        res.status(500).json({ error: 'Failed to submit application' });
    }
};


const getApplicationStatus = async (req, res) => {
    try {
        const { email } = req.params;

        const tableAvailable = await tableExists('psychologist_applications');
        if (!tableAvailable) {
            return res.status(404).json({ error: 'Application not found' });
        }

        const hasEmail = await columnExists('psychologist_applications', 'email');
        if (!hasEmail) {
            return res.status(404).json({ error: 'Application not found' });
        }

        const result = await query(
            `SELECT id, status, created_at, reviewed_at, admin_notes
             FROM psychologist_applications
             WHERE email = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Application not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get application status error:', error);
        res.status(500).json({ error: 'Failed to fetch application status' });
    }
};


const uploadLicenseDocument = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { documentUrl } = req.body;

        if (!documentUrl) {
            return res.status(400).json({ error: 'Document URL is required' });
        }


        await query(`
      CREATE TABLE IF NOT EXISTS license_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        application_id UUID REFERENCES psychologist_applications(id) ON DELETE CASCADE,
        document_url TEXT NOT NULL,
        document_type VARCHAR(50),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

        await query(
            'INSERT INTO license_documents (application_id, document_url) VALUES ($1, $2)',
            [applicationId, documentUrl]
        );

        res.json({ message: 'Document uploaded successfully' });
    } catch (error) {
        console.error('Upload license document error:', error);
        res.status(500).json({ error: 'Failed to upload document' });
    }
};

const uploadPsychologistDocuments = async (req, res) => {
    try {
        const documents = parseApplicationDocuments(req.body?.documents || req.body?.document, 'psychologist_document');
        if (!documents.length) {
            return res.status(400).json({ error: 'No documents provided' });
        }

        const tableAvailable = await tableExists('psychologist_applications');
        if (!tableAvailable) {
            return res.status(500).json({ error: 'Application storage is not available. Please try again later.' });
        }

        const hasUserId = await columnExists('psychologist_applications', 'user_id');
        const hasEmail = await columnExists('psychologist_applications', 'email');
        let applicationRow = null;

        if (hasUserId) {
            const result = await query(
                `SELECT id FROM psychologist_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
                [req.user.id]
            );
            applicationRow = result.rows[0] || null;
        } else if (hasEmail) {
            const result = await query(
                `SELECT id FROM psychologist_applications WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
                [req.user.email]
            );
            applicationRow = result.rows[0] || null;
        }

        if (!applicationRow) {
            return res.status(404).json({ error: 'Application not found for this user' });
        }

        const updates = [];
        const params = [];
        let idx = 1;
        const pushUpdate = (column, value, json = false) => {
            updates.push(`${column} = $${idx}${json ? '::jsonb' : ''}`);
            params.push(json ? JSON.stringify(value) : value);
            idx += 1;
        };

        if (await columnExists('psychologist_applications', 'documents')) {
            pushUpdate('documents', documents, true);
        }
        if (await columnExists('psychologist_applications', 'documents_submitted')) {
            pushUpdate('documents_submitted', true);
        }
        if (await columnExists('psychologist_applications', 'kyc_status')) {
            pushUpdate('kyc_status', 'pending');
        }
        if (await columnExists('psychologist_applications', 'can_use_profile')) {
            pushUpdate('can_use_profile', false);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        const sql = `
            UPDATE psychologist_applications
            SET ${updates.join(', ')}
            WHERE id = $${idx}
            RETURNING id
        `;
        params.push(applicationRow.id);
        await query(sql, params);

        await query(
            `UPDATE users
             SET documents_submitted = true,
                 kyc_status = 'pending',
                 can_use_profile = false,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [req.user.id]
        );

        return res.json({ message: 'Documents submitted. Your verification is now pending.' });
    } catch (error) {
        console.error('Upload psychologist documents error:', error);
        return res.status(500).json({ error: 'Failed to upload documents' });
    }
};

module.exports = {
    applyAsPsychologist,
    getApplicationStatus,
    uploadLicenseDocument,
    uploadPsychologistDocuments
};
