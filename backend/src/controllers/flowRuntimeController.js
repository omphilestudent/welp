const { startScreenFlow, submitScreenFlowStep } = require('../services/flowEngine');

const handleFlowError = (error, res) => {
    const status = error.statusCode || 500;
    if (status >= 500) {
        console.error('Flow runtime error:', error);
    }
    return res.status(status).json({
        success: false,
        error: error.message || 'Flow runtime failed'
    });
};

const startFlowSession = async (req, res) => {
    try {
        const actorRole = req.user?.role || 'anonymous';
        const payload = await startScreenFlow({
            flowId: req.params.flowId,
            userId: req.user?.id || null,
            previewMode: Boolean(req.body?.preview),
            actorRole,
            initialContext: req.body?.context || {},
            metadata: {
                actorId: req.user?.id || null,
                previewRequestedBy: req.body?.preview ? (req.user?.id || 'admin-preview') : null
            }
        });
        return res.json({ success: true, data: payload });
    } catch (error) {
        return handleFlowError(error, res);
    }
};

const submitFlowSession = async (req, res) => {
    try {
        const actorRole = req.user?.role || 'anonymous';
        const payload = await submitScreenFlowStep({
            flowId: req.params.flowId,
            sessionId: req.params.sessionId,
            answers: req.body?.answers || {},
            userId: req.user?.id || null,
            actorRole
        });

        if (payload.validationErrors) {
            return res.status(422).json({
                success: false,
                error: 'Validation failed',
                errors: payload.validationErrors,
                data: {
                    node: payload.node,
                    sessionId: payload.sessionId
                }
            });
        }

        return res.json({ success: true, data: payload });
    } catch (error) {
        return handleFlowError(error, res);
    }
};

module.exports = {
    startFlowSession,
    submitFlowSession
};
