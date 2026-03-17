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
const applicationRoutes = require('./routes/applicationRoutes');
const hrRoutes = require('./routes/hrRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const resourcesRoutes = require('./routes/resourcesRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const marketingRoutes = require('./routes/marketingRoutes');
const emailMarketingRoutes = require('./routes/admin/emailMarketingRoutes');
const adminPricingRoutes = require('./routes/admin/pricingRoutes');
const adminFlowRoutes = require('./routes/admin/flowRoutes');
const adminTicketRoutes = require('./routes/admin/ticketRoutes');
const flowRuntimeRoutes = require('./routes/flowRuntimeRoutes');
const adsRoutes = require('./routes/adsRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const kodiRoutes = require('./routes/kodiRoutes');
const { initMarketingTables, startMarketingScheduler } = require('./services/marketingEmailService');
const { initEmailMarketingTables, startEmailCampaignScheduler } = require('./services/emailMarketingService');
const { query } = require('./utils/database');
const { createUserNotification } = require('./utils/userNotifications');
const { getActiveSubscription, getPlanPayload } = require('./services/subscriptionService');
const { hasPremiumException } = require('./utils/premiumAccess');
const { ROLE_FLAGS } = require('./middleware/roleFlags');

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
app.use('/api/admin/pricing', adminPricingRoutes);
app.use('/api/admin/flows', adminFlowRoutes);
app.use('/api/admin/tickets', adminTicketRoutes);
app.use('/api/flows', flowRuntimeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/marketing', marketingRoutes);
app.use('/api/admin/emailCampaigns', emailMarketingRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/kodi', kodiRoutes);

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
const CALL_CAP_CACHE = new Map();
const CALL_CAP_TTL_MS = Number(process.env.CALL_CAP_CACHE_TTL_MS || 60000);

const getUserCallCapabilities = async (userId) => {
    if (!userId) {
        return { role: 'unknown', tier: 'free', callMinutes: 0, canInitiate: false };
    }
    const cached = CALL_CAP_CACHE.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value;
    }

    const userResult = await query(
        'SELECT id, role, email, subscription_tier FROM users WHERE id = $1',
        [userId]
    );
    if (!userResult.rows.length) {
        return { role: 'unknown', tier: 'free', callMinutes: 0, canInitiate: false };
    }
    const user = userResult.rows[0];
    const role = String(user.role || 'employee').toLowerCase();

    let planPayload = null;
    if (role === 'employee') {
        if (hasPremiumException(user)) {
            planPayload = { tier: 'premium', callMinutes: 120 };
        } else {
            const record = await getActiveSubscription('user', userId);
            planPayload = await getPlanPayload(record, 'user');
        }
    } else if (role === 'psychologist') {
        const record = await getActiveSubscription('psychologist', userId);
        planPayload = await getPlanPayload(record, 'psychologist') || {};
        if (!planPayload.callMinutes) {
            planPayload.callMinutes = ROLE_FLAGS.psychologist?.call_minutes_per_client || 120;
        }
        if (!planPayload.tier) {
            planPayload.tier = 'premium';
        }
    } else {
        planPayload = { tier: user.subscription_tier || 'free', callMinutes: 0 };
    }

    const callMinutes = Number(planPayload?.callMinutes ?? 0);
    const tier = String(
        planPayload?.tier ||
        planPayload?.planTier ||
        planPayload?.plan_tier ||
        user.subscription_tier ||
        'free'
    ).toLowerCase();

    const value = {
        role,
        tier,
        callMinutes,
        canInitiate: role !== 'employee' || (tier !== 'free' && callMinutes > 0)
    };
    CALL_CAP_CACHE.set(userId, { value, expiresAt: Date.now() + CALL_CAP_TTL_MS });
    return value;
};

const endCallSession = async (conversationId, reason = 'ended', endedByUserId = null, options = {}) => {
    if (!options.skipEmit) {
        io.to(`conversation-${conversationId}`).emit('call:end', {
            conversationId,
            reason,
            fromUserId: endedByUserId,
            system: Boolean(options.system)
        });
    }

    const active = activeCalls.get(conversationId);
    if (!active) {
        return;
    }

    if (active.timer) {
        clearTimeout(active.timer);
    }

    let employeeId = active.employeeId;
    let psychologistId = active.psychologistId;
    if (!employeeId || !psychologistId) {
        const fallback = await query(
            'SELECT employee_id, psychologist_id FROM conversations WHERE id = $1',
            [conversationId]
        );
        if (fallback.rows.length) {
            employeeId = employeeId || fallback.rows[0].employee_id;
            psychologistId = psychologistId || fallback.rows[0].psychologist_id;
        }
    }

    if (active.startedAt && employeeId && psychologistId) {
        const endedAt = new Date();
        const durationSeconds = Math.max(0, Math.round((Date.now() - active.startedAt) / 1000));
        await query(
            `INSERT INTO call_logs
             (conversation_id, psychologist_id, employee_id, media_type, started_at, ended_at, duration_seconds)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                conversationId,
                psychologistId,
                employeeId,
                active.mediaType || 'video',
                new Date(active.startedAt),
                endedAt,
                durationSeconds
            ]
        );
    } else if (!active.startedAt && active.targetId && endedByUserId && endedByUserId === active.initiatorId) {
        const callerResult = await query(
            'SELECT display_name FROM users WHERE id = $1',
            [active.initiatorId]
        );
        const callerName = callerResult.rows[0]?.display_name || 'Someone';
        const metadata = {
            conversationId,
            mediaType: active.mediaType || 'video',
            callerId: active.initiatorId,
            callerName,
            url: `/messages?conversation=${conversationId}`
        };
        const missedNotification = await createUserNotification({
            userId: active.targetId,
            type: 'call_missed',
            message: `You missed a call from ${callerName}`,
            entityType: 'conversation',
            entityId: conversationId,
            metadata
        });
        if (missedNotification) {
            io.to(`user-${active.targetId}`).emit('notification', missedNotification);
        }
    }

    activeCalls.delete(conversationId);
};

const scheduleCallDurationLimit = (conversationId, durationMs, psychologistId) => {
    if (!durationMs || durationMs <= 0) return;
    const active = activeCalls.get(conversationId);
    if (!active) return;
    if (active.timer) {
        clearTimeout(active.timer);
    }
    active.maxDurationMs = durationMs;
    active.timer = setTimeout(() => {
        endCallSession(conversationId, 'duration_limit', psychologistId, { system: true });
    }, durationMs);
    activeCalls.set(conversationId, active);
};

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

            const convo = conversationAccess.rows[0];
            const recipientId = convo.employee_id === socket.userId ? convo.psychologist_id : convo.employee_id;
            const senderName = message.sender?.display_name || 'Someone';
            const metadata = {
                conversationId,
                senderId: socket.userId,
                senderName,
                preview: String(content).slice(0, 140),
                url: `/messages?conversation=${conversationId}`
            };
            const notification = await createUserNotification({
                userId: recipientId,
                type: 'message',
                message: `${senderName} sent you a message`,
                entityType: 'conversation',
                entityId: conversationId,
                metadata
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
              const callerCapabilities = await getUserCallCapabilities(socket.userId);
              if (callerCapabilities.role === 'employee' && !callerCapabilities.canInitiate) {
                  return socket.emit('error', {
                      message: 'Upgrade to a paid plan to initiate calls.',
                      code: 'CALL_BLOCKED_FREE_TIER'
                  });
              }
              const convoParticipants = await query(
                  `SELECT employee_id, psychologist_id FROM conversations WHERE id = $1`,
                  [conversationId]
              );
              if (!convoParticipants.rows.length) {
                  return socket.emit('error', { message: 'Conversation not found' });
              }
              const row = convoParticipants.rows[0];
              const employeeCapabilities = await getUserCallCapabilities(row.employee_id);
              const isEmployeeFreeTier = employeeCapabilities.role === 'employee' && employeeCapabilities.tier === 'free';
              const targetId = row.employee_id === socket.userId ? row.psychologist_id : row.employee_id;
              const existing = activeCalls.get(conversationId) || {};
              activeCalls.set(conversationId, {
                  ...existing,
                  mediaType: mediaType || existing.mediaType || 'video',
                  startedAt: existing.startedAt || null,
                  initiatorId: socket.userId,
                  targetId,
                  employeeId: row.employee_id,
                  psychologistId: row.psychologist_id,
                  isEmployeeFreeTier,
                  timer: existing.timer || null,
                  maxDurationMs: existing.maxDurationMs || null
              });
              const callerResult = await query(
                  'SELECT display_name FROM users WHERE id = $1',
                  [socket.userId]
              );
            const callerName = callerResult.rows[0]?.display_name || 'Someone';
            io.to(`conversation-${conversationId}`).emit('call:offer', {
                conversationId,
                sdp,
                mediaType,
                fromUserId: socket.userId,
                callerName
            });
            if (targetId) {
                const metadata = {
                    conversationId,
                    mediaType: mediaType || 'video',
                    callerId: socket.userId,
                    callerName,
                    url: `/messages?conversation=${conversationId}&focus=call`
                };
                const incomingNotification = await createUserNotification({
                    userId: targetId,
                    type: 'call_incoming',
                    message: `${callerName} is calling you`,
                    entityType: 'conversation',
                    entityId: conversationId,
                    metadata
                });
                if (incomingNotification) {
                    io.to(`user-${targetId}`).emit('notification', incomingNotification);
                }
            }
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
                  if (active.isEmployeeFreeTier && active.psychologistId) {
                      const psychologistCapabilities = await getUserCallCapabilities(active.psychologistId);
                      const limitMinutes = Math.max(
                          1,
                          Number(
                              psychologistCapabilities.callMinutes ||
                              ROLE_FLAGS.psychologist?.call_minutes_per_client ||
                              0
                          )
                      );
                      if (limitMinutes > 0) {
                          scheduleCallDurationLimit(conversationId, limitMinutes * 60 * 1000, active.psychologistId);
                      }
                  }
                  activeCalls.set(conversationId, active);
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
              await endCallSession(conversationId, reason || 'ended', socket.userId);
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

const formatDbError = (error) => {
    if (!error) return 'Unknown database error';
    const details = [
        error.message,
        error.code ? `code=${error.code}` : null,
        error.name ? `name=${error.name}` : null
    ].filter(Boolean);
    return details.length ? details.join(' | ') : String(error);
};

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
            console.log(`⚠️ Database connection attempt ${i + 1}/${retries} failed:`, formatDbError(error));
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

