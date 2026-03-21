const { query } = require('../utils/database');

const listMyPaymentMethods = async (req, res) => {
    try {
        const result = await query(
            `SELECT id, provider, card_brand, last4, exp_month, exp_year, is_default, status
             FROM user_payment_methods
             WHERE user_id = $1 AND status = 'active'
             ORDER BY is_default DESC, created_at DESC`,
            [req.user.id]
        );
        res.json({ methods: result.rows });
    } catch (error) {
        console.error('List payment methods error:', error);
        res.status(500).json({ error: 'Failed to load payment methods' });
    }
};

const getPaymentMethodSummary = async (req, res) => {
    try {
        const result = await query(
            `SELECT COUNT(*)::int AS total
             FROM user_payment_methods
             WHERE user_id = $1 AND status = 'active'`,
            [req.user.id]
        );
        res.json({ hasSavedCard: Number(result.rows[0]?.total || 0) > 0 });
    } catch (error) {
        console.error('Payment method summary error:', error);
        res.status(500).json({ error: 'Failed to load payment method summary' });
    }
};

const addPaymentMethod = async (req, res) => {
    try {
        const { provider = 'stripe', cardBrand, last4, expMonth, expYear, isDefault = true } = req.body || {};
        if (!last4 || String(last4).length !== 4) {
            return res.status(400).json({ error: 'Valid last4 is required' });
        }
        const result = await query(
            `INSERT INTO user_payment_methods
             (user_id, provider, card_brand, last4, exp_month, exp_year, is_default)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, provider, card_brand, last4, exp_month, exp_year, is_default, status`,
            [req.user.id, provider, cardBrand || null, last4, expMonth || null, expYear || null, Boolean(isDefault)]
        );
        res.status(201).json({ method: result.rows[0] });
    } catch (error) {
        console.error('Add payment method error:', error);
        res.status(500).json({ error: 'Failed to add payment method' });
    }
};

module.exports = {
    listMyPaymentMethods,
    getPaymentMethodSummary,
    addPaymentMethod
};
