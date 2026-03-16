
const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { checkRoleFlag } = require('../middleware/roleFlags');
const { messageLimiter, apiLimiter } = require('../middleware/rateLimiter');
const { validate, messageValidation } = require('../middleware/validation');
const messageController = require('../controllers/messageController');
const { applyTierLimits } = require('../middleware/applyTierLimits');

const router = express.Router();


router.post('/conversations/request',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('message_request'),
    validate([
        body('employeeId').isUUID(),
        body('initialMessage').optional().trim().isLength({ max: 2000 })
    ]),
    messageController.sendMessageRequest
);


router.get('/conversations/pending',
    authenticate,
    authorize('employee', 'psychologist'),
    checkRoleFlag('conversation_approval'),
    messageController.getPendingRequests
);

router.patch('/conversations/:conversationId/status',
    authenticate,
    authorize('employee', 'psychologist'),
    checkRoleFlag('conversation_approval'),
    messageController.updateConversationStatus
);



router.post('/request-chat',
    authenticate,
    authorize('employee'),
    validate([
        body('psychologistId').isUUID(),
        body('sessionMinutes').isInt({ min: 5, max: 120 }).withMessage('Session minutes must be between 5 and 120'),
        body('initialMessage').optional().trim()
    ]),
    messageController.requestChatWithPsychologist
);

router.get('/available-psychologists',
    authenticate,
    authorize('employee'),
    apiLimiter,
    messageController.getAvailablePsychologists
);


router.get('/conversations',
    authenticate,
    messageController.getConversations
);

router.get('/chat-usage',
    authenticate,
    authorize('employee'),
    messageController.getChatUsageSummary
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

router.post('/conversations/:conversationId/video/start',
    authenticate,
    applyTierLimits({ feature: 'video' }),
    messageController.startVideoSession
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
