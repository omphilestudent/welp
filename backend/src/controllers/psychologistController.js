
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
            avatarUrl
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
            status: 'pending_review'
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

module.exports = {
    applyAsPsychologist,
    getApplicationStatus,
    uploadLicenseDocument
};
