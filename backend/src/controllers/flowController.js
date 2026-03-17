const {
    listFlows,
    getFlowById,
    createFlow,
    updateFlow,
    deleteFlow,
    listExecutionLogs,
    listFlowTriggers,
    createFlowTrigger,
    updateFlowTrigger,
    deleteFlowTrigger,
    listFlowVersions,
    rollbackFlowVersion,
    listFlowComponents,
    createFlowComponent,
    updateFlowComponent,
    deleteFlowComponent,
    getFlowAnalytics,
    getFlowPermissions,
    upsertFlowPermission
} = require('../services/flowService');
const { AVAILABLE_FLOW_EVENTS, executeFlow } = require('../services/flowEngine');

const parseBoolean = (value) => {
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        return ['true', '1', 'yes'].includes(value.toLowerCase());
    }
    return Boolean(value);
};

const ensureJsonDefinition = (definition) => {
    if (!definition) return {};
    if (typeof definition === 'object') return definition;
    try {
        return JSON.parse(definition);
    } catch {
        throw new Error('Flow definition must be valid JSON');
    }
};

const ALLOWED_FLOW_TYPES = new Set(['screen', 'trigger']);

const hasEndNode = (definition) => {
    const nodes = Array.isArray(definition?.nodes) ? definition.nodes : [];
    if (!nodes.length) return true;
    return nodes.some((node) => node?.type === 'end');
};

const formatFlow = (flow) => {
    if (!flow) return null;
    return {
        id: flow.id,
        name: flow.name,
        description: flow.description,
        type: flow.type,
        definition: flow.definition || {},
        isActive: flow.isActive !== false && flow.is_active !== false,
        createdBy: flow.createdBy || flow.created_by || null,
        updatedBy: flow.updatedBy || flow.updated_by || null,
        createdAt: flow.created_at || flow.createdAt,
        updatedAt: flow.updated_at || flow.updatedAt
    };
};

const listFlowController = async (req, res) => {
    try {
        const flows = await listFlows({
            type: req.query.type,
            search: req.query.search,
            isActive: req.query.isActive !== undefined ? parseBoolean(req.query.isActive) : undefined
        });
        res.json({ success: true, data: flows.map(formatFlow) });
    } catch (error) {
        console.error('Error listing flows:', error);
        res.status(500).json({ success: false, error: 'Failed to load flows' });
    }
};

const getFlowController = async (req, res) => {
    try {
        const flow = await getFlowById(req.params.id);
        if (!flow) {
            return res.status(404).json({ success: false, error: 'Flow not found' });
        }
        return res.json({ success: true, data: formatFlow(flow) });
    } catch (error) {
        console.error('Error loading flow:', error);
        return res.status(500).json({ success: false, error: 'Failed to load flow' });
    }
};

const createFlowController = async (req, res) => {
    try {
        const { name, description, type } = req.body;
        if (!name || !type) {
            return res.status(400).json({ success: false, error: 'Name and type are required' });
        }
        if (!ALLOWED_FLOW_TYPES.has(String(type).toLowerCase())) {
            return res.status(400).json({ success: false, error: 'Invalid flow type' });
        }

        const definition = ensureJsonDefinition(req.body.definition);
        if (!hasEndNode(definition)) {
            return res.status(400).json({ success: false, error: 'Flow must include an End node' });
        }
        const flow = await createFlow({
            name: name.trim(),
            description: description?.trim() || null,
            type: String(type).toLowerCase(),
            definition,
            isActive: req.body.isActive !== false,
            userId: req.user?.id
        });
        return res.status(201).json({ success: true, data: formatFlow(flow) });
    } catch (error) {
        console.error('Error creating flow:', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to create flow' });
    }
};

const updateFlowController = async (req, res) => {
    try {
        const updates = {};
        ['name', 'description', 'type'].forEach((key) => {
            if (req.body[key] !== undefined) {
                updates[key] = req.body[key];
            }
        });
        if (updates.type !== undefined) {
            const normalizedType = String(updates.type).toLowerCase();
            if (!ALLOWED_FLOW_TYPES.has(normalizedType)) {
                return res.status(400).json({ success: false, error: 'Invalid flow type' });
            }
            updates.type = normalizedType;
        }
        if (req.body.definition !== undefined) {
            updates.definition = ensureJsonDefinition(req.body.definition);
            if (!hasEndNode(updates.definition)) {
                return res.status(400).json({ success: false, error: 'Flow must include an End node' });
            }
        }
        if (req.body.isActive !== undefined) {
            updates.isActive = parseBoolean(req.body.isActive);
        }
        updates.updatedBy = req.user?.id || null;

        const flow = await updateFlow(req.params.id, updates);
        if (!flow) {
            return res.status(404).json({ success: false, error: 'Flow not found' });
        }
        return res.json({ success: true, data: formatFlow(flow) });
    } catch (error) {
        console.error('Error updating flow:', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to update flow' });
    }
};

const deleteFlowController = async (req, res) => {
    try {
        const deleted = await deleteFlow(req.params.id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Flow not found' });
        }
        return res.json({ success: true, data: formatFlow(deleted) });
    } catch (error) {
        console.error('Error deleting flow:', error);
        return res.status(500).json({ success: false, error: 'Failed to delete flow' });
    }
};

const listFlowLogsController = async (req, res) => {
    try {
        const limit = Number(req.query.limit) || 25;
        const logs = await listExecutionLogs(req.params.id, limit);
        res.json({ success: true, data: logs });
    } catch (error) {
        console.error('Error fetching flow logs:', error);
        res.status(500).json({ success: false, error: 'Failed to load flow logs' });
    }
};

const executeFlowController = async (req, res) => {
    try {
        const context = {
            ...req.body?.context,
            actorId: req.user?.id
        };
        const execution = await executeFlow(req.params.id, context);
        if (!execution) {
            return res.status(404).json({ success: false, error: 'Flow not available' });
        }
        return res.json({ success: true, data: execution });
    } catch (error) {
        console.error('Error executing flow:', error);
        return res.status(500).json({ success: false, error: 'Failed to execute flow' });
    }
};

const listEventsController = (_req, res) => {
    res.json({ success: true, events: AVAILABLE_FLOW_EVENTS });
};

const listTriggersController = async (_req, res) => {
    try {
        const triggers = await listFlowTriggers();
        res.json({ success: true, data: triggers });
    } catch (error) {
        console.error('Error listing triggers:', error);
        res.status(500).json({ success: false, error: 'Failed to load triggers' });
    }
};

const createTriggerController = async (req, res) => {
    try {
        const { flowId, eventName, conditions, isActive } = req.body;
        if (!flowId || !eventName) {
            return res.status(400).json({ success: false, error: 'Flow and event are required' });
        }
        const trigger = await createFlowTrigger({
            flowId,
            eventName,
            conditions: conditions || {},
            isActive: isActive !== false
        });
        res.status(201).json({ success: true, data: trigger });
    } catch (error) {
        console.error('Error creating trigger:', error);
        res.status(500).json({ success: false, error: 'Failed to create trigger' });
    }
};

const updateTriggerController = async (req, res) => {
    try {
        const trigger = await updateFlowTrigger(req.params.triggerId, {
            flowId: req.body.flowId,
            eventName: req.body.eventName,
            conditions: req.body.conditions,
            isActive: req.body.isActive
        });
        if (!trigger) {
            return res.status(404).json({ success: false, error: 'Trigger not found' });
        }
        return res.json({ success: true, data: trigger });
    } catch (error) {
        console.error('Error updating trigger:', error);
        return res.status(500).json({ success: false, error: 'Failed to update trigger' });
    }
};

const deleteTriggerController = async (req, res) => {
    try {
        const deleted = await deleteFlowTrigger(req.params.triggerId);
        if (!deleted) {
            return res.status(404).json({ success: false, error: 'Trigger not found' });
        }
        return res.json({ success: true, data: deleted });
    } catch (error) {
        console.error('Error deleting trigger:', error);
        return res.status(500).json({ success: false, error: 'Failed to delete trigger' });
    }
};

const listVersionsController = async (req, res) => {
    try {
        const versions = await listFlowVersions(req.params.id, Number(req.query.limit) || 20);
        res.json({ success: true, data: versions });
    } catch (error) {
        console.error('Error listing versions:', error);
        res.status(500).json({ success: false, error: 'Failed to load versions' });
    }
};

const rollbackVersionController = async (req, res) => {
    try {
        const result = await rollbackFlowVersion({
            flowId: req.params.id,
            versionId: req.params.versionId,
            userId: req.user?.id
        });
        if (!result) {
            return res.status(404).json({ success: false, error: 'Version not found' });
        }
        res.json({ success: true, data: formatFlow(result.flow) });
    } catch (error) {
        console.error('Error rolling back flow:', error);
        res.status(500).json({ success: false, error: 'Failed to rollback flow' });
    }
};

const listComponentsController = async (req, res) => {
    try {
        const components = await listFlowComponents({ type: req.query.type });
        res.json({ success: true, data: components });
    } catch (error) {
        console.error('Error listing components:', error);
        res.status(500).json({ success: false, error: 'Failed to load components' });
    }
};

const createComponentController = async (req, res) => {
    try {
        const component = await createFlowComponent({
            name: req.body.name,
            description: req.body.description,
            componentType: req.body.type,
            config: req.body.config || {},
            isShared: req.body.isShared !== false,
            userId: req.user?.id
        });
        res.status(201).json({ success: true, data: component });
    } catch (error) {
        console.error('Error creating component:', error);
        res.status(500).json({ success: false, error: 'Failed to create component' });
    }
};

const updateComponentController = async (req, res) => {
    try {
        const component = await updateFlowComponent(req.params.componentId, {
            name: req.body.name,
            description: req.body.description,
            componentType: req.body.type,
            config: req.body.config,
            isShared: req.body.isShared,
            updatedBy: req.user?.id
        });
        if (!component) {
            return res.status(404).json({ success: false, error: 'Component not found' });
        }
        res.json({ success: true, data: component });
    } catch (error) {
        console.error('Error updating component:', error);
        res.status(500).json({ success: false, error: 'Failed to update component' });
    }
};

const deleteComponentController = async (req, res) => {
    try {
        const component = await deleteFlowComponent(req.params.componentId);
        if (!component) {
            return res.status(404).json({ success: false, error: 'Component not found' });
        }
        res.json({ success: true, data: component });
    } catch (error) {
        console.error('Error deleting component:', error);
        res.status(500).json({ success: false, error: 'Failed to delete component' });
    }
};

const getAnalyticsController = async (req, res) => {
    try {
        const days = Number(req.query.days) || 30;
        const analytics = await getFlowAnalytics(req.params.id, days);
        res.json({ success: true, data: analytics });
    } catch (error) {
        console.error('Error loading analytics:', error);
        res.status(500).json({ success: false, error: 'Failed to load analytics' });
    }
};

const listPermissionsController = async (req, res) => {
    try {
        const permissions = await getFlowPermissions(req.params.id);
        res.json({ success: true, data: permissions });
    } catch (error) {
        console.error('Error listing permissions:', error);
        res.status(500).json({ success: false, error: 'Failed to load permissions' });
    }
};

const updatePermissionsController = async (req, res) => {
    try {
        const { role, permissions } = req.body;
        if (!role) {
            return res.status(400).json({ success: false, error: 'Role is required' });
        }
        await upsertFlowPermission(req.params.id, role.toLowerCase(), permissions || {});
        const updated = await getFlowPermissions(req.params.id);
        res.json({ success: true, data: updated });
    } catch (error) {
        console.error('Error updating permissions:', error);
        res.status(500).json({ success: false, error: 'Failed to update permissions' });
    }
};

module.exports = {
    listFlowController,
    getFlowController,
    createFlowController,
    updateFlowController,
    deleteFlowController,
    listFlowLogsController,
    executeFlowController,
    listEventsController,
    listTriggersController,
    createTriggerController,
    updateTriggerController,
    deleteTriggerController,
    listVersionsController,
    rollbackVersionController,
    listComponentsController,
    createComponentController,
    updateComponentController,
    deleteComponentController,
    getAnalyticsController,
    listPermissionsController,
    updatePermissionsController
};
