// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');

// Determine environment
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

// Environment-specific limits
const limits = {
    development: {
        auth: { windowMs: 60 * 1000, max: 100 },        // 100 per minute
        login: { windowMs: 60 * 1000, max: 50 },        // 50 per minute
        api: { windowMs: 60 * 1000, max: 1000 },        // 1000 per minute
        account: { windowMs: 60 * 1000, max: 50 },      // 50 per minute
        review: { windowMs: 60 * 1000, max: 30 },       // 30 per minute
        message: { windowMs: 60 * 1000, max: 100 },     // 100 per minute
        health: { windowMs: 60 * 1000, max: 1000 }      // 1000 per minute
    },
    test: {
        auth: { windowMs: 60 * 1000, max: 1000 },       // 1000 per minute
        login: { windowMs: 60 * 1000, max: 500 },       // 500 per minute
        api: { windowMs: 60 * 1000, max: 5000 },        // 5000 per minute
        account: { windowMs: 60 * 1000, max: 500 },     // 500 per minute
        review: { windowMs: 60 * 1000, max: 300 },      // 300 per minute
        message: { windowMs: 60 * 1000, max: 500 },     // 500 per minute
        health: { windowMs: 60 * 1000, max: 5000 }      // 5000 per minute
    },
    production: {
        auth: { windowMs: 15 * 60 * 1000, max: 20 },         // 20 per 15 min
        login: { windowMs: 15 * 60 * 1000, max: 20 },        // 20 per 15 min
        api: { windowMs: 15 * 60 * 1000, max: 100 },         // 100 per 15 min
        account: { windowMs: 15 * 60 * 1000, max: 5 },       // 5 per 15 min
        review: { windowMs: 24 * 60 * 60 * 1000, max: 3 },   // 3 per day
        message: { windowMs: 60 * 1000, max: 10 },           // 10 per minute
        health: { windowMs: 60 * 1000, max: 60 }             // 60 per minute
    }
};

// Get current environment limits
const currentLimits = isTest ? limits.test : (isDevelopment ? limits.development : limits.production);

// Helper function to skip rate limiting for local IPs in development
const skipInDevelopment = (req) => {
    if (isDevelopment) {
        const localIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'];
        const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
        return localIPs.some(ip => clientIP && clientIP.includes(ip));
    }
    return false;
};

// Helper function to skip health checks
const skipHealthChecks = (req) => {
    return req.path === '/health' || req.path === '/api/health';
};

// Global API limiter
const apiLimiter = rateLimit({
    windowMs: currentLimits.api.windowMs,
    max: currentLimits.api.max,
    message: {
        error: 'Too many requests, please try again later.',
        code: 'RATE_LIMIT_API'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false,   // Disable the `X-RateLimit-*` headers
    skip: (req) => skipHealthChecks(req) || skipInDevelopment(req),
    keyGenerator: (req) => {
        // Use IP + user ID if available for more granular limiting
        const userId = req.user?.id || 'anonymous';
        return `${userId}:${req.ip}`;
    }
});

// Authentication limiter (for non-login auth endpoints like forgot-password, verify-email)
const authLimiter = rateLimit({
    windowMs: currentLimits.auth.windowMs,
    max: currentLimits.auth.max,
    message: {
        error: 'Too many authentication attempts, please try again later.',
        code: 'RATE_LIMIT_AUTH'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInDevelopment,
    keyGenerator: (req) => {
        // Use email if available for auth endpoints
        const email = req.body?.email || 'anonymous';
        return `${email}:${req.ip}`;
    }
});

// Login specific limiter (more strict)
const loginLimiter = rateLimit({
    windowMs: currentLimits.login.windowMs,
    max: currentLimits.login.max,
    message: {
        error: 'Too many login attempts. Please try again later.',
        code: 'RATE_LIMIT_LOGIN'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInDevelopment,
    keyGenerator: (req) => {
        // Combine IP and email for login attempts to prevent brute force on specific accounts
        const email = (req.body?.email || '').toLowerCase().trim();
        return `${req.ip}:${email}`;
    },
    // Custom handler for rate limit exceeded
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many login attempts. Please try again later.',
            code: 'RATE_LIMIT_LOGIN',
            retryAfter: Math.ceil(currentLimits.login.windowMs / 1000 / 60) // minutes
        });
    }
});

// Account security limiter (for sensitive operations)
const accountSecurityLimiter = rateLimit({
    windowMs: currentLimits.account.windowMs,
    max: currentLimits.account.max,
    message: {
        error: 'Too many sensitive account actions. Please try again later.',
        code: 'RATE_LIMIT_ACCOUNT'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInDevelopment,
    keyGenerator: (req) => {
        // Use user ID if authenticated
        const userId = req.user?.id || req.ip;
        return userId.toString();
    }
});

// Review limiter
const reviewLimiter = rateLimit({
    windowMs: currentLimits.review.windowMs,
    max: currentLimits.review.max,
    message: {
        error: 'You have reached the maximum number of reviews. Please try again tomorrow.',
        code: 'RATE_LIMIT_REVIEW'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInDevelopment,
    keyGenerator: (req) => {
        // Use user ID for review limits
        return req.user?.id?.toString() || req.ip;
    }
});

// Message limiter
const messageLimiter = rateLimit({
    windowMs: currentLimits.message.windowMs,
    max: currentLimits.message.max,
    message: {
        error: 'Too many messages sent. Please slow down.',
        code: 'RATE_LIMIT_MESSAGE'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInDevelopment,
    keyGenerator: (req) => {
        return req.user?.id?.toString() || req.ip;
    }
});

// Health check limiter (very permissive)
const healthLimiter = rateLimit({
    windowMs: currentLimits.health.windowMs,
    max: currentLimits.health.max,
    message: {
        error: 'Too many health check requests.',
        code: 'RATE_LIMIT_HEALTH'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInDevelopment // Still skip in development
});

// Export all limiters
module.exports = {
    apiLimiter,
    authLimiter,
    loginLimiter,
    accountSecurityLimiter,
    reviewLimiter,
    messageLimiter,
    healthLimiter
};
