// backend/src/controllers/userController.js
const { query } = require('../utils/database');
const bcrypt = require('bcryptjs');

// Get user profile
const getProfile = async (req, res) => {
    try {
        const result = await query(
            `SELECT
                 u.id,
                 u.email,
                 u.role,
                 u.is_anonymous,
                 u.display_name,
                 u.avatar_url,
                 u.phone_number,
                 u.bio,
                 u.location,
                 u.website,
                 u.occupation,
                 u.workplace_id,
                 json_build_object(
                         'id', c.id,
                         'name', c.name,
                         'industry', c.industry,
                         'logo_url', c.logo_url
                 ) as workplace,
                 u.created_at,
                 u.updated_at
             FROM users u
                      LEFT JOIN companies c ON u.workplace_id = c.id
             WHERE u.id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
};

// Update user profile
const updateProfile = async (req, res) => {
    try {
        const {
            displayName,
            avatarUrl,
            phoneNumber,
            bio,
            location,
            website,
            occupation,
            workplaceId
        } = req.body;

        const result = await query(
            `UPDATE users 
            SET display_name = COALESCE($1, display_name),
                avatar_url = COALESCE($2, avatar_url),
                phone_number = COALESCE($3, phone_number),
                bio = COALESCE($4, bio),
                location = COALESCE($5, location),
                website = COALESCE($6, website),
                occupation = COALESCE($7, occupation),
                workplace_id = COALESCE($8, workplace_id),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $9
            RETURNING id, email, role, display_name, avatar_url, occupation, workplace_id`,
            [displayName, avatarUrl, phoneNumber, bio, location, website, occupation, workplaceId, req.user.id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

// Change password
const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Get user with password
        const user = await query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.user.id]
        );

        if (user.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [hashedPassword, req.user.id]
        );

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
};

// Get user settings
const getSettings = async (req, res) => {
    try {
        // Create settings table if not exists
        await query(`
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                theme VARCHAR(10) DEFAULT 'light',
                email_notifications BOOLEAN DEFAULT true,
                message_notifications BOOLEAN DEFAULT true,
                review_notifications BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const result = await query(
            `SELECT * FROM user_settings WHERE user_id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            // Return default settings
            return res.json({
                theme: 'light',
                email_notifications: true,
                message_notifications: true,
                review_notifications: true
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
};

// Update settings
const updateSettings = async (req, res) => {
    try {
        const {
            theme,
            emailNotifications,
            messageNotifications,
            reviewNotifications
        } = req.body;

        await query(
            `INSERT INTO user_settings (user_id, theme, email_notifications, message_notifications, review_notifications)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                theme = $2,
                email_notifications = $3,
                message_notifications = $4,
                review_notifications = $5,
                updated_at = CURRENT_TIMESTAMP`,
            [req.user.id, theme, emailNotifications, messageNotifications, reviewNotifications]
        );

        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
};

// Add psychologist profile to existing user
const addPsychologistProfile = async (req, res) => {
    try {
        const {
            licenseNumber,
            licenseIssuingBody,
            yearsOfExperience,
            specialization,
            qualifications,
            biography,
            consultationModes,
            languages,
            acceptedAgeGroups,
            hourlyRate,
            availability
        } = req.body;

        // Check if user already has psychologist profile
        const existing = await query(
            'SELECT id FROM users WHERE id = $1 AND role = $2',
            [req.user.id, 'psychologist']
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'You already have a psychologist profile' });
        }

        // Create psychologist_profiles table if not exists
        await query(`
            CREATE TABLE IF NOT EXISTS psychologist_profiles (
                user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                license_number VARCHAR(100) NOT NULL,
                license_issuing_body VARCHAR(255) NOT NULL,
                years_of_experience INT NOT NULL,
                specialization TEXT[],
                qualifications TEXT[],
                biography TEXT,
                consultation_modes TEXT[],
                languages TEXT[],
                accepted_age_groups TEXT[],
                hourly_rate DECIMAL(10,2),
                availability JSONB,
                is_verified BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Update user role to include psychologist
        await query(
            'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['psychologist', req.user.id]
        );

        // Create psychologist profile
        await query(
            `INSERT INTO psychologist_profiles (
                user_id, license_number, license_issuing_body, years_of_experience,
                specialization, qualifications, biography, consultation_modes,
                languages, accepted_age_groups, hourly_rate, availability
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                req.user.id, licenseNumber, licenseIssuingBody, yearsOfExperience,
                specialization || [], qualifications || [], biography, consultationModes || [],
                languages || ['English'], acceptedAgeGroups || [], hourlyRate, availability || {}
            ]
        );

        res.status(201).json({
            message: 'Psychologist profile added successfully. It will be verified by our team.'
        });
    } catch (error) {
        console.error('Add psychologist profile error:', error);
        res.status(500).json({ error: 'Failed to add psychologist profile' });
    }
};

// Delete account
const deleteAccount = async (req, res) => {
    try {
        const { password } = req.body;

        // Get user with password
        const user = await query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.user.id]
        );

        if (user.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Password is incorrect' });
        }

        // Delete user (cascade will handle related records)
        await query('DELETE FROM users WHERE id = $1', [req.user.id]);

        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
};

module.exports = {
    getProfile,
    updateProfile,
    changePassword,
    getSettings,
    updateSettings,
    addPsychologistProfile,
    deleteAccount
};