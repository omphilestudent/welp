const express = require('express');
const { authenticate, authorize } = require('../../middleware/auth');
const flowController = require('../../controllers/flowController');

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin', 'super_admin'));

router.get('/meta/events', flowController.listEventsController);
router.get('/triggers', flowController.listTriggersController);
router.post('/triggers', flowController.createTriggerController);
router.put('/triggers/:triggerId', flowController.updateTriggerController);
router.delete('/triggers/:triggerId', flowController.deleteTriggerController);

router.get('/', flowController.listFlowController);
router.post('/', flowController.createFlowController);
router.get('/:id/logs', flowController.listFlowLogsController);
router.post('/:id/execute', flowController.executeFlowController);
router.get('/:id', flowController.getFlowController);
router.put('/:id', flowController.updateFlowController);
router.delete('/:id', flowController.deleteFlowController);

module.exports = router;
