const database = require('../utils/database');
const query = (...args) => database.query(...args);

const DEFAULT_CURRENCY = (process.env.DEFAULT_CURRENCY || 'USD').toUpperCase();
const CURRENCY_CACHE_TTL_MS = Number(process.env.CURRENCY_CACHE_TTL_MS || 300_000);
const COUNTRY_CACHE_TTL_MS = Number(process.env.COUNTRY_PREFERENCE_CACHE_TTL_MS || 600_000);
const COUNTRY_LIST_CACHE_TTL_MS = Number(process.env.COUNTRY_LIST_CACHE_TTL_MS || 300_000);

const AUDIENCE_ALIASES = {
    employee: 'user',
    employees: 'user',
    user: 'user',
    users: 'user',
    consumer: 'user',
    consumers: 'user',
    psychologist: 'psychologist',
    psychologists: 'psychologist',
    therapist: 'psychologist',
    therapists: 'psychologist',
    business: 'business',
    businesses: 'business',
    enterprise: 'business'
};

const FALLBACK_COUNTRY_PRICING = {
    US: { multiplier: 1.0, currency: 'USD' },
    CA: { multiplier: 0.95, currency: 'CAD' },
    GB: { multiplier: 0.95, currency: 'GBP' },
    IE: { multiplier: 0.95, currency: 'EUR' },
    DE: { multiplier: 0.95, currency: 'EUR' },
    FR: { multiplier: 0.95, currency: 'EUR' },
    IT: { multiplier: 0.9, currency: 'EUR' },
    ES: { multiplier: 0.9, currency: 'EUR' },
    NL: { multiplier: 0.95, currency: 'EUR' },
    BE: { multiplier: 0.9, currency: 'EUR' },
    CH: { multiplier: 1.1, currency: 'CHF' },
    SE: { multiplier: 0.95, currency: 'SEK' },
    NO: { multiplier: 1.05, currency: 'NOK' },
    DK: { multiplier: 0.95, currency: 'DKK' },
    FI: { multiplier: 0.9, currency: 'EUR' },
    PT: { multiplier: 0.8, currency: 'EUR' },
    GR: { multiplier: 0.7, currency: 'EUR' },
    AU: { multiplier: 0.9, currency: 'AUD' },
    NZ: { multiplier: 0.85, currency: 'NZD' },
    JP: { multiplier: 0.95, currency: 'JPY' },
    KR: { multiplier: 0.85, currency: 'KRW' },
    SG: { multiplier: 0.9, currency: 'SGD' },
    CN: { multiplier: 0.6, currency: 'CNY' },
    IN: { multiplier: 0.4, currency: 'INR' },
    ID: { multiplier: 0.4, currency: 'IDR' },
    MY: { multiplier: 0.5, currency: 'MYR' },
    TH: { multiplier: 0.45, currency: 'THB' },
    VN: { multiplier: 0.35, currency: 'VND' },
    PH: { multiplier: 0.35, currency: 'PHP' },
    ZA: { multiplier: 0.5, currency: 'ZAR' },
    NG: { multiplier: 0.35, currency: 'NGN' },
    KE: { multiplier: 0.35, currency: 'KES' },
    EG: { multiplier: 0.4, currency: 'EGP' },
    MA: { multiplier: 0.4, currency: 'MAD' },
    GH: { multiplier: 0.3, currency: 'GHS' },
    TZ: { multiplier: 0.3, currency: 'TZS' },
    UG: { multiplier: 0.3, currency: 'UGX' },
    BR: { multiplier: 0.6, currency: 'BRL' },
    AR: { multiplier: 0.45, currency: 'ARS' },
    CL: { multiplier: 0.6, currency: 'CLP' },
    CO: { multiplier: 0.45, currency: 'COP' },
    PE: { multiplier: 0.4, currency: 'PEN' },
    MX: { multiplier: 0.7, currency: 'MXN' },
    AE: { multiplier: 0.9, currency: 'AED' },
    SA: { multiplier: 0.8, currency: 'SAR' },
    IL: { multiplier: 0.85, currency: 'ILS' },
    TR: { multiplier: 0.6, currency: 'TRY' },
    QA: { multiplier: 1.0, currency: 'QAR' },
    KW: { multiplier: 0.9, currency: 'KWD' }
};

const COUNTRY_NAME_FALLBACKS = {
    US: 'United States',
    CA: 'Canada',
    GB: 'United Kingdom',
    IE: 'Ireland',
    DE: 'Germany',
    FR: 'France',
    IT: 'Italy',
    ES: 'Spain',
    NL: 'Netherlands',
    BE: 'Belgium',
    CH: 'Switzerland',
    SE: 'Sweden',
    NO: 'Norway',
    DK: 'Denmark',
    FI: 'Finland',
    PT: 'Portugal',
    GR: 'Greece',
    AU: 'Australia',
    NZ: 'New Zealand',
    JP: 'Japan',
    KR: 'South Korea',
    SG: 'Singapore',
    CN: 'China',
    IN: 'India',
    ID: 'Indonesia',
    MY: 'Malaysia',
    TH: 'Thailand',
    VN: 'Vietnam',
    PH: 'Philippines',
    ZA: 'South Africa',
    NG: 'Nigeria',
    KE: 'Kenya',
    EG: 'Egypt',
    MA: 'Morocco',
    GH: 'Ghana',
    TZ: 'Tanzania',
    UG: 'Uganda',
    BR: 'Brazil',
    AR: 'Argentina',
    CL: 'Chile',
    CO: 'Colombia',
    PE: 'Peru',
    MX: 'Mexico',
    AE: 'United Arab Emirates',
    SA: 'Saudi Arabia',
    IL: 'Israel',
    TR: 'Turkey',
    QA: 'Qatar',
    KW: 'Kuwait'
};

const BLUEPRINT_BASE_CURRENCY = 'ZAR';
const DEFAULT_PLAN_BLUEPRINTS = {
    user: [
        {
            planCode: 'user_free',
            planTier: 'free',
            amountMinor: 0,
            displayName: 'Free Plan',
            features: [
                '30 minutes psychologist chat per day',
                'Unlimited business reviews',
                'Random psychologist assignment',
                'No video call discounts'
            ],
            limits: {
                chat: { minutesPerDay: 30 },
                reviews: { unlimited: true },
                perks: { choosePsychologist: false }
            },
            isDefault: true
        },
        {
            planCode: 'user_premium',
            planTier: 'premium',
            amountMinor: 15000,
            displayName: 'Premium Plan',
            badge: 'Best value',
            features: [
                'Priority psychologist access',
                'Unlimited chat support',
                'Video/voice scheduling',
                'Weekly wellbeing reports',
                'Crisis escalation hotline',
                'Ability to choose your psychologist'
            ],
            limits: {
                chat: { minutesPerDay: 120 },
                call: { minutesPerDay: 120 },
                video: { sessionsPerWeek: 3, minutesPerSession: 60, discount: 20 }
            }
        }
    ],
    psychologist: [
        {
            planCode: 'psychologist_standard',
            planTier: 'premium',
            amountMinor: 50000,
            displayName: 'Psychologist Partner',
            features: [
                'Client matching based on specialization',
                'Priority access to paying clients',
                'Video call scheduling tools',
                'Calendar integration',
                'Analytics dashboard',
                'Marketing exposure',
                'Verified client reviews',
                'API keys for CRM integration'
            ],
            limits: {
                leads: { priority: true },
                analytics: { level: 'advanced' }
            },
            isDefault: true
        }
    ],
    business: [
        {
            planCode: 'business_free_tier',
            planTier: 'free_tier',
            amountMinor: 0,
            displayName: 'Free Tier',
            features: [
                'Business profile access',
                'Respond to reviews',
                'API keys included',
                '100 API calls per day'
            ],
            limits: {
                api: { callsPerDay: 100 },
                ads: { maxActive: 0, analytics: 'none' },
                analytics: { level: 'none' }
            },
            isDefault: true
        },
        {
            planCode: 'business_base',
            planTier: 'base',
            amountMinor: 100000,
            displayName: 'Base Plan',
            features: [
                '1,000 API calls per day',
                'Business profile access',
                'Basic analytics'
            ],
            limits: {
                api: { callsPerDay: 1000 },
                ads: { maxActive: 1, analytics: 'limited' }
            },
            isDefault: false
        },
        {
            planCode: 'business_enhanced',
            planTier: 'enhanced',
            amountMinor: 200000,
            displayName: 'Enhanced Plan',
            features: [
                '3,000 API calls per day',
                'Expanded analytics',
                'Marketing insights',
                'Upload promotional media'
            ],
            limits: {
                api: { callsPerDay: 3000 },
                ads: { maxActive: 5, analytics: 'standard' }
            },
            badge: 'Growth'
        },
        {
            planCode: 'business_premium',
            planTier: 'premium',
            amountMinor: 300000,
            displayName: 'Premium Plan',
            features: [
                '10,000 API calls per day',
                'Advanced analytics',
                'Email insights on user behavior',
                'Advertisement capabilities',
                'Advertise on other business pages',
                'Priority campaign support'
            ],
            limits: {
                api: { callsPerDay: 10000 },
                ads: { maxActive: null, analytics: 'advanced' },
                email: { insights: true }
            },
            badge: 'Premium'
        }
    ]
};

const currencyCache = new Map();
const countryPreferenceCache = new Map();
let countryListCache = { data: null, expiresAt: 0 };
let countryTableMissing = false;
let subscriptionCountryTableMissing = false;

const SUBSCRIPTION_COUNTRY_BASE_QUERY = `
    SELECT sp.country_code,
           sp.country_name,
           sp.multiplier,
           sp.currency_code,
           sp.client_paid_monthly_zar,
           sp.psychologist_monthly_zar,
           sp.business_base_monthly_zar,
           sp.business_enhanced_monthly_zar,
           sp.business_premium_monthly_zar,
           c.symbol AS currency_symbol
    FROM subscription_pricing_by_country sp
    LEFT JOIN currencies c ON c.code = sp.currency_code
`;

const mapSubscriptionCountryRow = (row) => {
    if (!row) return null;
    const code = row.country_code ? row.country_code.toUpperCase() : null;
    if (!code) return null;
    const currencyCode = (row.currency_code || DEFAULT_CURRENCY).toUpperCase();
    const multiplier = Number(row.multiplier) || 1;
    return {
        code,
        name: row.country_name || COUNTRY_NAME_FALLBACKS[code] || code,
        multiplier,
        currency: currencyCode,
        currencySymbol: row.currency_symbol || null,
        prices: {
            client: row.client_paid_monthly_zar != null ? Number(row.client_paid_monthly_zar) : null,
            psychologist: row.psychologist_monthly_zar != null ? Number(row.psychologist_monthly_zar) : null,
            businessBase: row.business_base_monthly_zar != null ? Number(row.business_base_monthly_zar) : null,
            businessEnhanced: row.business_enhanced_monthly_zar != null ? Number(row.business_enhanced_monthly_zar) : null,
            businessPremium: row.business_premium_monthly_zar != null ? Number(row.business_premium_monthly_zar) : null
        },
        source: 'subscription'
    };
};

const fetchSubscriptionCountryRecord = async (code) => {
    if (subscriptionCountryTableMissing || !code) {
        return null;
    }
    try {
        const { rows } = await query(
            `${SUBSCRIPTION_COUNTRY_BASE_QUERY}
             WHERE UPPER(sp.country_code) = $1
             LIMIT 1`,
            [code]
        );
        if (rows.length) {
            return mapSubscriptionCountryRow(rows[0]);
        }
    } catch (error) {
        if (error?.code === '42P01') {
            subscriptionCountryTableMissing = true;
        } else {
            console.warn('Subscription country pricing lookup failed:', error.message);
        }
    }
    return null;
};

const fetchSubscriptionCountryList = async () => {
    if (subscriptionCountryTableMissing) {
        return null;
    }
    try {
        const { rows } = await query(
            `${SUBSCRIPTION_COUNTRY_BASE_QUERY}
             ORDER BY sp.country_name ASC`
        );
        if (rows.length === 0) {
            return [];
        }
        return rows.map(mapSubscriptionCountryRow).filter(Boolean);
    } catch (error) {
        if (error?.code === '42P01') {
            subscriptionCountryTableMissing = true;
        } else {
            console.warn('Subscription country pricing catalog lookup failed:', error.message);
        }
        return null;
    }
};

const buildFallbackCountryEntry = (code) => {
    if (!code) return null;
    const normalized = code.toUpperCase();
    const fallback = FALLBACK_COUNTRY_PRICING[normalized];
    if (!fallback) return null;
    return {
        code: normalized,
        name: COUNTRY_NAME_FALLBACKS[normalized] || normalized,
        multiplier: fallback.multiplier ?? 1,
        currency: (fallback.currency || DEFAULT_CURRENCY).toUpperCase(),
        currencySymbol: fallback.currency_symbol || null,
        source: 'fallback'
    };
};

const buildFallbackCountryList = () =>
    Object.entries(FALLBACK_COUNTRY_PRICING)
        .map(([code, config]) => ({
            code,
            name: COUNTRY_NAME_FALLBACKS[code] || code,
            currency: (config.currency || DEFAULT_CURRENCY).toUpperCase(),
            currencySymbol: config.currency_symbol || null,
            multiplier: config.multiplier ?? 1
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

const getCountryPreferenceRecord = async (countryCode) => {
    if (!countryCode) return null;
    const normalized = countryCode.toUpperCase();
    const cached = countryPreferenceCache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
    }
    const subscriptionRecord = await fetchSubscriptionCountryRecord(normalized);
    if (subscriptionRecord) {
        countryPreferenceCache.set(normalized, {
            value: subscriptionRecord,
            expiresAt: Date.now() + COUNTRY_CACHE_TTL_MS
        });
        return subscriptionRecord;
    }
    if (!countryTableMissing) {
        try {
            const { rows } = await query(
                `SELECT country_code, country_name, multiplier, currency, currency_symbol
                 FROM country_pricing
                 WHERE UPPER(country_code) = $1
                   AND is_active = true
                 LIMIT 1`,
                [normalized]
            );
            if (rows.length) {
                const record = {
                    code: normalized,
                    name: rows[0].country_name || COUNTRY_NAME_FALLBACKS[normalized] || normalized,
                    multiplier: Number(rows[0].multiplier) || 1,
                    currency: (rows[0].currency || DEFAULT_CURRENCY).toUpperCase(),
                    currencySymbol: rows[0].currency_symbol || null,
                    source: 'db'
                };
                countryPreferenceCache.set(normalized, {
                    value: record,
                    expiresAt: Date.now() + COUNTRY_CACHE_TTL_MS
                });
                return record;
            }
        } catch (error) {
            if (error?.code === '42P01') {
                countryTableMissing = true;
            } else {
                console.warn('Country pricing lookup failed:', error.message);
            }
        }
    }
    const fallback = buildFallbackCountryEntry(normalized);
    if (fallback) {
        countryPreferenceCache.set(normalized, {
            value: fallback,
            expiresAt: Date.now() + COUNTRY_CACHE_TTL_MS
        });
    }
    return fallback;
};

const listCountryPricing = async () => {
    if (countryListCache.data && countryListCache.expiresAt > Date.now()) {
        return countryListCache.data;
    }
    const subscriptionList = await fetchSubscriptionCountryList();
    if (Array.isArray(subscriptionList) && subscriptionList.length) {
        countryListCache = {
            data: subscriptionList,
            expiresAt: Date.now() + COUNTRY_LIST_CACHE_TTL_MS
        };
        return subscriptionList;
    }
    if (!countryTableMissing) {
        try {
            const { rows } = await query(
                `SELECT country_code, country_name, multiplier, currency, currency_symbol
                 FROM country_pricing
                 WHERE is_active = true
                 ORDER BY country_name ASC`
            );
            if (rows.length) {
                const mapped = rows.map((row) => ({
                    code: row.country_code.toUpperCase(),
                    name: row.country_name || COUNTRY_NAME_FALLBACKS[row.country_code] || row.country_code,
                    currency: (row.currency || DEFAULT_CURRENCY).toUpperCase(),
                    currencySymbol: row.currency_symbol || null,
                    multiplier: Number(row.multiplier) || 1
                }));
                countryListCache = {
                    data: mapped,
                    expiresAt: Date.now() + COUNTRY_LIST_CACHE_TTL_MS
                };
                return mapped;
            }
        } catch (error) {
            if (error?.code === '42P01') {
                countryTableMissing = true;
            } else {
                console.warn('Country pricing catalog lookup failed:', error.message);
            }
        }
    }
    const fallbackList = buildFallbackCountryList();
    countryListCache = {
        data: fallbackList,
        expiresAt: Date.now() + COUNTRY_LIST_CACHE_TTL_MS
    };
    return fallbackList;
};

const parseJson = (raw, fallback) => {
    if (raw === null || raw === undefined) return fallback;
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch {
            return fallback;
        }
    }
    if (Array.isArray(fallback) && Array.isArray(raw)) return raw;
    if (!Array.isArray(fallback) && typeof raw === 'object') return raw;
    return fallback;
};

const normalizeAudience = (input) => {
    if (!input) return 'user';
    const lower = String(input).toLowerCase();
    return AUDIENCE_ALIASES[lower] || lower;
};

const formatPrice = (amountMinor, symbol = '$') => {
    const amount = Number(amountMinor || 0) / 100;
    return `${symbol}${amount.toFixed(2)}`;
};

const resolveCountryPreference = async (countryCode, explicitCurrency) => {
    const normalizedCountry = countryCode ? countryCode.toUpperCase() : null;
    const preference = normalizedCountry ? await getCountryPreferenceRecord(normalizedCountry) : null;
    const currencyCode = (explicitCurrency || preference?.currency || DEFAULT_CURRENCY).toUpperCase();
    const multiplier = preference?.multiplier ?? 1;
    return {
        currencyCode,
        multiplier,
        countryCode: normalizedCountry,
        currencySymbol: preference?.currencySymbol || null,
        source: preference?.source || 'default'
    };
};

const getCurrencyRecord = async (code) => {
    const normalized = (code || DEFAULT_CURRENCY).toUpperCase();
    const cached = currencyCache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
    }

    const result = await query(
        `SELECT code, name, symbol, fx_rate_usd, purchasing_power_index
         FROM currencies
         WHERE code = $1
         LIMIT 1`,
        [normalized]
    );

    if (result.rows.length === 0) {
        return null;
    }

    const currency = {
        code: result.rows[0].code,
        name: result.rows[0].name,
        symbol: result.rows[0].symbol,
        fxRateToUsd: Number(result.rows[0].fx_rate_usd) || 1,
        purchasingPowerIndex: Number(result.rows[0].purchasing_power_index) || 1
    };

    currencyCache.set(normalized, {
        value: currency,
        expiresAt: Date.now() + CURRENCY_CACHE_TTL_MS
    });
    return currency;
};

const fetchCatalogRows = async (audience, currencyCode) => {
    const result = await query(
        `SELECT pc.*, c.symbol, c.fx_rate_usd, c.purchasing_power_index
         FROM pricing_catalog pc
         JOIN currencies c ON c.code = pc.currency_code
         WHERE pc.audience = $1 AND pc.currency_code = $2
         ORDER BY pc.amount_minor ASC`,
        [audience, currencyCode]
    );
    return result.rows;
};

const convertAmountMinor = (amountMinor, fromCurrency, toCurrency, multiplier = 1) => {
    const amount = Number(amountMinor || 0);
    if (!amount) return 0;

    const fromFx = Number(fromCurrency?.fxRateToUsd ?? fromCurrency?.fx_rate_usd ?? 1);
    const toFx = Number(toCurrency?.fxRateToUsd ?? toCurrency?.fx_rate_usd ?? 1);
    const usdValue = (amount / 100) * fromFx;
    const adjustedUsd = usdValue * (multiplier || 1);
    const targetMajor = adjustedUsd / (toFx || 1);
    return Math.max(0, Math.round(targetMajor * 100));
};

const normalizePlanRow = (row, overrides = {}) => {
    const metadata = parseJson(overrides.metadata ?? row.metadata, {});
    const features = parseJson(overrides.features ?? row.features, []);
    const limits = parseJson(overrides.limits ?? row.limits, {});
    const amountMinor = Number(overrides.amount_minor ?? row.amount_minor ?? 0);
    const currencySymbol = overrides.symbol || row.symbol || '$';

    return {
        audience: row.audience,
        planCode: overrides.plan_code || row.plan_code,
        planTier: overrides.plan_tier || row.plan_tier || metadata.planTier || 'free',
        currencyCode: overrides.currency_code || row.currency_code,
        currencySymbol,
        amountMinor,
        amountMajor: amountMinor / 100,
        priceFormatted: formatPrice(amountMinor, currencySymbol),
        billingPeriod: overrides.billing_period || row.billing_period || 'monthly',
        isDefault: Boolean(overrides.is_default ?? row.is_default),
        isAddon: Boolean(overrides.is_addon ?? row.is_addon),
        trialDays: Number(overrides.trial_days ?? row.trial_days ?? 0),
        features,
        limits,
        metadata
    };
};

const ensureCatalogForCurrency = async (audience, currencyCode, multiplier = 1) => {
    const normalizedAudience = normalizeAudience(audience);
    const normalizedCurrency = (currencyCode || DEFAULT_CURRENCY).toUpperCase();

    let rows = await fetchCatalogRows(normalizedAudience, normalizedCurrency);
    if (rows.length > 0) {
        return rows.map((row) => {
            const amount = Number(row.amount_minor || 0);
            const adjusted = multiplier !== 1 ? Math.max(0, Math.round(amount * multiplier)) : amount;
            return normalizePlanRow(row, {
                amount_minor: adjusted,
                currency_code: normalizedCurrency
            });
        });
    }

    const baseRows = await fetchCatalogRows(normalizedAudience, DEFAULT_CURRENCY);
    if (baseRows.length === 0) {
        return [];
    }

    const baseCurrency = (await getCurrencyRecord(DEFAULT_CURRENCY)) || { fxRateToUsd: 1 };
    const targetCurrency = (await getCurrencyRecord(normalizedCurrency)) || baseCurrency;

    return baseRows.map((row) => {
        const convertedAmount = convertAmountMinor(
            row.amount_minor,
            { fxRateToUsd: Number(row.fx_rate_usd) || baseCurrency.fxRateToUsd },
            targetCurrency,
            multiplier
        );
        return normalizePlanRow(row, {
            amount_minor: convertedAmount,
            currency_code: normalizedCurrency,
            symbol: targetCurrency.symbol || row.symbol || '$'
        });
    });
};

const getAudiencePricing = async (audienceInput, options = {}) => {
    const normalizedAudience = normalizeAudience(audienceInput);
    const preference = await resolveCountryPreference(options.country, options.currency);
    const plans = await ensureCatalogForCurrency(
        normalizedAudience,
        preference.currencyCode,
        preference.multiplier
    );
    const currencyMeta =
        (await getCurrencyRecord(preference.currencyCode)) || {
            code: preference.currencyCode,
            symbol: preference.currencySymbol || '$'
        };

    return {
        audience: normalizedAudience,
        currency: {
            ...currencyMeta,
            symbol: currencyMeta.symbol || preference.currencySymbol || '$'
        },
        multiplier: preference.multiplier,
        country: preference.countryCode,
        countryPreference:
            preference.source === 'default'
                ? null
                : {
                      code: preference.countryCode,
                      currency: preference.currencyCode,
                      multiplier: preference.multiplier,
                      source: preference.source
                  },
        plans
    };
};

const getCurrencyContext = async (options = {}) => {
    const preference = await resolveCountryPreference(options.country, options.currency);
    const currencyMeta =
        (await getCurrencyRecord(preference.currencyCode)) || {
            code: preference.currencyCode,
            symbol: preference.currencySymbol || '$'
        };
    return {
        currencyCode: preference.currencyCode,
        currencySymbol: currencyMeta.symbol || preference.currencySymbol || '$',
        multiplier: preference.multiplier,
        country: preference.countryCode,
        source: preference.source
    };
};

const getPlanByCode = async (audienceInput, planCode, currencyCode, options = {}) => {
    if (!planCode) return null;
    const normalizedAudience = normalizeAudience(audienceInput);
    const preference = await resolveCountryPreference(options.country, currencyCode);
    const resolvedCurrency = preference.currencyCode;
    const multiplier = preference.multiplier;
    const plans = await ensureCatalogForCurrency(normalizedAudience, resolvedCurrency, multiplier);
    return plans.find((plan) => plan.planCode === planCode) || null;
};

module.exports = {
    convertAmountMinor,
    getCurrencyContext,
    getCurrencyRecord,
    getAudiencePricing,
    getPlanByCode,
    listCountryPricing,
    DEFAULT_CURRENCY
};
