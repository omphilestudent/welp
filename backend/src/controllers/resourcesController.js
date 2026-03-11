const { query } = require('../utils/database');

const getMentalHealthResources = async (req, res) => {
    try {
        const result = await query(
            `SELECT
                 id,
                 title,
                 description,
                 category,
                 audience,
                 resource_type,
                 url,
                 phone,
                 email,
                 is_emergency,
                 created_at
             FROM mental_health_resources
             WHERE is_active = true
             ORDER BY is_emergency DESC, category ASC, created_at DESC`
        );

        res.json({ resources: result.rows || [] });
    } catch (error) {
        console.error('Get mental health resources error:', error);
        res.status(500).json({ error: 'Failed to fetch mental health resources' });
    }
};

module.exports = {
    getMentalHealthResources
};
