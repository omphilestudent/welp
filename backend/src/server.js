// backend/src/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { createServer } = require('http');
const { Server } = require('socket.io');
const psychologistRoutes = require('./routes/psychologistRoutes');
const userRoutes = require('./routes/userRoutes');
require('dotenv').config();

const { apiLimiter } = require('./middleware/rateLimiter');
const authRoutes = require('./routes/authRoutes');
const companyRoutes = require('./routes/companyRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const messageRoutes = require('./routes/messageRoutes');
const path = require('path');
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true
    }
});

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use('/api/', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/psychologists', psychologistRoutes);
app.use('/api/users', userRoutes);
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Socket.io for real-time messaging
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

            // Save message to database
            const { query } = require('./utils/database');
            const result = await query(
                `INSERT INTO messages (conversation_id, sender_id, content)
         VALUES ($1, $2, $3)
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
                'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
                [conversationId]
            );

            const message = {
                ...result.rows[0],
                sender: sender.rows[0]
            };

            // Broadcast to conversation room
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
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = { app, httpServer };