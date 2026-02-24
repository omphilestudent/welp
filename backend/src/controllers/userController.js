// backend/src/controllers/userController.js
const { query } = require('../utils/database');

const getProfile = async (req, res) => {
    try {
        const result = await query(
            `SELECT id, email, role, is_anonymous, display_name, avatar_url, created_at 
       FROM users WHERE id = $1`,
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
        const { displayName, avatarUrl } = req.body;

        const result = await query(
            `UPDATE users 
       SET display_name = COALESCE($1, display_name),
           avatar_url = COALESCE($2, avatar_url),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, email, role, is_anonymous, display_name, avatar_url`,
            [displayName, avatarUrl, req.user.id]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

const getEmployeeForPsychologist = async (req, res) => {
    try {
        const { employeeId } = req.params;

        // Psychologists can only see basic info of employees
        const result = await query(
            `SELECT id, display_name, is_anonymous 
       FROM users 
       WHERE id = $1 AND role = 'employee'`,
            [employeeId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get employee error:', error);
        res.status(500).json({ error: 'Failed to fetch employee' });
    }
};

const getPsychologists = async (req, res) => {
    try {
        const result = await query(
            `SELECT id, display_name, avatar_url 
       FROM users 
       WHERE role = 'psychologist' AND is_verified = true
       ORDER BY display_name`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get psychologists error:', error);
        res.status(500).json({ error: 'Failed to fetch psychologists' });
    }
};

const verifyPsychologist = async (req, res) => {
    try {
        const { userId } = req.params;
        const { verified } = req.body;

        // This would typically be an admin function
        const result = await query(
            `UPDATE users 
       SET is_verified = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND role = 'psychologist'
       RETURNING id, display_name, is_verified`,
            [verified, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Psychologist not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Verify psychologist error:', error);
        res.status(500).json({ error: 'Failed to verify psychologist' });
    }
};

module.exports = {
    getProfile,
    updateProfile,
    getEmployeeForPsychologist,
    getPsychologists,
    verifyPsychologist
};