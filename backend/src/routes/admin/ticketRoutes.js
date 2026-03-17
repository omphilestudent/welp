const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validation');
const ticketController = require('../../controllers/ticketController');

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin', 'super_admin'));

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
