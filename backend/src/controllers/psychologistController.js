
const { query } = require('../utils/database');
const { sendApplicationConfirmation } = require('../utils/emailService');


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


        const existingUser = await query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );


        await query(`
      CREATE TABLE IF NOT EXISTS psychologist_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        license_number VARCHAR(100) NOT NULL,
        license_issuing_body VARCHAR(255) NOT NULL,
        years_of_experience INT NOT NULL,
        specialization TEXT[],
        qualifications TEXT[],
        biography TEXT,
        phone_number VARCHAR(50),
        address TEXT,
        website VARCHAR(255),
        linkedin VARCHAR(255),
        consultation_modes TEXT[],
        languages TEXT[],
        accepted_age_groups TEXT[],
        emergency_contact JSONB,
        avatar_url TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);


        const existing = await query(
            'SELECT * FROM psychologist_applications WHERE email = $1',
            [email]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Application already submitted' });
        }


        const result = await query(
            `INSERT INTO psychologist_applications (
        full_name, email, license_number, license_issuing_body,
        years_of_experience, specialization, qualifications, biography,
        phone_number, address, website, linkedin, consultation_modes,
        languages, accepted_age_groups, emergency_contact, avatar_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
            [
                fullName, email, licenseNumber, licenseIssuingBody,
                yearsOfExperience, specialization || [], qualifications || [], biography,
                phoneNumber, address, website, linkedin, consultationModes || [],
                languages || [], acceptedAgeGroups || [], emergencyContact || {}, avatarUrl
            ]
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
