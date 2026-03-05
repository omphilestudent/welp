
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
const reviewRoutes = require('./routes/reviewRoutes');
const messageRoutes = require('./routes/messageRoutes');
const userRoutes = require('./routes/userRoutes');
const psychologistRoutes = require('./routes/psychologistRoutes');
const pricingRoutes = require('./routes/pricingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const hrRoutes = require('./routes/hrRoutes');
let rbacUserRoutes;
let roleRoutes;
let authV2Routes;
let sequelize;

try {
    rbacUserRoutes = require('./routes/rbacUserRoutes');
    roleRoutes = require('./routes/roleRoutes');
    authV2Routes = require('./routes/authV2Routes');
    ({ sequelize } = require('./models'));
} catch (error) {
    console.warn('⚠️ RBAC Sequelize module unavailable:', error.message);
}

const frontendOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const weakJwtSecret = !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes('change-in-production');
if (weakJwtSecret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is missing or too weak. Use at least 32 characters and never use placeholders.');
}
if (weakJwtSecret) {
    console.warn('⚠️ Weak JWT_SECRET detected. Update it before production deployment.');
}

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || frontendOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error('CORS policy violation'));
    },
    credentials: true
};

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: corsOptions });


app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors(corsOptions));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/', apiLimiter);


app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);
app.use('/api/psychologists', psychologistRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/hr', hrRoutes);
if (authV2Routes && rbacUserRoutes && roleRoutes) {
    app.use('/api/rbac/auth', authV2Routes);
    app.use('/api/rbac/users', rbacUserRoutes);
    app.use('/api/rbac/roles', roleRoutes);
}


app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});


io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error'));
    }

    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        next();
    } catch (err) {
        next(new Error('Authentication error'));
    }
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.userId);

    socket.on('join-conversation', (conversationId) => {
        socket.join(`conversation-${conversationId}`);
    });

    socket.on('leave-conversation', (conversationId) => {
        socket.leave(`conversation-${conversationId}`);
    });

    socket.on('send-message', async (data) => {
        try {
            const { conversationId, content } = data;

            const { query } = require('./utils/database');

            const conversationAccess = await query(
                `SELECT id FROM conversations
                 WHERE id = $1 AND (employee_id = $2 OR psychologist_id = $2)`,
                [conversationId, socket.userId]
            );

            if (conversationAccess.rows.length === 0) {
                return socket.emit('error', { message: 'Unauthorized conversation access' });
            }

            const result = await query(
                `INSERT INTO messages (conversation_id, sender_id, content)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [conversationId, socket.userId, content]
            );

            const sender = await query(
                'SELECT id, display_name, role FROM users WHERE id = $1',
                [socket.userId]
            );

            await query(
                'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
                [conversationId]
            );

            const message = {
                ...result.rows[0],
                sender: sender.rows[0]
            };

            io.to(`conversation-${conversationId}`).emit('new-message', message);
        } catch (error) {
            console.error('Socket message error:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.userId);
    });
});

const PORT = process.env.PORT || 5000;

(async () => {
    if (sequelize) {
        try {
            await sequelize.authenticate();
            console.log('✅ Sequelize connection initialized');
        } catch (error) {
            console.warn('⚠️ Sequelize connection unavailable:', error.message);
        }
    }

    httpServer.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
})();

module.exports = { app, httpServer };
