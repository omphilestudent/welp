
const { query } = require('../utils/database');
const bcrypt = require('bcryptjs');


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


const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;


        const user = await query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.user.id]
        );

        if (user.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.rows[0].password_hash) {
            return res.status(400).json({ error: 'Password change is not available for this account type' });
        }


        const validPassword = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }


        const hashedPassword = await bcrypt.hash(newPassword, 12);


        await query(
            'UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [hashedPassword, req.user.id]
        );

        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        res.json({ message: 'Password changed successfully. Please login again.' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
};


const getSettings = async (req, res) => {
    try {

        await query(`
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                theme VARCHAR(10) DEFAULT 'light',
                email_notifications BOOLEAN DEFAULT true,
                message_notifications BOOLEAN DEFAULT true,
                review_notifications BOOLEAN DEFAULT true,
                marketing_notifications BOOLEAN DEFAULT false,
                product_updates BOOLEAN DEFAULT true,
                security_alerts BOOLEAN DEFAULT true,
                profile_visibility VARCHAR(20) DEFAULT 'public',
                data_sharing BOOLEAN DEFAULT false,
                language VARCHAR(10) DEFAULT 'en',
                timezone VARCHAR(50) DEFAULT 'UTC',
                two_factor_enabled BOOLEAN DEFAULT false,
                login_alerts BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await query(`
            ALTER TABLE user_settings
                ADD COLUMN IF NOT EXISTS marketing_notifications BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS product_updates BOOLEAN DEFAULT true,
                ADD COLUMN IF NOT EXISTS security_alerts BOOLEAN DEFAULT true,
                ADD COLUMN IF NOT EXISTS profile_visibility VARCHAR(20) DEFAULT 'public',
                ADD COLUMN IF NOT EXISTS data_sharing BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en',
                ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC',
                ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS login_alerts BOOLEAN DEFAULT true;
        `);

        const result = await query(
            `SELECT * FROM user_settings WHERE user_id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {

            return res.json({
                theme: 'light',
                email_notifications: true,
                message_notifications: true,
                review_notifications: true,
                marketing_notifications: false,
                product_updates: true,
                security_alerts: true,
                profile_visibility: 'public',
                data_sharing: false,
                language: 'en',
                timezone: 'UTC',
                two_factor_enabled: false,
                login_alerts: true
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
};


const updateSettings = async (req, res) => {
    try {
        const {
            theme,
            emailNotifications,
            messageNotifications,
            reviewNotifications,
            marketingNotifications,
            productUpdates,
            securityAlerts,
            profileVisibility,
            dataSharing,
            language,
            timezone,
            twoFactorEnabled,
            loginAlerts
        } = req.body;

        const current = await query(
            `SELECT * FROM user_settings WHERE user_id = $1`,
            [req.user.id]
        );
        const existing = current.rows[0] || {};
        const resolve = (value, fallback) => value !== undefined ? value : fallback;

        await query(
            `INSERT INTO user_settings (
                user_id, theme, email_notifications, message_notifications, review_notifications,
                marketing_notifications, product_updates, security_alerts,
                profile_visibility, data_sharing, language, timezone,
                two_factor_enabled, login_alerts
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (user_id)
            DO UPDATE SET
                theme = $2,
                email_notifications = $3,
                message_notifications = $4,
                review_notifications = $5,
                marketing_notifications = $6,
                product_updates = $7,
                security_alerts = $8,
                profile_visibility = $9,
                data_sharing = $10,
                language = $11,
                timezone = $12,
                two_factor_enabled = $13,
                login_alerts = $14,
                updated_at = CURRENT_TIMESTAMP`,
            [
                req.user.id,
                resolve(theme, existing.theme || 'light'),
                resolve(emailNotifications, existing.email_notifications ?? true),
                resolve(messageNotifications, existing.message_notifications ?? true),
                resolve(reviewNotifications, existing.review_notifications ?? true),
                resolve(marketingNotifications, existing.marketing_notifications ?? false),
                resolve(productUpdates, existing.product_updates ?? true),
                resolve(securityAlerts, existing.security_alerts ?? true),
                resolve(profileVisibility, existing.profile_visibility || 'public'),
                resolve(dataSharing, existing.data_sharing ?? false),
                resolve(language, existing.language || 'en'),
                resolve(timezone, existing.timezone || 'UTC'),
                resolve(twoFactorEnabled, existing.two_factor_enabled ?? false),
                resolve(loginAlerts, existing.login_alerts ?? true)
            ]
        );

        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
};


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


        const existing = await query(
            'SELECT id FROM users WHERE id = $1 AND role = $2',
            [req.user.id, 'psychologist']
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'You already have a psychologist profile' });
        }


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


        await query(
            'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['psychologist', req.user.id]
        );


        await query(
            `INSERT INTO psychologist_profiles (
                user_id, license_number, license_issuing_body, years_of_experience,
                specialization, qualifications, biography, consultation_modes,
                languages, accepted_age_groups, hourly_rate, availability
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
                req.user.id, licenseNumber, licenseIssuingBody, yearsOfExperience,
                specialization || [], qualifications || [], biography, consultationModes || [],
                languages || [], acceptedAgeGroups || [], hourlyRate, availability || {}
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


const deleteAccount = async (req, res) => {
    try {
        const { password } = req.body;


        const user = await query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.user.id]
        );

        if (user.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.rows[0].password_hash) {
            return res.status(400).json({ error: 'Account deletion requires a password-based account' });
        }


        const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Password is incorrect' });
        }


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
