const express = require('express');
const { authenticateOptional } = require('../middleware/auth');
const flowRuntimeController = require('../controllers/flowRuntimeController');

const router = express.Router();

router.post('/:flowId/start', authenticateOptional, flowRuntimeController.startFlowSession);
router.post('/:flowId/sessions/:sessionId/submit', authenticateOptional, flowRuntimeController.submitFlowSession);

module.exports = router;
