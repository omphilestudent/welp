const COUNTRY_NAME_TO_CODE = {
    'united states': 'US',
    usa: 'US',
    'south africa': 'ZA',
    canada: 'CA',
    'united kingdom': 'GB',
    england: 'GB',
    ireland: 'IE',
    germany: 'DE',
    france: 'FR',
    italy: 'IT',
    spain: 'ES',
    netherlands: 'NL',
    belgium: 'BE',
    switzerland: 'CH',
    sweden: 'SE',
    norway: 'NO',
    denmark: 'DK',
    finland: 'FI',
    portugal: 'PT',
    greece: 'GR',
    australia: 'AU',
    'new zealand': 'NZ',
    japan: 'JP',
    'south korea': 'KR',
    singapore: 'SG',
    china: 'CN',
    india: 'IN',
    indonesia: 'ID',
    malaysia: 'MY',
    thailand: 'TH',
    vietnam: 'VN',
    philippines: 'PH',
    nigeria: 'NG',
    kenya: 'KE',
    egypt: 'EG',
    morocco: 'MA',
    ghana: 'GH',
    tanzania: 'TZ',
    uganda: 'UG',
    brazil: 'BR',
    argentina: 'AR',
    chile: 'CL',
    colombia: 'CO',
    peru: 'PE',
    mexico: 'MX',
    'united arab emirates': 'AE',
    'saudi arabia': 'SA',
    israel: 'IL',
    turkey: 'TR',
    qatar: 'QA',
    kuwait: 'KW'
};

const CURRENCY_BY_COUNTRY = {
    US: { code: 'USD', symbol: '$' },
    ZA: { code: 'ZAR', symbol: 'R' },
    CA: { code: 'CAD', symbol: '$' },
    GB: { code: 'GBP', symbol: '£' },
    IE: { code: 'EUR', symbol: '€' },
    DE: { code: 'EUR', symbol: '€' },
    FR: { code: 'EUR', symbol: '€' },
    IT: { code: 'EUR', symbol: '€' },
    ES: { code: 'EUR', symbol: '€' },
    NL: { code: 'EUR', symbol: '€' },
    BE: { code: 'EUR', symbol: '€' },
    CH: { code: 'CHF', symbol: 'CHF' },
    SE: { code: 'SEK', symbol: 'kr' },
    NO: { code: 'NOK', symbol: 'kr' },
    DK: { code: 'DKK', symbol: 'kr' },
    FI: { code: 'EUR', symbol: '€' },
    PT: { code: 'EUR', symbol: '€' },
    GR: { code: 'EUR', symbol: '€' },
    AU: { code: 'AUD', symbol: '$' },
    NZ: { code: 'NZD', symbol: '$' },
    JP: { code: 'JPY', symbol: '¥' },
    KR: { code: 'KRW', symbol: '₩' },
    SG: { code: 'SGD', symbol: '$' },
    CN: { code: 'CNY', symbol: '¥' },
    IN: { code: 'INR', symbol: '₹' },
    ID: { code: 'IDR', symbol: 'Rp' },
    MY: { code: 'MYR', symbol: 'RM' },
    TH: { code: 'THB', symbol: '฿' },
    VN: { code: 'VND', symbol: '₫' },
    PH: { code: 'PHP', symbol: '₱' },
    NG: { code: 'NGN', symbol: '₦' },
    KE: { code: 'KES', symbol: 'KSh' },
    EG: { code: 'EGP', symbol: '£' },
    MA: { code: 'MAD', symbol: 'د.م.' },
    GH: { code: 'GHS', symbol: '₵' },
    TZ: { code: 'TZS', symbol: 'TSh' },
    UG: { code: 'UGX', symbol: 'USh' },
    BR: { code: 'BRL', symbol: 'R$' },
    AR: { code: 'ARS', symbol: '$' },
    CL: { code: 'CLP', symbol: '$' },
    CO: { code: 'COP', symbol: '$' },
    PE: { code: 'PEN', symbol: 'S/' },
    MX: { code: 'MXN', symbol: '$' },
    AE: { code: 'AED', symbol: 'د.إ' },
    SA: { code: 'SAR', symbol: '﷼' },
    IL: { code: 'ILS', symbol: '₪' },
    TR: { code: 'TRY', symbol: '₺' },
    QA: { code: 'QAR', symbol: 'ر.ق' },
    KW: { code: 'KWD', symbol: 'د.ك' }
};

const DEFAULT_COUNTRY = 'ZA';
const DEFAULT_CURRENCY = { code: 'ZAR', symbol: 'R' };

const normalizeCountryInput = (value) => {
    if (!value || typeof value !== 'string') return null;
    if (/^[a-z]{2}$/i.test(value)) {
        return value.toUpperCase();
    }
    const normalized = value.trim().toLowerCase();
    return COUNTRY_NAME_TO_CODE[normalized] || null;
};

const getStoredCountryPreference = () => {
    if (typeof window === 'undefined') return null;
    try {
        const stored =
            window.localStorage.getItem('welp_country_preference') ||
            window.localStorage.getItem('welp_selected_country');
        return normalizeCountryInput(stored);
    } catch {
        return null;
    }
};

export const guessCurrencySymbol = (currencyCode = 'USD') => {
    try {
        const formatter = new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode });
        const parts = formatter.formatToParts(0);
        const currencyPart = parts.find((part) => part.type === 'currency');
        return currencyPart?.value || DEFAULT_CURRENCY.symbol;
    } catch {
        return DEFAULT_CURRENCY.symbol;
    }
};

export const formatAmountMinor = (amountMinor, currencyCode = DEFAULT_CURRENCY.code, currencySymbol = DEFAULT_CURRENCY.symbol) => {
    if (!Number.isFinite(amountMinor)) return null;
    const major = amountMinor / 100;
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: currencyCode
        }).format(major);
    } catch {
        return `${currencySymbol}${major.toFixed(2)}`;
    }
};

const resolveLocaleCountry = () => {
    try {
        const locale = (Intl.DateTimeFormat().resolvedOptions().locale || navigator.language || '').replace('_', '-');
        const parts = locale.split('-');
        if (parts.length > 1 && /^[a-z]{2}$/i.test(parts[1])) {
            return parts[1].toUpperCase();
        }
    } catch {
        /* noop */
    }
    return DEFAULT_COUNTRY;
};

export const deriveCountryCode = (source) => {
    const storedPreference = getStoredCountryPreference();
    if (storedPreference) return storedPreference;

    const probeObject = (value) => {
        if (!value || typeof value !== 'object') return null;
        const candidates = [
            value.country_code,
            value.countryCode,
            value.country,
            value.location?.countryCode,
            value.location?.country,
            value.profile?.countryCode,
            value.profile?.country,
            value.company?.countryCode,
            value.company?.country,
            value.company?.address?.country,
            value.business?.countryCode,
            value.business?.country,
            value.businessProfile?.countryCode,
            value.businessProfile?.country,
            value.organization?.countryCode,
            value.organization?.country,
            value.settings?.country
        ];
        for (const candidate of candidates) {
            const normalized = normalizeCountryInput(candidate);
            if (normalized) return normalized;
        }
        return null;
    };

    const direct = normalizeCountryInput(typeof source === 'string' ? source : null);
    if (direct) return direct;

    const fromObject = probeObject(source);
    if (fromObject) return fromObject;

    return resolveLocaleCountry();
};

export const currencyForCountry = (countryCode) => {
    if (!countryCode) return DEFAULT_CURRENCY;
    return CURRENCY_BY_COUNTRY[countryCode] || DEFAULT_CURRENCY;
};

export const resolveUserCurrency = (user) => {
    const countryCode = deriveCountryCode(user);
    const currency = currencyForCountry(countryCode);
    return { countryCode, currency };
};

export const formatMoneyForCountry = (amountMinor, countryCode) => {
    const currency = currencyForCountry(countryCode);
    return formatAmountMinor(amountMinor, currency.code, currency.symbol);
};

export const formatMoneyForUser = (amountMinor, user) => {
    const { currency } = resolveUserCurrency(user || {});
    return formatAmountMinor(amountMinor, currency.code, currency.symbol);
};

export const formatPlanPrice = (plan, fallbackCurrency = DEFAULT_CURRENCY) => {
    if (!plan) return `${fallbackCurrency.symbol}0.00`;
    if (plan.priceFormatted) return plan.priceFormatted;
    if (plan.price_formatted) return plan.price_formatted;

    const amountMinor = plan.amountMinor ?? plan.amount_minor ?? null;
    const currencyCode = plan.currencyCode || plan.currency_code || fallbackCurrency.code;
    const currencySymbol = plan.currencySymbol || plan.currency_symbol || guessCurrencySymbol(currencyCode);

    if (Number.isFinite(amountMinor)) {
        return formatAmountMinor(amountMinor, currencyCode, currencySymbol);
    }

    if (Number.isFinite(plan.amountMajor)) {
        return `${currencySymbol}${plan.amountMajor.toFixed(2)}`;
    }

    return `${currencySymbol}0.00`;
};

export { COUNTRY_NAME_TO_CODE, CURRENCY_BY_COUNTRY, DEFAULT_CURRENCY };
