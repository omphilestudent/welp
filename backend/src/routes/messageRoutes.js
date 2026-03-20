
const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, authorize } = require('../middleware/auth');
const { checkRoleFlag } = require('../middleware/roleFlags');
const { messageLimiter, apiLimiter } = require('../middleware/rateLimiter');
const { validate, messageValidation } = require('../middleware/validation');
const messageController = require('../controllers/messageController');
const { applyTierLimits } = require('../middleware/applyTierLimits');
const { restrictUnverifiedPsychologist } = require('../middleware/restrictUnverifiedPsychologist');

const router = express.Router();

const voiceUploadDir = path.join(__dirname, '../../uploads/messages');
fs.mkdirSync(voiceUploadDir, { recursive: true });

const voiceStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, voiceUploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase() || '.webm';
        const safeName = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        cb(null, safeName);
    }
});

const voiceUpload = multer({
    storage: voiceStorage,
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype?.startsWith('audio/')) {
            return cb(new Error('Only audio files are allowed'));
        }
        return cb(null, true);
    }
});


router.post('/conversations/request',
    authenticate,
    authorize('psychologist'),
    checkRoleFlag('message_request'),
    restrictUnverifiedPsychologist,
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
    restrictUnverifiedPsychologist,
    messageController.getPendingRequests
);

router.patch('/conversations/:conversationId/status',
    authenticate,
    authorize('employee', 'psychologist'),
    checkRoleFlag('conversation_approval'),
    restrictUnverifiedPsychologist,
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

router.post('/conversations/:conversationId/extend',
    authenticate,
    authorize('employee'),
    validate([
        body('extendMinutes').optional().isInt({ min: 5, max: 60 })
    ]),
    messageController.extendConversation
);

router.get('/available-psychologists',
    authenticate,
    authorize('employee'),
    apiLimiter,
    messageController.getAvailablePsychologists
);

router.get('/favorites/psychologists',
    authenticate,
    authorize('employee'),
    messageController.getPsychologistFavorites
);

router.post('/favorites/psychologists',
    authenticate,
    authorize('employee'),
    validate([
        body('psychologistId').isUUID()
    ]),
    messageController.addPsychologistFavorite
);

router.delete('/favorites/psychologists/:psychologistId',
    authenticate,
    authorize('employee'),
    messageController.removePsychologistFavorite
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
    restrictUnverifiedPsychologist,
    validate(messageValidation),
    messageController.sendMessage
);

router.post('/conversations/:conversationId/voice-notes',
    authenticate,
    messageLimiter,
    restrictUnverifiedPsychologist,
    (req, res) => {
        voiceUpload.single('voice')(req, res, (err) => {
            if (err) {
                return res.status(400).json({ error: err.message || 'Failed to upload voice note' });
            }
            return messageController.sendVoiceNote(req, res);
        });
    }
);

router.post('/conversations/:conversationId/video/start',
    authenticate,
    applyTierLimits({ feature: 'video' }),
    restrictUnverifiedPsychologist,
    messageController.startVideoSession
);

router.post('/conversations/:conversationId/extend',
    authenticate,
    authorize('employee'),
    validate([
        body('extendMinutes').optional().isInt({ min: 5, max: 60 })
    ]),
    messageController.extendConversation
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
