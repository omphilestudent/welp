const { URL } = require('url');

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'WelpCompanyBot/1.0 (+https://welp.app)';

const buildSearchQuery = ({ name, city, country }) => {
    const parts = [];
    if (name) parts.push(name.trim());
    if (city) parts.push(city.trim());
    if (country) parts.push(country.trim());
    return parts.filter(Boolean).join(', ');
};

const normalizeField = (source, keys = []) => {
    if (!source) return null;
    for (const key of keys) {
        if (source[key]) return String(source[key]).trim();
    }
    return null;
};

const fetchJson = async (url) => {
    const response = await fetch(url, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept-Language': 'en'
        }
    });

    if (!response.ok) {
        throw new Error(`Nominatim request failed: ${response.status}`);
    }

    return response.json();
};

const enrichCompanyWithOSM = async ({ name, city, country }) => {
    const query = buildSearchQuery({ name, city, country });
    if (!query) return null;

    const url = new URL(NOMINATIM_ENDPOINT);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('extratags', '1');
    url.searchParams.set('limit', '3');

    const results = await fetchJson(url.toString());
    if (!Array.isArray(results) || results.length === 0) return null;

    const candidate = results[0];
    const extratags = candidate.extratags || {};

    const phone = normalizeField(extratags, ['phone', 'contact:phone', 'telephone']);
    const email = normalizeField(extratags, ['email', 'contact:email']);
    const website = normalizeField(extratags, ['website', 'contact:website']);

    return {
        source: 'nominatim',
        address: candidate.display_name,
        latitude: candidate.lat,
        longitude: candidate.lon,
        phone,
        email,
        website,
        raw: {
            class: candidate.class,
            type: candidate.type,
            address: candidate.address
        }
    };
};

module.exports = {
    enrichCompanyWithOSM
};
