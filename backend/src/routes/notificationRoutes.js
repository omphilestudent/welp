const express = require('express');
const { authenticate } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

router.use(authenticate);

router.get('/', notificationController.listNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/:id/read', notificationController.markNotificationRead);
router.patch('/read/all', notificationController.markAllRead);
router.post('/permission', notificationController.updatePermission);

module.exports = router;
