const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const ticketController = require('../controllers/ticketController');

const router = express.Router();

router.use(authenticate);

router.post('/',
    validate([
        body('title').trim().isLength({ min: 3, max: 200 }),
        body('description').trim().isLength({ min: 5 }),
        body('priority').isIn(['low', 'medium', 'high']),
        body('category').optional().trim().isLength({ max: 120 })
    ]),
    ticketController.createTicket
);

router.get('/', ticketController.listTickets);
router.get('/:id', ticketController.getTicket);

router.put('/:id',
    validate([
        body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']),
        body('priority').optional().isIn(['low', 'medium', 'high']),
        body('assignedToUserId').optional().isUUID(),
        body('category').optional().trim().isLength({ max: 120 })
    ]),
    ticketController.updateTicket
);

router.delete('/:id', ticketController.deleteTicket);

router.get('/:id/history', ticketController.getTicketHistory);
router.post('/:id/history',
    validate([
        body('notes').trim().isLength({ min: 2, max: 4000 })
    ]),
    ticketController.addTicketHistory
);

module.exports = router;
