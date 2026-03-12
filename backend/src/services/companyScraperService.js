const { URL } = require('url');

const ABSOLUTE_URL_REGEX = /^https?:\/\//i;
const JSON_LD_REGEX = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const CONTACT_SCHEMA_TYPES = ['organization', 'localbusiness', 'company', 'corporation', 'place'];

const normalizeCompanyUrl = (websiteUrl) => {
    if (!websiteUrl || typeof websiteUrl !== 'string') {
        throw new Error('A valid company website URL is required');
    }

    const trimmed = websiteUrl.trim();
    if (!trimmed) {
        throw new Error('A valid company website URL is required');
    }

    return ABSOLUTE_URL_REGEX.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const toAbsoluteUrl = (value, baseUrl) => {
    if (!value) return null;
    try {
        return new URL(value, baseUrl).toString();
    } catch (error) {
        return null;
    }
};

const getMetaContent = (html, name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
        new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
        new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, 'i')
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) return match[1].trim();
    }

    return null;
};

const sanitizeText = (value) => {
    if (!value || typeof value !== 'string') return null;
    return value.replace(/\s+/g, ' ').trim();
};

const parseJsonLdContact = (html) => {
    const contact = {};
    let match;

    while ((match = JSON_LD_REGEX.exec(html)) !== null) {
        const raw = match[1]?.trim();
        if (!raw) continue;

        let data;
        try {
            data = JSON.parse(raw);
        } catch (error) {
            continue;
        }

        const nodes = Array.isArray(data) ? data : [data];
        for (const node of nodes) {
            if (!node || typeof node !== 'object') continue;
            const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
            const hasContactType = types
                .filter(Boolean)
                .map((t) => String(t).toLowerCase())
                .some((t) => CONTACT_SCHEMA_TYPES.includes(t));

            if (!hasContactType) continue;

            if (!contact.phone && node.telephone) {
                contact.phone = sanitizeText(node.telephone);
            }
            if (!contact.email && node.email) {
                contact.email = sanitizeText(node.email);
            }
            if (!contact.address && node.address) {
                if (typeof node.address === 'string') {
                    contact.address = sanitizeText(node.address);
                } else if (typeof node.address === 'object') {
                    const parts = [
                        node.address.streetAddress,
                        node.address.addressLocality,
                        node.address.addressRegion,
                        node.address.postalCode,
                        node.address.addressCountry
                    ].filter(Boolean);
                    contact.address = sanitizeText(parts.join(', '));
                    if (!contact.city && node.address.addressLocality) {
                        contact.city = sanitizeText(node.address.addressLocality);
                    }
                    if (!contact.country && node.address.addressCountry) {
                        contact.country = sanitizeText(node.address.addressCountry);
                    }
                }
            }
            if (!contact.city && node.addressLocality) {
                contact.city = sanitizeText(node.addressLocality);
            }
            if (!contact.country && node.addressCountry) {
                contact.country = sanitizeText(node.addressCountry);
            }
        }
    }

    return contact;
};

const extractMailTo = (html) => {
    const match = html.match(/mailto:([^"'\s>]+)/i);
    if (!match?.[1]) return null;
    try {
        const decoded = decodeURIComponent(match[1]);
        return sanitizeText(decoded.split('?')[0]);
    } catch (error) {
        return sanitizeText(match[1].split('?')[0]);
    }
};

const extractTel = (html) => {
    const match = html.match(/tel:([^"'\s>]+)/i);
    if (!match?.[1]) return null;
    const value = match[1].replace(/[^0-9+()\-\s]/g, '');
    return sanitizeText(value);
};

const extractAddressTag = (html) => {
    const match = html.match(/<address[^>]*>([\s\S]*?)<\/address>/i);
    if (!match?.[1]) return null;
    const withoutTags = match[1].replace(/<[^>]+>/g, ' ');
    return sanitizeText(withoutTags);
};

const scrapeCompanyFromWebsite = async (websiteUrl) => {
    const normalizedUrl = normalizeCompanyUrl(websiteUrl);

    const response = await fetch(normalizedUrl, {
        headers: {
            'User-Agent': 'WelpCompanyBot/1.0 (+https://welp.local)'
        }
    });

    if (!response.ok) {
        throw new Error(`Could not fetch website (HTTP ${response.status})`);
    }

    const html = await response.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogTitle = getMetaContent(html, 'og:title');
    const description = getMetaContent(html, 'description') || getMetaContent(html, 'og:description');

    const faviconMatch = html.match(/<link[^>]+rel=["'][^"']*(icon|apple-touch-icon)[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i)
        || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*(icon|apple-touch-icon)[^"']*["'][^>]*>/i);

    const ogImage = getMetaContent(html, 'og:image');
    const logoUrl = toAbsoluteUrl(ogImage || (faviconMatch?.[2] || faviconMatch?.[1]), normalizedUrl);

    const structuredContact = parseJsonLdContact(html);
    if (!structuredContact.email) structuredContact.email = extractMailTo(html);
    if (!structuredContact.phone) structuredContact.phone = extractTel(html);
    if (!structuredContact.address) structuredContact.address = extractAddressTag(html);

    return {
        website: normalizedUrl,
        name: (ogTitle || titleMatch?.[1] || '').trim() || new URL(normalizedUrl).hostname,
        description: description || '',
        logo_url: logoUrl,
        phone: structuredContact.phone || null,
        email: structuredContact.email || null,
        address: structuredContact.address || null,
        city: structuredContact.city || null,
        country: structuredContact.country || null,
        source: 'web_scraper'
    };
};

module.exports = {
    scrapeCompanyFromWebsite
};
