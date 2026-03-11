const { URL } = require('url');

const ABSOLUTE_URL_REGEX = /^https?:\/\//i;

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

    return {
        website: normalizedUrl,
        name: (ogTitle || titleMatch?.[1] || '').trim() || new URL(normalizedUrl).hostname,
        description: description || '',
        logo_url: logoUrl,
        source: 'web_scraper'
    };
};

module.exports = {
    scrapeCompanyFromWebsite
};
