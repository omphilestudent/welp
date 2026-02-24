// backend/src/controllers/pricingController.js
const { query } = require('../utils/database');

// Hardcoded pricing data as fallback
const defaultPricing = {
    employee: {
        free: {
            name: "Free Employee",
            price: 0,
            currency: "USD",
            features: [
                "Unlimited company reviews",
                "Basic chat with psychologists (2 hours/day)",
                "1 video call per week (30 mins each)",
                "Access to mental health resources",
                "Anonymous posting option"
            ],
            limits: {
                chatHoursPerDay: 2,
                videoCallsPerWeek: 1,
                videoCallDuration: 30,
                assignedPsychologist: false
            }
        },
        premium: {
            name: "Premium Employee",
            price: 29.99,
            currency: "USD",
            features: [
                "Everything in Free, plus:",
                "Unlimited chat with psychologists",
                "3 video calls per week (60 mins each)",
                "Assigned personal psychologist",
                "Priority response time",
                "Weekly wellness check-ins",
                "Mental health assessment tools",
                "Crisis support line"
            ],
            limits: {
                chatHoursPerDay: -1, // unlimited
                videoCallsPerWeek: 3,
                videoCallDuration: 60,
                assignedPsychologist: true
            }
        }
    },
    psychologist: {
        free: {
            name: "Free Psychologist",
            price: 0,
            currency: "USD",
            features: [
                "Basic profile listing",
                "Receive up to 5 messages/month",
                "No lead generation",
                "Basic resources access"
            ],
            limits: {
                messagesPerMonth: 5,
                leadGeneration: false,
                assignments: false
            }
        },
        premium: {
            name: "Premium Psychologist",
            price: 49.99,
            currency: "USD",
            features: [
                "Verified psychologist badge",
                "Unlimited inbox leads",
                "Priority matching with employees",
                "Regular client assignments",
                "Analytics dashboard",
                "Schedule management tools",
                "Payment processing included",
                "Professional development resources"
            ],
            limits: {
                messagesPerMonth: -1, // unlimited
                leadGeneration: true,
                assignments: true,
                leadPriority: "high"
            }
        }
    },
    business: {
        free: {
            name: "Free Business",
            price: 0,
            currency: "USD",
            features: [
                "Basic company profile",
                "Respond to reviews",
                "Basic analytics",
                "Up to 3 team members"
            ],
            limits: {
                teamMembers: 3,
                advancedAnalytics: false,
                api_access: false
            }
        },
        premium: {
            name: "Premium Business",
            price: 99.99,
            currency: "USD",
            features: [
                "Enhanced company profile",
                "Advanced analytics dashboard",
                "Unlimited team members",
                "Employee sentiment tracking",
                "Wellness program integration",
                "API access",
                "Dedicated account manager",
                "Custom branding options",
                "Recruitment tools"
            ],
            limits: {
                teamMembers: -1, // unlimited
                advancedAnalytics: true,
                api_access: true
            }
        }
    }
};

// Country-based price multipliers and currency conversion
const countryConfig = {
    'US': { multiplier: 1.0, currency: 'USD', symbol: '$' },
    'CA': { multiplier: 0.95, currency: 'CAD', symbol: 'C$' },
    'GB': { multiplier: 0.95, currency: 'GBP', symbol: '£' },
    'DE': { multiplier: 0.95, currency: 'EUR', symbol: '€' },
    'FR': { multiplier: 0.95, currency: 'EUR', symbol: '€' },
    'IT': { multiplier: 0.9, currency: 'EUR', symbol: '€' },
    'ES': { multiplier: 0.9, currency: 'EUR', symbol: '€' },
    'NL': { multiplier: 0.95, currency: 'EUR', symbol: '€' },
    'BE': { multiplier: 0.9, currency: 'EUR', symbol: '€' },
    'CH': { multiplier: 1.1, currency: 'CHF', symbol: 'Fr' },
    'SE': { multiplier: 0.95, currency: 'SEK', symbol: 'kr' },
    'NO': { multiplier: 1.05, currency: 'NOK', symbol: 'kr' },
    'DK': { multiplier: 0.95, currency: 'DKK', symbol: 'kr' },
    'FI': { multiplier: 0.9, currency: 'EUR', symbol: '€' },
    'PT': { multiplier: 0.8, currency: 'EUR', symbol: '€' },
    'GR': { multiplier: 0.7, currency: 'EUR', symbol: '€' },
    'AU': { multiplier: 0.9, currency: 'AUD', symbol: 'A$' },
    'NZ': { multiplier: 0.85, currency: 'NZD', symbol: 'NZ$' },
    'JP': { multiplier: 0.95, currency: 'JPY', symbol: '¥' },
    'KR': { multiplier: 0.85, currency: 'KRW', symbol: '₩' },
    'SG': { multiplier: 0.9, currency: 'SGD', symbol: 'S$' },
    'CN': { multiplier: 0.6, currency: 'CNY', symbol: '¥' },
    'IN': { multiplier: 0.4, currency: 'INR', symbol: '₹' },
    'ID': { multiplier: 0.4, currency: 'IDR', symbol: 'Rp' },
    'MY': { multiplier: 0.5, currency: 'MYR', symbol: 'RM' },
    'TH': { multiplier: 0.45, currency: 'THB', symbol: '฿' },
    'VN': { multiplier: 0.35, currency: 'VND', symbol: '₫' },
    'PH': { multiplier: 0.35, currency: 'PHP', symbol: '₱' },
    'ZA': { multiplier: 0.5, currency: 'ZAR', symbol: 'R' },
    'NG': { multiplier: 0.35, currency: 'NGN', symbol: '₦' },
    'KE': { multiplier: 0.35, currency: 'KES', symbol: 'KSh' },
    'EG': { multiplier: 0.4, currency: 'EGP', symbol: 'E£' },
    'MA': { multiplier: 0.4, currency: 'MAD', symbol: 'DH' },
    'GH': { multiplier: 0.3, currency: 'GHS', symbol: 'GH₵' },
    'TZ': { multiplier: 0.3, currency: 'TZS', symbol: 'TSh' },
    'UG': { multiplier: 0.3, currency: 'UGX', symbol: 'USh' },
    'BR': { multiplier: 0.6, currency: 'BRL', symbol: 'R$' },
    'AR': { multiplier: 0.45, currency: 'ARS', symbol: '$' },
    'CL': { multiplier: 0.6, currency: 'CLP', symbol: '$' },
    'CO': { multiplier: 0.45, currency: 'COP', symbol: '$' },
    'PE': { multiplier: 0.4, currency: 'PEN', symbol: 'S/' },
    'MX': { multiplier: 0.7, currency: 'MXN', symbol: '$' },
    'AE': { multiplier: 0.9, currency: 'AED', symbol: 'د.إ' },
    'SA': { multiplier: 0.8, currency: 'SAR', symbol: '﷼' },
    'IL': { multiplier: 0.85, currency: 'ILS', symbol: '₪' },
    'TR': { multiplier: 0.6, currency: 'TRY', symbol: '₺' },
    'QA': { multiplier: 1.0, currency: 'QAR', symbol: 'ر.ق' },
    'KW': { multiplier: 0.9, currency: 'KWD', symbol: 'د.ك' }
};

// Currency conversion rates (as of 2024, approximate)
const currencyRates = {
    'USD': 1.0,
    'EUR': 0.92,
    'GBP': 0.79,
    'JPY': 150.0,
    'CAD': 1.35,
    'AUD': 1.52,
    'CHF': 0.89,
    'CNY': 7.20,
    'INR': 83.0,
    'BRL': 5.05,
    'ZAR': 18.50,
    'NGN': 1500.0,
    'KES': 145.0,
    'MXN': 17.0,
    'SGD': 1.35,
    'NZD': 1.64,
    'SEK': 10.5,
    'NOK': 10.7,
    'DKK': 6.9,
    'PLN': 4.0,
    'CZK': 23.0,
    'HUF': 360.0,
    'ILS': 3.7,
    'AED': 3.67,
    'SAR': 3.75,
    'TRY': 32.0,
    'KRW': 1350.0,
    'IDR': 15700.0,
    'MYR': 4.75,
    'THB': 36.0,
    'VND': 25000.0,
    'PHP': 56.0,
    'EGP': 47.0,
    'MAD': 10.1,
    'GHS': 13.5,
    'TZS': 2550.0,
    'UGX': 3850.0,
    'ARS': 850.0,
    'CLP': 950.0,
    'COP': 3900.0,
    'PEN': 3.75,
    'QAR': 3.64,
    'KWD': 0.31
};

// Get pricing based on user role and country
const getPricing = async (req, res) => {
    try {
        const { role, country } = req.query;

        console.log('Fetching pricing for:', { role, country });

        // Get country configuration
        const countryCode = country?.toUpperCase() || 'US';
        const config = countryConfig[countryCode] || countryConfig['US'];

        // Get multiplier and currency
        const multiplier = config.multiplier;
        const targetCurrency = config.currency;

        // Create a deep copy of default pricing
        const pricing = JSON.parse(JSON.stringify(defaultPricing));

        // Apply country adjustments to prices
        if (role && pricing[role]) {
            const rolePricing = { ...pricing[role] };

            // Adjust premium prices
            if (rolePricing.premium) {
                // First apply country multiplier
                const priceInUSD = Math.round(rolePricing.premium.price * multiplier * 100) / 100;

                // Convert to local currency
                const conversionRate = currencyRates[targetCurrency] || 1.0;
                const localPrice = Math.round(priceInUSD * conversionRate * 100) / 100;

                rolePricing.premium = {
                    ...rolePricing.premium,
                    price: localPrice,
                    originalPriceUSD: defaultPricing[role].premium.price,
                    multiplier: multiplier,
                    country: countryCode,
                    currency: targetCurrency,
                    symbol: config.symbol,
                    conversionRate: conversionRate
                };
            }

            // Add country info to free plan
            if (rolePricing.free) {
                rolePricing.free = {
                    ...rolePricing.free,
                    country: countryCode,
                    multiplier: multiplier,
                    currency: targetCurrency,
                    symbol: config.symbol
                };
            }

            console.log('Sending role pricing:', rolePricing);
            return res.json(rolePricing);
        }

        // Return all pricing with country adjustments
        const adjustedPricing = {};
        for (const [roleKey, roleValue] of Object.entries(pricing)) {
            adjustedPricing[roleKey] = {
                free: {
                    ...roleValue.free,
                    country: countryCode,
                    multiplier: multiplier,
                    currency: targetCurrency,
                    symbol: config.symbol
                },
                premium: roleValue.premium ? {
                    ...roleValue.premium,
                    price: Math.round(roleValue.premium.price * multiplier * (currencyRates[targetCurrency] || 1) * 100) / 100,
                    originalPriceUSD: roleValue.premium.price,
                    multiplier: multiplier,
                    country: countryCode,
                    currency: targetCurrency,
                    symbol: config.symbol,
                    conversionRate: currencyRates[targetCurrency] || 1
                } : null
            };
        }

        console.log('Sending all pricing:', adjustedPricing);
        res.json(adjustedPricing);
    } catch (error) {
        console.error('Get pricing error:', error);
        // Return default pricing even on error
        res.json(defaultPricing);
    }
};

// Get country list for pricing with currency info
const getCountries = async (req, res) => {
    const countries = Object.entries(countryConfig).map(([code, config]) => ({
        code,
        name: getCountryName(code),
        currency: config.currency,
        symbol: config.symbol,
        multiplier: config.multiplier
    })).sort((a, b) => a.name.localeCompare(b.name));

    res.json(countries);
};

// Helper function to get country names
function getCountryName(code) {
    const names = {
        'US': 'United States',
        'CA': 'Canada',
        'GB': 'United Kingdom',
        'DE': 'Germany',
        'FR': 'France',
        'IT': 'Italy',
        'ES': 'Spain',
        'NL': 'Netherlands',
        'BE': 'Belgium',
        'CH': 'Switzerland',
        'SE': 'Sweden',
        'NO': 'Norway',
        'DK': 'Denmark',
        'FI': 'Finland',
        'PT': 'Portugal',
        'GR': 'Greece',
        'AU': 'Australia',
        'NZ': 'New Zealand',
        'JP': 'Japan',
        'KR': 'South Korea',
        'SG': 'Singapore',
        'CN': 'China',
        'IN': 'India',
        'ID': 'Indonesia',
        'MY': 'Malaysia',
        'TH': 'Thailand',
        'VN': 'Vietnam',
        'PH': 'Philippines',
        'ZA': 'South Africa',
        'NG': 'Nigeria',
        'KE': 'Kenya',
        'EG': 'Egypt',
        'MA': 'Morocco',
        'GH': 'Ghana',
        'TZ': 'Tanzania',
        'UG': 'Uganda',
        'BR': 'Brazil',
        'AR': 'Argentina',
        'CL': 'Chile',
        'CO': 'Colombia',
        'PE': 'Peru',
        'MX': 'Mexico',
        'AE': 'United Arab Emirates',
        'SA': 'Saudi Arabia',
        'IL': 'Israel',
        'TR': 'Turkey',
        'QA': 'Qatar',
        'KW': 'Kuwait'
    };
    return names[code] || code;
}

// Create subscription
const createSubscription = async (req, res) => {
    try {
        const { plan, role, country, paymentMethod } = req.body;

        // Get pricing to verify amount
        const config = countryConfig[country?.toUpperCase()] || countryConfig['US'];
        const multiplier = config.multiplier;
        const targetCurrency = config.currency;
        const conversionRate = currencyRates[targetCurrency] || 1.0;

        const basePrice = defaultPricing[role]?.[plan]?.price || 0;
        const priceInUSD = Math.round(basePrice * multiplier * 100) / 100;
        const localPrice = Math.round(priceInUSD * conversionRate * 100) / 100;

        // Create subscriptions table if not exists
        await query(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                plan VARCHAR(50) NOT NULL,
                role VARCHAR(50) NOT NULL,
                country VARCHAR(10),
                price DECIMAL(10,2),
                currency VARCHAR(10),
                status VARCHAR(50) DEFAULT 'active',
                start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                end_date TIMESTAMP,
                payment_method JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create subscription
        const result = await query(
            `INSERT INTO subscriptions (
                user_id, plan, role, country, price, currency, payment_method
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
                req.user.id, plan, role, country, localPrice, targetCurrency,
                paymentMethod ? JSON.stringify(paymentMethod) : null
            ]
        );

        // Update user's subscription tier
        await query(
            `UPDATE users 
             SET subscription_tier = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $2`,
            [plan === 'premium' ? 'premium' : 'free', req.user.id]
        );

        res.status(201).json({
            message: 'Subscription created successfully',
            subscription: result.rows[0]
        });
    } catch (error) {
        console.error('Create subscription error:', error);
        res.status(500).json({ error: 'Failed to create subscription' });
    }
};

// Get user's subscription
const getMySubscription = async (req, res) => {
    try {
        const result = await query(
            `SELECT * FROM subscriptions 
             WHERE user_id = $1 AND status = 'active'
             ORDER BY created_at DESC
             LIMIT 1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            // Check user's subscription tier from users table
            const userResult = await query(
                'SELECT subscription_tier FROM users WHERE id = $1',
                [req.user.id]
            );

            return res.json({
                plan: userResult.rows[0]?.subscription_tier || 'free',
                status: 'active',
                message: 'No active subscription'
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ error: 'Failed to fetch subscription' });
    }
};

// Cancel subscription
const cancelSubscription = async (req, res) => {
    try {
        const { subscriptionId } = req.params;

        await query(
            `UPDATE subscriptions 
             SET status = 'cancelled', end_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND user_id = $2`,
            [subscriptionId, req.user.id]
        );

        await query(
            'UPDATE users SET subscription_tier = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            ['free', req.user.id]
        );

        res.json({ message: 'Subscription cancelled successfully' });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ error: 'Failed to cancel subscription' });
    }
};

module.exports = {
    getPricing,
    getCountries,
    createSubscription,
    getMySubscription,
    cancelSubscription
};