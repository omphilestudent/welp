const pricingService = require('../services/pricingService');
const database = require('../utils/database');

const AUDIENCES = ['user', 'psychologist', 'business'];

const getAllPricing = async (req, res) => {
    try {
        const { currency, country } = req.query;
        const response = {};
        for (const audience of AUDIENCES) {
            response[audience] = await pricingService.getAudiencePricing(audience, { currency, country });
        }
        res.json(response);
    } catch (error) {
        console.error('Get pricing error:', error);
        res.status(500).json({ error: 'Failed to load pricing catalog' });
    }
};

const getPricingForAudience = async (req, res) => {
    try {
        const { currency, country } = req.query;
        const audience = req.params.audience || 'user';
        const pricing = await pricingService.getAudiencePricing(audience, { currency, country });
        if (!pricing.plans.length) {
            return res.status(404).json({ error: 'No pricing found for requested audience' });
        }
        res.json(pricing);
    } catch (error) {
        console.error('Get audience pricing error:', error);
        res.status(500).json({ error: 'Failed to load pricing for audience' });
    }
};

const getCountries = async (req, res) => {
    try {
        const countries = await pricingService.listCountryPricing();
        res.json(countries);
    } catch (error) {
        console.error('Get countries error:', error);
        res.status(500).json({ error: 'Failed to load country pricing' });
    }
};

const getCountryPricing = async (req, res) => {
    try {
        const result = await database.query(
            `SELECT *
             FROM subscription_pricing_by_country
             ORDER BY country_name`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching country pricing:', error);
        res.status(500).json({ error: 'Failed to fetch pricing' });
    }
};

const updateBasePrices = async (req, res) => {
    try {
        const { client, psychologist, business_base, business_enhanced, business_premium } = req.body;

        await database.query(
            `INSERT INTO system_settings (key, value, updated_at)
             VALUES 
                ('base_price_client', $1, NOW()),
                ('base_price_psychologist', $2, NOW()),
                ('base_price_business_base', $3, NOW()),
                ('base_price_business_enhanced', $4, NOW()),
                ('base_price_business_premium', $5, NOW())
             ON CONFLICT (key) DO UPDATE 
             SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
            [client, psychologist, business_base, business_enhanced, business_premium]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating base prices:', error);
        res.status(500).json({ error: 'Failed to update base prices' });
    }
};

const recalculateAllPrices = async (req, res) => {
    try {
        const basePrices = await database.query(
            `SELECT key, value
             FROM system_settings
             WHERE key LIKE 'base_price_%'`
        );

        const prices = {};
        basePrices.rows.forEach((row) => {
            prices[row.key] = parseFloat(row.value);
        });

        await database.query(
            `UPDATE subscription_pricing_by_country 
             SET 
                client_paid_monthly_zar = ROUND($1 * multiplier, 2),
                psychologist_monthly_zar = ROUND($2 * multiplier, 2),
                business_base_monthly_zar = ROUND($3 * multiplier, 2),
                business_enhanced_monthly_zar = ROUND($4 * multiplier, 2),
                business_premium_monthly_zar = ROUND($5 * multiplier, 2),
                updated_at = NOW()`,
            [
                prices.base_price_client || 150,
                prices.base_price_psychologist || 500,
                prices.base_price_business_base || 1000,
                prices.base_price_business_enhanced || 2000,
                prices.base_price_business_premium || 3000
            ]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error recalculating prices:', error);
        res.status(500).json({ error: 'Failed to recalculate prices' });
    }
};

const updateCountryPricing = async (req, res) => {
    try {
        const { countryCode } = req.params;
        const {
            multiplier,
            clientPrice,
            psychologistPrice,
            businessBasePrice,
            businessEnhancedPrice,
            businessPremiumPrice,
            currencyCode
        } = req.body;

        await database.query(
            `UPDATE subscription_pricing_by_country 
             SET 
                multiplier = $1,
                client_paid_monthly_zar = $2,
                psychologist_monthly_zar = $3,
                business_base_monthly_zar = $4,
                business_enhanced_monthly_zar = $5,
                business_premium_monthly_zar = $6,
                currency_code = $7,
                updated_at = NOW()
             WHERE country_code = $8`,
            [
                multiplier,
                clientPrice,
                psychologistPrice,
                businessBasePrice,
                businessEnhancedPrice,
                businessPremiumPrice,
                currencyCode,
                countryCode
            ]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating country pricing:', error);
        res.status(500).json({ error: 'Failed to update country pricing' });
    }
};

const addCountry = async (req, res) => {
    try {
        const { countryCode, countryName, multiplier, currencyCode } = req.body;

        const basePrices = await database.query(
            `SELECT key, value
             FROM system_settings
             WHERE key LIKE 'base_price_%'`
        );

        const prices = {};
        basePrices.rows.forEach((row) => {
            prices[row.key] = parseFloat(row.value);
        });

        await database.query(
            `INSERT INTO subscription_pricing_by_country (
                country_code,
                country_name,
                multiplier,
                client_paid_monthly_zar,
                psychologist_monthly_zar,
                business_base_monthly_zar,
                business_enhanced_monthly_zar,
                business_premium_monthly_zar,
                currency_code,
                updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
            [
                countryCode,
                countryName,
                multiplier,
                (prices.base_price_client || 150) * multiplier,
                (prices.base_price_psychologist || 500) * multiplier,
                (prices.base_price_business_base || 1000) * multiplier,
                (prices.base_price_business_enhanced || 2000) * multiplier,
                (prices.base_price_business_premium || 3000) * multiplier,
                currencyCode
            ]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error adding country:', error);
        res.status(500).json({ error: 'Failed to add country' });
    }
};

const deleteCountry = async (req, res) => {
    try {
        const { countryCode } = req.params;

        await database.query(
            `DELETE FROM subscription_pricing_by_country
             WHERE country_code = $1`,
            [countryCode]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting country:', error);
        res.status(500).json({ error: 'Failed to delete country' });
    }
};

const bulkUpdatePricing = async (req, res) => {
    try {
        const { countryCodes, multiplier } = req.body;

        const basePrices = await database.query(
            `SELECT key, value
             FROM system_settings
             WHERE key LIKE 'base_price_%'`
        );

        const prices = {};
        basePrices.rows.forEach((row) => {
            prices[row.key] = parseFloat(row.value);
        });

        await database.query(
            `UPDATE subscription_pricing_by_country 
             SET 
                multiplier = $1,
                client_paid_monthly_zar = ROUND($2 * $1, 2),
                psychologist_monthly_zar = ROUND($3 * $1, 2),
                business_base_monthly_zar = ROUND($4 * $1, 2),
                business_enhanced_monthly_zar = ROUND($5 * $1, 2),
                business_premium_monthly_zar = ROUND($6 * $1, 2),
                updated_at = NOW()
             WHERE country_code = ANY($7::text[])`,
            [
                multiplier,
                prices.base_price_client || 150,
                prices.base_price_psychologist || 500,
                prices.base_price_business_base || 1000,
                prices.base_price_business_enhanced || 2000,
                prices.base_price_business_premium || 3000,
                countryCodes
            ]
        );

        res.json({ success: true, updated: countryCodes.length });
    } catch (error) {
        console.error('Error in bulk update:', error);
        res.status(500).json({ error: 'Failed to bulk update pricing' });
    }
};

module.exports = {
    getPricing: getAllPricing,
    getPricingForAudience,
    getCountries,
    getCountryPricing,
    updateBasePrices,
    recalculateAllPrices,
    updateCountryPricing,
    addCountry,
    deleteCountry,
    bulkUpdatePricing
};
