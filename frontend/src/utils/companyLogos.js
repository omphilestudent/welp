// Shared logo resolution helper for company cards and profile pages.

const simpleIcon = (slug, color = '0F172A') => {
    const normalized = color.replace('#', '');
    return `https://cdn.simpleicons.org/${slug}/${normalized}`;
};

// Known company logos using multiple working CDN sources.
// Each entry is an array of URLs tried in order until one loads successfully.
const KNOWN_COMPANY_LOGOS = {
    'google': [
        simpleIcon('google', '#4285F4'),
        'https://www.google.com/favicon.ico',
    ],
    'deepseek ai': [
        simpleIcon('deepseek', '#0F172A'),
    ],
    'meta': [
        simpleIcon('meta'),
    ],
    'facebook': [
        simpleIcon('facebook'),
    ],
    'capitec bank': [
        'https://img.logo.dev/capitecbank.co.za?token=pk_X9JGkMBBQQaXJjxCNg9EFQ',
    ],
    'standard bank': [
        'https://img.logo.dev/standardbank.co.za?token=pk_X9JGkMBBQQaXJjxCNg9EFQ',
    ],
    'fnb': [
        'https://img.logo.dev/fnb.co.za?token=pk_X9JGkMBBQQaXJjxCNg9EFQ',
    ],
    'nedbank': [
        'https://img.logo.dev/nedbank.co.za?token=pk_X9JGkMBBQQaXJjxCNg9EFQ',
    ],
    'absa': [
        'https://img.logo.dev/absa.co.za?token=pk_X9JGkMBBQQaXJjxCNg9EFQ',
    ],
    'transnet': [
        'https://img.logo.dev/transnet.net?token=pk_X9JGkMBBQQaXJjxCNg9EFQ',
        'https://logo.clearbit.com/transnet.net',
        'https://transnet.net/favicon.ico',
    ],
    'spoornet': [
        'https://img.logo.dev/transnet.net?token=pk_X9JGkMBBQQaXJjxCNg9EFQ',
        'https://logo.clearbit.com/transnet.net',
        'https://transnet.net/favicon.ico',
    ],
    'mr price': [
        'https://img.logo.dev/mrpricegroup.com?token=pk_X9JGkMBBQQaXJjxCNg9EFQ',
        'https://mrpricegroup.com/favicon.ico',
    ],
    'mrprice': [
        'https://img.logo.dev/mrpricegroup.com?token=pk_X9JGkMBBQQaXJjxCNg9EFQ',
        'https://mrpricegroup.com/favicon.ico',
    ],
    'mr price group': [
        'https://img.logo.dev/mrpricegroup.com?token=pk_X9JGkMBBQQaXJjxCNg9EFQ',
        'https://mrpricegroup.com/favicon.ico',
    ],
    'mrp': [
        'https://img.logo.dev/mrp.com?token=pk_X9JGkMBBQQaXJjxCNg9EFQ',
        'https://mrp.com/favicon.ico',
    ],
    'apple inc.': [
        simpleIcon('apple'),
        'https://www.apple.com/favicon.ico',
    ],
    'apple': [
        simpleIcon('apple'),
        'https://www.apple.com/favicon.ico',
    ],
    'amazon': [
        simpleIcon('amazon'),
        'https://www.amazon.com/favicon.ico',
    ],
    'microsoft': [
        simpleIcon('microsoft'),
        'https://www.microsoft.com/favicon.ico',
    ],
    'tesla': [
        simpleIcon('tesla'),
        'https://www.tesla.com/favicon.ico',
    ],
    'netflix': [
        simpleIcon('netflix'),
    ],
    'spotify': [
        simpleIcon('spotify'),
        'https://www.spotify.com/favicon.ico',
    ],
    'airbnb': [
        simpleIcon('airbnb'),
        'https://www.airbnb.com/favicon.ico',
    ],
    'uber': [
        simpleIcon('uber'),
        'https://www.uber.com/favicon.ico',
    ],
    'linkedin': [
        simpleIcon('linkedin'),
    ],
    'salesforce': [
        simpleIcon('salesforce'),
        'https://www.salesforce.com/favicon.ico',
    ],
    'oracle': [
        simpleIcon('oracle'),
        'https://www.oracle.com/favicon.ico',
    ],
    'ibm': [
        simpleIcon('ibm'),
        'https://www.ibm.com/favicon.ico',
    ],
    'intel': [
        simpleIcon('intel'),
        'https://www.intel.com/favicon.ico',
    ],
    'nvidia': [
        simpleIcon('nvidia'),
        'https://www.nvidia.com/favicon.ico',
    ],
    'adobe': [
        simpleIcon('adobe'),
        'https://www.adobe.com/favicon.ico',
    ],
    'shopify': [
        simpleIcon('shopify'),
    ],
    'slack': [
        simpleIcon('slack'),
    ],
    'figma': [
        simpleIcon('figma'),
    ],
    'github': [
        simpleIcon('github'),
    ],
    'gitlab': [
        simpleIcon('gitlab'),
    ],
    'notion': [
        simpleIcon('notion'),
    ],
    'stripe': [
        simpleIcon('stripe'),
    ],
    'twitter': [
        simpleIcon('twitter'),
    ],
    'x': [
        simpleIcon('x'),
    ],
    'openai': [
        simpleIcon('openai'),
    ],
    'samsung': [
        simpleIcon('samsung'),
    ],
    'sony': [
        simpleIcon('sony'),
    ],
    'tiktok': [
        simpleIcon('tiktok'),
    ],
    'youtube': [
        simpleIcon('youtube'),
    ],
    'paypal': [
        simpleIcon('paypal'),
    ],
    'visa': [
        simpleIcon('visa'),
    ],
    'mastercard': [
        simpleIcon('mastercard'),
    ],
};

const extractDomain = (website) => {
    if (!website || typeof website !== 'string') return null;
    try {
        const url = new URL(website.startsWith('http') ? website : `https://${website}`);
        return url.hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
};

/**
 * Build an ordered array of logo URLs to attempt for a given company.
 *
 * Priority:
 *  1. Explicit logo_url stored in the DB
 *  2. Known logo list (SimpleIcons / direct favicon)
 *  3. logo.dev API
 *  4. Direct /favicon.ico from company website
 *  5. Google favicon service
 */
const buildLogoUrls = (company = {}, nameLower = '') => {
    const urls = [];
    const push = (url) => { if (url && !urls.includes(url)) urls.push(url); };

    push(company.logo_url || company.logoUrl);

    const knownUrls = KNOWN_COMPANY_LOGOS[nameLower];
    if (knownUrls) knownUrls.forEach(push);

    const websiteDomain = extractDomain(company.website);
    if (websiteDomain) {
        push(`https://img.logo.dev/${websiteDomain}?token=pk_X9JGkMBBQQaXJjxCNg9EFQ&size=64`);
        push(`https://${websiteDomain}/favicon.ico`);
        push(`https://www.google.com/s2/favicons?domain=${websiteDomain}&sz=64`);
    }

    return urls;
};

export { buildLogoUrls };
