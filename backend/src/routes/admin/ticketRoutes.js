const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../../middleware/auth');
const { authorizeAdmin } = require('../../middleware/adminAuth');
const { validate } = require('../../middleware/validation');
const ticketController = require('../../controllers/ticketController');

const router = express.Router();

router.use(authenticate);
router.use(authorizeAdmin());

router.get('/', ticketController.listTickets);

router.put('/:id/assign',
    validate([
        body('assignedToUserId').isUUID()
    ]),
    ticketController.assignTicket
);

router.post('/:id/access',
    validate([
        body('userId').isUUID()
    ]),
    ticketController.addTicketAccess
);

router.delete('/:id/access/:userId',
    ticketController.removeTicketAccess
);

module.exports = router;
