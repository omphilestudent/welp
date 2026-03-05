
const { query } = require('../utils/database');


const initSubscriptions = async () => {
    await query(`
        CREATE TABLE IF NOT EXISTS subscriptions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            plan_type VARCHAR(50) NOT NULL CHECK (plan_type IN ('free', 'premium')),
            role VARCHAR(50) NOT NULL,
            country_code VARCHAR(2) NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            currency_symbol VARCHAR(5) NOT NULL,
            currency_code VARCHAR(3) NOT NULL,

            -- Employee benefits
            chat_hours_per_day INT,
            video_calls_per_week INT,
            assigned_psychologist_id UUID REFERENCES users(id),

            -- Psychologist benefits
            leads_per_month INT,
            accepts_assignments BOOLEAN DEFAULT false,

            start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            end_date TIMESTAMP,
            auto_renew BOOLEAN DEFAULT true,
            status VARCHAR(50) DEFAULT 'active',

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log('✅ Subscriptions table initialized');
};

initSubscriptions();


const subscribePremium = async (req, res) => {
    try {
        const { planType, countryCode, autoRenew = true } = req.body;


        const pricing = await query(
            'SELECT * FROM pricing WHERE country_code = $1',
            [countryCode]
        );

        if (pricing.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid country code' });
        }

        const price = req.user.role === 'employee'
            ? pricing.rows[0].employee_premium_price
            : pricing.rows[0].psychologist_premium_price;


        const existing = await query(
            `SELECT * FROM subscriptions
             WHERE user_id = $1 AND status = 'active'`,
            [req.user.id]
        );

        if (existing.rows.length > 0) {

            await query(
                `UPDATE subscriptions
                 SET plan_type = $1,
                     price = $2,
                     country_code = $3,
                     auto_renew = $4,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $5`,
                [planType, price, countryCode, autoRenew, req.user.id]
            );
        } else {

            await query(
                `INSERT INTO subscriptions (
                    user_id, plan_type, role, country_code,
                    price, currency_symbol, currency_code, auto_renew
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    req.user.id, planType, req.user.role, countryCode,
                    price, pricing.rows[0].currency_symbol,
                    pricing.rows[0].currency_code, autoRenew
                ]
            );
        }

        res.json({
            message: 'Successfully subscribed to premium plan',
            plan: planType,
            price: `${pricing.rows[0].currency_symbol}${price}`,
            nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });
    } catch (error) {
        console.error('Subscribe premium error:', error);
        res.status(500).json({ error: 'Failed to process subscription' });
    }
};


const getMySubscription = async (req, res) => {
    try {
        const result = await query(
            `SELECT * FROM subscriptions WHERE user_id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {

            const pricing = await query(
                'SELECT * FROM pricing WHERE country_code = $1',
                ['US']
            );

            return res.json({
                plan_type: 'free',
                chat_hours_per_day: 2,
                video_calls_per_week: 1,
                leads_per_month: req.user.role === 'psychologist' ? 0 : null,
                accepts_assignments: false
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ error: 'Failed to fetch subscription' });
    }
};


const cancelSubscription = async (req, res) => {
    try {
        await query(
            `UPDATE subscriptions
             SET status = 'cancelled', auto_renew = false
             WHERE user_id = $1`,
            [req.user.id]
        );

        res.json({ message: 'Subscription cancelled successfully' });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ error: 'Failed to cancel subscription' });
    }
};

module.exports = {
    subscribePremium,
    getMySubscription,
    cancelSubscription
};