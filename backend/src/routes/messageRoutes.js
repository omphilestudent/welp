// backend/src/routes/messageRoutes.js
const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { messageLimiter } = require('../middleware/rateLimiter');
const { validate, messageValidation } = require('../middleware/validation');
const messageController = require('../controllers/messageController');

const router = express.Router();

// Psychologist routes
router.post('/conversations/request',
    authenticate,
    authorize('psychologist'),
    validate(messageValidation),
    messageController.sendMessageRequest
);

// Employee routes
router.get('/conversations/pending',
    authenticate,
    authorize('employee'),
    messageController.getPendingRequests
);

router.patch('/conversations/:conversationId/status',
    authenticate,
    authorize('employee'),
    messageController.updateConversationStatus
);

// Shared routes
router.get('/conversations',
    authenticate,
    messageController.getConversations
);

router.get('/conversations/:conversationId/messages',
    authenticate,
    messageController.getConversationMessages
);

router.post('/conversations/:conversationId/messages',
    authenticate,
    messageLimiter,
    validate(messageValidation),
    messageController.sendMessage
);

router.post('/conversations/:conversationId/read',
    authenticate,
    messageController.markMessagesAsRead
);

router.get('/unread-count',
    authenticate,
    messageController.getUnreadCount
);

router.post('/conversations/:conversationId/block',
    authenticate,
    authorize('employee'),
    messageController.blockConversation
);

router.delete('/conversations/:conversationId',
    authenticate,
    messageController.deleteConversation
);

module.exports = router;