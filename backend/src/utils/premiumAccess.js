const PREMIUM_BUSINESS_EMAIL = (process.env.WELP_PREMIUM_EMAIL || 'omphilemohlala@welp.com').toLowerCase();

const extractEmail = (input) => {
    if (!input) return null;
    if (typeof input === 'string') return input;
    if (input.email) return input.email;
    if (input.ownerEmail) return input.ownerEmail;
    if (input.user?.email) return input.user.email;
    return null;
};

const hasPremiumException = (subject) => {
    const email = extractEmail(subject);
    if (!email) return false;
    return email.toLowerCase() === PREMIUM_BUSINESS_EMAIL;
};

module.exports = {
    hasPremiumException,
    PREMIUM_BUSINESS_EMAIL
};
