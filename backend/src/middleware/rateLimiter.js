
const rateLimit = require('express-rate-limit');


const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        error: 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});


const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: {
        error: 'Too many authentication attempts, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});


const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => `${req.ip}:${(req.body?.email || '').toLowerCase()}`,
    message: {
        error: 'Too many login attempts for this account. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});


const accountSecurityLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        error: 'Too many sensitive account actions. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});


const reviewLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 3,
    message: {
        error: 'You have reached the maximum number of reviews for today.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});


const messageLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
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
