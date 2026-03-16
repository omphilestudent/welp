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

router.get('/components', flowController.listComponentsController);
router.post('/components', flowController.createComponentController);
router.put('/components/:componentId', flowController.updateComponentController);
router.delete('/components/:componentId', flowController.deleteComponentController);

router.get('/', flowController.listFlowController);
router.post('/', flowController.createFlowController);
router.get('/:id/logs', flowController.listFlowLogsController);
router.get('/:id/versions', flowController.listVersionsController);
router.post('/:id/versions/:versionId/rollback', flowController.rollbackVersionController);
router.get('/:id/permissions', flowController.listPermissionsController);
router.put('/:id/permissions', flowController.updatePermissionsController);
router.get('/:id/analytics', flowController.getAnalyticsController);
router.post('/:id/execute', flowController.executeFlowController);
router.get('/:id', flowController.getFlowController);
router.put('/:id', flowController.updateFlowController);
router.delete('/:id', flowController.deleteFlowController);

module.exports = router;
