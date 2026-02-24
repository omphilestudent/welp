// backend/src/controllers/kycController.js
const { query } = require('../utils/database');
const { sendKYCApprovalEmail, sendKYCRejectionEmail } = require('../utils/emailService');

// Submit KYC application for company claim
const submitKYC = async (req, res) => {
    try {
        const {
            companyId,
            businessName,
            registrationNumber,
            taxId,
            businessType,
            yearEstablished,
            businessAddress,
            businessPhone,
            businessEmail,
            website,
            legalRepresentative,
            representativeId,
            representativeIdNumber,
            representativeIdExpiry,
            proofOfRegistration,
            taxDocument,
            businessLicense,
            idDocument,
            utilityBill,
            bankStatement,
            additionalDocs,
            agreeToTerms
        } = req.body;

        // Validate required fields
        if (!companyId || !businessName || !registrationNumber || !businessType) {
            return res.status(400).json({ error: 'Missing required company information' });
        }

        if (!legalRepresentative || !representativeId || !representativeIdNumber) {
            return res.status(400).json({ error: 'Missing representative information' });
        }

        if (!agreeToTerms) {
            return res.status(400).json({ error: 'You must agree to the terms and conditions' });
        }

        // Check if company exists
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

        // Create KYC table if not exists
        await query(`
            CREATE TABLE IF NOT EXISTS kyc_applications (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                
                -- Business Information
                business_name VARCHAR(255) NOT NULL,
                registration_number VARCHAR(100) NOT NULL,
                tax_id VARCHAR(100),
                business_type VARCHAR(100) NOT NULL,
                year_established INT,
                business_address TEXT,
                business_phone VARCHAR(50),
                business_email VARCHAR(255),
                website VARCHAR(255),
                
                -- Legal Representative
                legal_representative VARCHAR(255) NOT NULL,
                representative_id VARCHAR(100) NOT NULL,
                representative_id_number VARCHAR(100) NOT NULL,
                representative_id_expiry DATE,
                
                -- Document URLs
                proof_of_registration TEXT[],
                tax_document TEXT[],
                business_license TEXT[],
                id_document TEXT[],
                utility_bill TEXT[],
                bank_statement TEXT[],
                additional_docs JSONB,
                
                -- Status
                status VARCHAR(50) DEFAULT 'pending',
                admin_notes TEXT,
                reviewed_by UUID REFERENCES users(id),
                reviewed_at TIMESTAMP,
                
                -- Metadata
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                UNIQUE(company_id, user_id)
            )
        `);

        // Check if application already exists
        const existing = await query(
            'SELECT * FROM kyc_applications WHERE company_id = $1 AND user_id = $2',
            [companyId, req.user.id]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'KYC application already submitted' });
        }

        // Insert KYC application
        const result = await query(
            `INSERT INTO kyc_applications (
                company_id, user_id, business_name, registration_number, tax_id,
                business_type, year_established, business_address, business_phone,
                business_email, website, legal_representative, representative_id,
                representative_id_number, representative_id_expiry, proof_of_registration,
                tax_document, business_license, id_document, utility_bill, bank_statement,
                additional_docs
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
            RETURNING *`,
            [
                companyId, req.user.id, businessName, registrationNumber, taxId,
                businessType, yearEstablished, businessAddress, businessPhone,
                businessEmail, website, legalRepresentative, representativeId,
                representativeIdNumber, representativeIdExpiry, proofOfRegistration,
                taxDocument, businessLicense, idDocument, utilityBill, bankStatement,
                additionalDocs
            ]
        );

        // Send confirmation email
        await sendKYCApprovalEmail(businessEmail, businessName, 'pending');

        res.status(201).json({
            message: 'KYC application submitted successfully. We will review your documents within 2-3 business days.',
            application: result.rows[0]
        });
    } catch (error) {
        console.error('Submit KYC error:', error);
        res.status(500).json({ error: 'Failed to submit KYC application' });
    }
};

// Get KYC status
const getKYCStatus = async (req, res) => {
    try {
        const { companyId } = req.params;

        const result = await query(
            `SELECT 
                k.*,
                json_build_object(
                    'id', c.id,
                    'name', c.name,
                    'industry', c.industry
                ) as company
            FROM kyc_applications k
            JOIN companies c ON k.company_id = c.id
            WHERE k.company_id = $1 AND k.user_id = $2
            ORDER BY k.created_at DESC
            LIMIT 1`,
            [companyId, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No KYC application found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get KYC status error:', error);
        res.status(500).json({ error: 'Failed to fetch KYC status' });
    }
};

// Get user's KYC applications
const getMyKYCs = async (req, res) => {
    try {
        const result = await query(
            `SELECT 
                k.*,
                json_build_object(
                    'id', c.id,
                    'name', c.name,
                    'industry', c.industry,
                    'logo_url', c.logo_url
                ) as company
            FROM kyc_applications k
            JOIN companies c ON k.company_id = c.id
            WHERE k.user_id = $1
            ORDER BY k.created_at DESC`,
            [req.user.id]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get my KYCs error:', error);
        res.status(500).json({ error: 'Failed to fetch KYC applications' });
    }
};

// Admin: Get all pending KYC applications
const getPendingKYCs = async (req, res) => {
    try {
        const result = await query(
            `SELECT 
                k.*,
                json_build_object(
                    'id', u.id,
                    'email', u.email,
                    'display_name', u.display_name
                ) as applicant,
                json_build_object(
                    'id', c.id,
                    'name', c.name,
                    'industry', c.industry
                ) as company
            FROM kyc_applications k
            JOIN users u ON k.user_id = u.id
            JOIN companies c ON k.company_id = c.id
            WHERE k.status = 'pending'
            ORDER BY k.created_at ASC`,
            []
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get pending KYCs error:', error);
        res.status(500).json({ error: 'Failed to fetch pending KYC applications' });
    }
};

// Admin: Review KYC application
const reviewKYC = async (req, res) => {
    try {
        const { applicationId } = req.params;
        const { status, adminNotes } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Get application details
        const application = await query(
            `SELECT k.*, c.name as company_name, u.email, u.display_name
            FROM kyc_applications k
            JOIN companies c ON k.company_id = c.id
            JOIN users u ON k.user_id = u.id
            WHERE k.id = $1`,
            [applicationId]
        );

        if (application.rows.length === 0) {
            return res.status(404).json({ error: 'KYC application not found' });
        }

        // Update application status
        await query(
            `UPDATE kyc_applications 
            SET status = $1, admin_notes = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = $4`,
            [status, adminNotes, req.user.id, applicationId]
        );

        // If approved, claim the company
        if (status === 'approved') {
            await query('BEGIN');

            await query(
                'UPDATE companies SET is_claimed = true WHERE id = $1',
                [application.rows[0].company_id]
            );

            await query(
                'INSERT INTO company_owners (company_id, user_id) VALUES ($1, $2)',
                [application.rows[0].company_id, application.rows[0].user_id]
            );

            await query('COMMIT');

            // Send approval email
            await sendKYCApprovalEmail(
                application.rows[0].business_email,
                application.rows[0].company_name
            );
        } else {
            // Send rejection email
            await sendKYCRejectionEmail(
                application.rows[0].business_email,
                application.rows[0].company_name,
                adminNotes
            );
        }

        res.json({
            message: `KYC application ${status} successfully`,
            status
        });
    } catch (error) {
        await query('ROLLBACK');
        console.error('Review KYC error:', error);
        res.status(500).json({ error: 'Failed to review KYC application' });
    }
};

module.exports = {
    submitKYC,
    getKYCStatus,
    getMyKYCs,
    getPendingKYCs,
    reviewKYC
};