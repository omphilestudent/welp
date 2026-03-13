const { getAudiencePricing, COUNTRY_PRICING } = require('../services/pricingService');

const AUDIENCES = ['user', 'psychologist', 'business'];
const COUNTRY_NAMES = {
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

const getAllPricing = async (req, res) => {
    try {
        const { currency, country } = req.query;
        const response = {};
        for (const audience of AUDIENCES) {
            response[audience] = await getAudiencePricing(audience, { currency, country });
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
        const pricing = await getAudiencePricing(audience, { currency, country });
        if (!pricing.plans.length) {
            return res.status(404).json({ error: 'No pricing found for requested audience' });
        }
        res.json(pricing);
    } catch (error) {
        console.error('Get audience pricing error:', error);
        res.status(500).json({ error: 'Failed to load pricing for audience' });
    }
};

const getCountries = (req, res) => {
    const countries = Object.entries(COUNTRY_PRICING).map(([code, config]) => ({
        code,
        name: COUNTRY_NAMES[code] || code,
        currency: config.currency,
        multiplier: config.multiplier
    })).sort((a, b) => a.name.localeCompare(b.name));
    res.json(countries);
};

module.exports = {
    getPricing: getAllPricing,
    getPricingForAudience,
    getCountries
};
