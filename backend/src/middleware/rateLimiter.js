// backend/src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 login/register attempts per hour
    message: {
        error: 'Too many authentication attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Extra strict limiter for login using IP + email fingerprint
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    keyGenerator: (req) => `${req.ip}:${(req.body?.email || '').toLowerCase()}`,
    message: {
        error: 'Too many login attempts for this account. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Sensitive account actions limiter
const accountSecurityLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        error: 'Too many sensitive account actions. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Review creation limiter
const reviewLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 3, // Limit each IP to 3 reviews per day
    message: {
        error: 'You have reached the maximum number of reviews for today.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Message limiter
const messageLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 messages per minute
    message: {
        error: 'Too many messages sent, please slow down.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    apiLimiter,
    authLimiter,
    loginLimiter,
    accountSecurityLimiter,
    reviewLimiter,
    messageLimiter
};
