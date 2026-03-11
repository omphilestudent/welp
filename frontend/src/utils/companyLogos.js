// Shared logo resolution helper for company cards and profile pages.

// Known company logos using multiple working CDN sources.
// Each entry is an array of URLs tried in order until one loads successfully.
const KNOWN_COMPANY_LOGOS = {
    'google': [
        'https://cdn.simpleicons.org/google',
        'https://www.google.com/favicon.ico',
    ],
    'deepseek ai': [
        'https://cdn.simpleicons.org/deepseek',
    ],
    'meta': [
        'https://cdn.simpleicons.org/meta',
    ],
    'facebook': [
        'https://cdn.simpleicons.org/facebook',
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
    'apple inc.': [
        'https://cdn.simpleicons.org/apple',
        'https://www.apple.com/favicon.ico',
    ],
    'apple': [
        'https://cdn.simpleicons.org/apple',
        'https://www.apple.com/favicon.ico',
    ],
    'amazon': [
        'https://cdn.simpleicons.org/amazon',
        'https://www.amazon.com/favicon.ico',
    ],
    'microsoft': [
        'https://cdn.simpleicons.org/microsoft',
        'https://www.microsoft.com/favicon.ico',
    ],
    'tesla': [
        'https://cdn.simpleicons.org/tesla',
        'https://www.tesla.com/favicon.ico',
    ],
    'netflix': [
        'https://cdn.simpleicons.org/netflix',
    ],
    'spotify': [
        'https://cdn.simpleicons.org/spotify',
        'https://www.spotify.com/favicon.ico',
    ],
    'airbnb': [
        'https://cdn.simpleicons.org/airbnb',
        'https://www.airbnb.com/favicon.ico',
    ],
    'uber': [
        'https://cdn.simpleicons.org/uber',
        'https://www.uber.com/favicon.ico',
    ],
    'linkedin': [
        'https://cdn.simpleicons.org/linkedin',
    ],
    'salesforce': [
        'https://cdn.simpleicons.org/salesforce',
        'https://www.salesforce.com/favicon.ico',
    ],
    'oracle': [
        'https://cdn.simpleicons.org/oracle',
        'https://www.oracle.com/favicon.ico',
    ],
    'ibm': [
        'https://cdn.simpleicons.org/ibm',
        'https://www.ibm.com/favicon.ico',
    ],
    'intel': [
        'https://cdn.simpleicons.org/intel',
        'https://www.intel.com/favicon.ico',
    ],
    'nvidia': [
        'https://cdn.simpleicons.org/nvidia',
        'https://www.nvidia.com/favicon.ico',
    ],
    'adobe': [
        'https://cdn.simpleicons.org/adobe',
        'https://www.adobe.com/favicon.ico',
    ],
    'shopify': [
        'https://cdn.simpleicons.org/shopify',
    ],
    'slack': [
        'https://cdn.simpleicons.org/slack',
    ],
    'figma': [
        'https://cdn.simpleicons.org/figma',
    ],
    'github': [
        'https://cdn.simpleicons.org/github',
    ],
    'gitlab': [
        'https://cdn.simpleicons.org/gitlab',
    ],
    'notion': [
        'https://cdn.simpleicons.org/notion',
    ],
    'stripe': [
        'https://cdn.simpleicons.org/stripe',
    ],
    'twitter': [
        'https://cdn.simpleicons.org/twitter',
    ],
    'x': [
        'https://cdn.simpleicons.org/x',
    ],
    'openai': [
        'https://cdn.simpleicons.org/openai',
    ],
    'samsung': [
        'https://cdn.simpleicons.org/samsung',
    ],
    'sony': [
        'https://cdn.simpleicons.org/sony',
    ],
    'tiktok': [
        'https://cdn.simpleicons.org/tiktok',
    ],
    'youtube': [
        'https://cdn.simpleicons.org/youtube',
    ],
    'paypal': [
        'https://cdn.simpleicons.org/paypal',
    ],
    'visa': [
        'https://cdn.simpleicons.org/visa',
    ],
    'mastercard': [
        'https://cdn.simpleicons.org/mastercard',
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
