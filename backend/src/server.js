const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

const { apiLimiter } = require('./middleware/rateLimiter');
const authRoutes = require('./routes/authRoutes');
const companyRoutes = require('./routes/companyRoutes');
const businessRoutes = require('./routes/businessRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const messageRoutes = require('./routes/messageRoutes');
const userRoutes = require('./routes/userRoutes');
const psychologistRoutes = require('./routes/psychologistRoutes');
const pricingRoutes = require('./routes/pricingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const hrRoutes = require('./routes/hrRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const resourcesRoutes = require('./routes/resourcesRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const marketingRoutes = require('./routes/marketingRoutes');
const emailMarketingRoutes = require('./routes/admin/emailMarketingRoutes');
const adsRoutes = require('./routes/adsRoutes');
const { initMarketingTables, startMarketingScheduler } = require('./services/marketingEmailService');
const { initEmailMarketingTables, startEmailCampaignScheduler } = require('./services/emailMarketingService');

// Database connection with better error handling
const { sequelize, testConnection } = require('./models');

// Optional routes with safe imports
let rbacUserRoutes, roleRoutes, authV2Routes;

try {
    rbacUserRoutes = require('./routes/rbacUserRoutes');
    roleRoutes = require('./routes/roleRoutes');
    authV2Routes = require('./routes/authV2Routes');
} catch (error) {
    console.warn('⚠️ RBAC routes unavailable:', error.message);
}

// Parse frontend origins with better handling
const frontendOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(origin => origin && origin !== '');

// JWT Secret validation with better error messages
const validateJwtSecret = () => {
    const weakJwtSecret = !process.env.JWT_SECRET ||
        process.env.JWT_SECRET.length < 32 ||
        process.env.JWT_SECRET.includes('change-in-production') ||
        process.env.JWT_SECRET === 'your_jwt_secret_key_here';

    if (weakJwtSecret && process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET is missing or too weak. Use at least 32 characters and never use placeholders.');
    }

    if (weakJwtSecret) {
        console.warn('⚠️ Weak JWT_SECRET detected. Update it before production deployment.');
        console.warn('💡 Generate a strong secret with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    }
};

validateJwtSecret();

// Enhanced CORS configuration
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, Postman)
        if (!origin || frontendOrigins.includes(origin) || frontendOrigins.includes('*')) {
            return callback(null, true);
        }

        // Log CORS violations for debugging
        console.warn(`🚫 CORS blocked request from origin: ${origin}`);
        return callback(new Error('CORS policy violation'));
    },
    credentials: true,
    optionsSuccessStatus: 200
};

const app = express();
const httpServer = createServer(app);

// Socket.IO with better error handling
const io = new Server(httpServer, {
    cors: corsOptions,
    pingTimeout: 60000,
    pingInterval: 25000
});

app.set('io', io);

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", ...frontendOrigins]
        }
    }
}));

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate limiting
app.use('/api/', apiLimiter);

// ==================== HEALTH CHECK ENDPOINTS ====================
// Simple health check (no /api prefix)
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date(),
        database: sequelize ? 'connected' : 'disconnected',
        environment: process.env.NODE_ENV || 'development'
    });
});

// API health check (with /api prefix - what your frontend is calling)
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'API is healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        database: sequelize ? 'connected' : 'disconnected'
    });
});
// ================================================================

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/businesses', businessRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/psychologists', psychologistRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/resources', resourcesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/admin/emailCampaigns', emailMarketingRoutes);
app.use('/api/ads', adsRoutes);

// RBAC Routes (if available)
if (authV2Routes && rbacUserRoutes && roleRoutes) {
    app.use('/api/rbac/auth', authV2Routes);
    app.use('/api/rbac/users', rbacUserRoutes);
    app.use('/api/rbac/roles', roleRoutes);
    console.log('✅ RBAC routes registered');
}

// 404 handler - This should be after all routes
app.use('*', (req, res) => {
    // Don't log health check 404s as errors
    if (req.originalUrl === '/api/health' || req.originalUrl === '/health') {
        return res.status(404).json({
            error: 'Not Found',
            message: `Health check endpoint not configured properly`
        });
    }

    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.originalUrl}`
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);

    // CORS error handling
    if (err.message === 'CORS policy violation') {
        return res.status(403).json({
            error: 'CORS Error',
            message: 'Origin not allowed'
        });
    }

    // JWT error handling
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Invalid token',
            message: 'Authentication failed'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: 'Token expired',
            message: 'Please login again'
        });
    }

    // Database connection errors
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        return res.status(503).json({
            error: 'Service Unavailable',
            message: 'Database connection error'
        });
    }

    // Default error response
    res.status(err.status || 500).json({
        error: err.name || 'Internal Server Error',
        message: process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : err.message
    });
});

// Socket.IO authentication middleware
io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.token;

    if (!token) {
        return next(new Error('Authentication error: No token provided'));
    }

    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        socket.userRole = decoded.role || 'user';
        next();
    } catch (err) {
        console.error('Socket auth error:', err.message);
        next(new Error('Authentication error: Invalid token'));
    }
});

// Socket.IO connection handling
const activeCalls = new Map();

io.on('connection', (socket) => {
    console.log('🔌 User connected:', socket.userId, 'Role:', socket.userRole);
    socket.join(`user-${socket.userId}`);

    socket.on('join-conversation', (conversationId) => {
        if (!conversationId) {
            return socket.emit('error', { message: 'Conversation ID required' });
        }
        socket.join(`conversation-${conversationId}`);
        console.log(`User ${socket.userId} joined conversation ${conversationId}`);
    });

    socket.on('leave-conversation', (conversationId) => {
        if (!conversationId) return;
        socket.leave(`conversation-${conversationId}`);
        console.log(`User ${socket.userId} left conversation ${conversationId}`);
    });

    socket.on('send-message', async (data) => {
        try {
            const { conversationId, content } = data;

            if (!conversationId || !content) {
                return socket.emit('error', { message: 'Conversation ID and content required' });
            }

            if (content.length > 5000) {
                return socket.emit('error', { message: 'Message too long (max 5000 characters)' });
            }

            const { query } = require('./utils/database');

            // Check conversation access
            const conversationAccess = await query(
                `SELECT id, employee_id, psychologist_id FROM conversations
                 WHERE id = $1 AND (employee_id = $2 OR psychologist_id = $2)`,
                [conversationId, socket.userId]
            );

            if (conversationAccess.rows.length === 0) {
                return socket.emit('error', { message: 'Unauthorized conversation access' });
            }

            // Insert message
            const result = await query(
                `INSERT INTO messages (conversation_id, sender_id, content, created_at)
                 VALUES ($1, $2, $3, NOW())
                 RETURNING *`,
                [conversationId, socket.userId, content]
            );

            // Get sender info
            const sender = await query(
                'SELECT id, display_name, role FROM users WHERE id = $1',
                [socket.userId]
            );

            // Update conversation timestamp
            await query(
                'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
                [conversationId]
            );

            const message = {
                ...result.rows[0],
                sender: sender.rows[0] || { id: socket.userId, display_name: 'Unknown', role: 'user' }
            };

            // Emit to all in conversation
            io.to(`conversation-${conversationId}`).emit('ml-services-message', message);

            const { createUserNotification } = require('./utils/userNotifications');
            const convo = conversationAccess.rows[0];
            const recipientId = convo.employee_id === socket.userId ? convo.psychologist_id : convo.employee_id;
            const senderName = message.sender?.display_name || 'Someone';
            const notification = await createUserNotification({
                userId: recipientId,
                type: 'message',
                message: `${senderName} sent you a message`,
                entityType: 'conversation',
                entityId: conversationId
            });

            if (notification) {
                io.to(`user-${recipientId}`).emit('notification', notification);
            }

            console.log(`Message sent in conversation ${conversationId} by user ${socket.userId}`);

        } catch (error) {
            console.error('Socket message error:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    const ensureConversationAccess = async (conversationId) => {
        const { query } = require('./utils/database');
        const conversationAccess = await query(
            `SELECT id, employee_id, psychologist_id FROM conversations
             WHERE id = $1 AND (employee_id = $2 OR psychologist_id = $2)`,
            [conversationId, socket.userId]
        );
        return conversationAccess.rows.length > 0;
    };

    socket.on('call:offer', async ({ conversationId, sdp, mediaType }) => {
        try {
            if (!conversationId || !sdp) return;
            const allowed = await ensureConversationAccess(conversationId);
            if (!allowed) {
                return socket.emit('error', { message: 'Unauthorized conversation access' });
            }
            if (!activeCalls.has(conversationId)) {
                activeCalls.set(conversationId, {
                    mediaType: mediaType || 'video',
                    startedAt: Date.now(),
                    initiatorId: socket.userId
                });
            }
            io.to(`conversation-${conversationId}`).emit('call:offer', {
                conversationId,
                sdp,
                mediaType,
                fromUserId: socket.userId
            });
        } catch (error) {
            console.error('Call offer error:', error);
        }
    });

    socket.on('call:answer', async ({ conversationId, sdp }) => {
        try {
            if (!conversationId || !sdp) return;
            const allowed = await ensureConversationAccess(conversationId);
            if (!allowed) {
                return socket.emit('error', { message: 'Unauthorized conversation access' });
            }
            const active = activeCalls.get(conversationId);
            if (active && !active.startedAt) {
                active.startedAt = Date.now();
            }
            io.to(`conversation-${conversationId}`).emit('call:answer', {
                conversationId,
                sdp,
                fromUserId: socket.userId
            });
        } catch (error) {
            console.error('Call answer error:', error);
        }
    });

    socket.on('call:ice', async ({ conversationId, candidate }) => {
        try {
            if (!conversationId || !candidate) return;
            const allowed = await ensureConversationAccess(conversationId);
            if (!allowed) {
                return socket.emit('error', { message: 'Unauthorized conversation access' });
            }
            io.to(`conversation-${conversationId}`).emit('call:ice', {
                conversationId,
                candidate,
                fromUserId: socket.userId
            });
        } catch (error) {
            console.error('Call ICE error:', error);
        }
    });

    socket.on('call:end', async ({ conversationId, reason }) => {
        try {
            if (!conversationId) return;
            const allowed = await ensureConversationAccess(conversationId);
            if (!allowed) {
                return socket.emit('error', { message: 'Unauthorized conversation access' });
            }
            io.to(`conversation-${conversationId}`).emit('call:end', {
                conversationId,
                reason: reason || 'ended',
                fromUserId: socket.userId
            });
            const active = activeCalls.get(conversationId);
            if (active && active.startedAt) {
                const { query } = require('./utils/database');
                const convo = await query(
                    `SELECT employee_id, psychologist_id FROM conversations WHERE id = $1`,
                    [conversationId]
                );
                const row = convo.rows[0];
                if (row) {
                    const endedAt = new Date();
                    const durationSeconds = Math.max(0, Math.round((Date.now() - active.startedAt) / 1000));
                    await query(
                        `INSERT INTO call_logs
                         (conversation_id, psychologist_id, employee_id, media_type, started_at, ended_at, duration_seconds)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [
                            conversationId,
                            row.psychologist_id,
                            row.employee_id,
                            active.mediaType || 'video',
                            new Date(active.startedAt),
                            endedAt,
                            durationSeconds
                        ]
                    );
                }
            }
            activeCalls.delete(conversationId);
        } catch (error) {
            console.error('Call end error:', error);
        }
    });

    socket.on('typing', (data) => {
        const { conversationId, isTyping } = data;
        socket.to(`conversation-${conversationId}`).emit('user-typing', {
            userId: socket.userId,
            isTyping
        });
    });

    socket.on('disconnect', () => {
        console.log('🔌 User disconnected:', socket.userId);
    });

    socket.on('error', (error) => {
        console.error('Socket error for user', socket.userId, ':', error);
    });
});

const PORT = process.env.PORT || 5000;

// Add retry logic for database connection
const MAX_DB_RETRIES = 5;
const DB_RETRY_INTERVAL = 5000; // 5 seconds

const connectWithRetry = async (retries = MAX_DB_RETRIES) => {
    if (!sequelize) {
        console.warn('⚠️ Sequelize not available - running without database');
        return false;
    }

    for (let i = 0; i < retries; i++) {
        try {
            await sequelize.authenticate();
            console.log('✅ Database connection established successfully');

            // Sync models (only in development)
            if (process.env.NODE_ENV === 'development') {
                await sequelize.sync({ alter: true });
                console.log('✅ Database models synchronized');
            }
            return true;
        } catch (error) {
            console.log(`⚠️ Database connection attempt ${i + 1}/${retries} failed:`, error.message);
            if (i < retries - 1) {
                console.log(`⏳ Waiting ${DB_RETRY_INTERVAL/1000} seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, DB_RETRY_INTERVAL));
            }
        }
    }
    console.error('❌ Could not connect to database after multiple attempts');
    return false;
};

// Server startup with better error handling
const startServer = async () => {
    try {
        // Test database connection with retry logic
        const dbConnected = await connectWithRetry();

        if (!dbConnected) {
            console.log('⚠️ Server will start but database features may not work');
        }

        if (dbConnected) {
            try {
                await initMarketingTables();
                await initEmailMarketingTables();
                startMarketingScheduler();
                startEmailCampaignScheduler();
            } catch (error) {
                console.warn('⚠️ Marketing scheduler init failure:', error.message);
            }
        }

        // Start server
        httpServer.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 Frontend origins allowed: ${frontendOrigins.join(', ') || 'all'}`);
            console.log(`📡 Health check available at: http://localhost:${PORT}/api/health`);
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Handle graceful shutdown
const gracefulShutdown = () => {
    console.log('🛑 Received shutdown signal, closing connections...');

    httpServer.close(() => {
        console.log('✅ HTTP server closed');

        if (sequelize) {
            sequelize.close().then(() => {
                console.log('✅ Database connection closed');
                process.exit(0);
            }).catch((err) => {
                console.error('Error closing database connection:', err);
                process.exit(1);
            });
        } else {
            process.exit(0);
        }
    });

    // Force shutdown after timeout
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
startServer();

module.exports = { app, httpServer, io };
