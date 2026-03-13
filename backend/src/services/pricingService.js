const { query } = require('../utils/database');

const DEFAULT_CURRENCY = (process.env.DEFAULT_CURRENCY || 'USD').toUpperCase();
const CURRENCY_CACHE_TTL_MS = Number(process.env.CURRENCY_CACHE_TTL_MS || 300_000);

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

const COUNTRY_PRICING = {
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

const currencyCache = new Map();

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

const resolveCountryPreference = (countryCode, explicitCurrency) => {
    const normalizedCountry = countryCode ? countryCode.toUpperCase() : null;
    const preference = normalizedCountry ? COUNTRY_PRICING[normalizedCountry] : null;
    const currencyCode = (explicitCurrency || preference?.currency || DEFAULT_CURRENCY).toUpperCase();
    const multiplier = preference?.multiplier ?? 1;
    return { currencyCode, multiplier };
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
    const { currencyCode, multiplier } = resolveCountryPreference(options.country, options.currency);
    const plans = await ensureCatalogForCurrency(normalizedAudience, currencyCode, multiplier);
    const currencyMeta = (await getCurrencyRecord(currencyCode)) || { code: currencyCode, symbol: '$' };

    return {
        audience: normalizedAudience,
        currency: currencyMeta,
        multiplier,
        plans
    };
};

const getPlanByCode = async (audienceInput, planCode, currencyCode, options = {}) => {
    if (!planCode) return null;
    const normalizedAudience = normalizeAudience(audienceInput);
    const { currencyCode: resolvedCurrency, multiplier } = resolveCountryPreference(options.country, currencyCode);
    const plans = await ensureCatalogForCurrency(normalizedAudience, resolvedCurrency, multiplier);
    return plans.find((plan) => plan.planCode === planCode) || null;
};

module.exports = {
    getAudiencePricing,
    getPlanByCode,
    DEFAULT_CURRENCY,
    COUNTRY_PRICING
};
