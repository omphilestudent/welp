const { createAdminNotification } = require('../utils/adminNotifications');
const { createUserNotification } = require('../utils/userNotifications');
const { sendEmail } = require('../utils/emailService');
const flowService = require('./flowService');

const AVAILABLE_FLOW_EVENTS = [
    {
        name: 'user.signup',
        label: 'New User Signup',
        description: 'Triggered when a user (any role) completes registration.'
    },
    {
        name: 'subscription.changed',
        label: 'Subscription Change',
        description: 'Triggered when a subscription is started, upgraded, downgraded, or cancelled.'
    },
    {
        name: 'message.created',
        label: 'Incoming Message',
        description: 'Triggered when a new conversation message is created.'
    }
];
const MAX_NODE_ITERATIONS = 100;

const getNestedValue = (obj = {}, path = '') => {
    if (!path) return undefined;
    return path.split('.').reduce((acc, key) => {
        if (acc === null || acc === undefined) return undefined;
        if (Array.isArray(acc)) {
            const index = Number(key);
            return Number.isNaN(index) ? undefined : acc[index];
        }
        return acc[key];
    }, obj);
};

const renderTemplate = (template, context = {}) => {
    if (typeof template !== 'string') return template;
    return template.replace(/{{\s*([^}]+)\s*}}/g, (_match, token) => {
        const value = getNestedValue(context, token.trim());
        return value === undefined || value === null ? '' : String(value);
    });
};

const matchesConditions = (conditions = {}, payload = {}) => {
    if (!conditions || typeof conditions !== 'object') return true;
    const { match = {}, exclude = {} } = conditions;

    const passesMatch = Object.entries(match).every(([key, expected]) => {
        const value = getNestedValue(payload, key);
        if (Array.isArray(expected)) {
            return expected.includes(value);
        }
        if (expected && typeof expected === 'object') {
            if (Array.isArray(expected.oneOf)) {
                return expected.oneOf.includes(value);
            }
            if (expected.eq !== undefined) {
                return value === expected.eq;
            }
        }
        return value === expected;
    });

    if (!passesMatch) return false;

    const passesExclude = Object.entries(exclude).every(([key, forbidden]) => {
        const value = getNestedValue(payload, key);
        if (Array.isArray(forbidden)) {
            return !forbidden.includes(value);
        }
        return value !== forbidden;
    });

    return passesExclude;
};

const executeNode = async (node = {}, context = {}, flow = {}, options = {}) => {
    const type = node.type || node.actionType || node.kind;
    const result = {
        id: node.id || node.name || type,
        type,
        status: 'skipped'
    };

    if (!type) {
        result.error = 'Missing action type';
        return result;
    }

    if (type === 'log') {
        const message = renderTemplate(node.message || 'Flow log entry', context);
        console.log(`[Flow ${flow.name}] ${message}`);
        result.status = 'completed';
        result.detail = message;
        return result;
    }

    if (type === 'admin_notification') {
        await createAdminNotification({
            type: node.category || 'flow.event',
            message: renderTemplate(node.message || flow.name, context),
            entityType: node.entityType || options?.trigger?.eventName || context.eventName,
            entityId: node.entityId || context.entityId || null
        });
        result.status = 'completed';
        return result;
    }

    if (type === 'user_notification') {
        await createUserNotification({
            userId: node.userId || context.userId || context.targetUserId,
            type: node.category || 'flow.notification',
            message: renderTemplate(node.message || flow.name, context),
            entityType: node.entityType || 'flow',
            entityId: node.entityId || flow.id,
            metadata: {
                flowId: flow.id,
                eventName: context.eventName
            }
        });
        result.status = 'completed';
        return result;
    }

    if (type === 'email') {
        const recipients = node.to || context.email;
        if (!recipients) {
            result.status = 'skipped';
            result.detail = 'No recipient provided';
            return result;
        }
        await sendEmail({
            to: recipients,
            subject: renderTemplate(node.subject || `Update from ${flow.name}`, context),
            text: renderTemplate(node.text || node.message || '', context),
            html: node.html ? renderTemplate(node.html, context) : undefined
        });
        result.status = 'completed';
        return result;
    }

    result.status = 'skipped';
    result.detail = `Unsupported action type ${type}`;
    return result;
};

const runFlowDefinition = async (flow, context = {}, options = {}) => {
    const definition = flow.definition || {};
    const steps = Array.isArray(definition.actions)
        ? definition.actions
        : Array.isArray(definition.nodes)
            ? definition.nodes
            : Array.isArray(definition.steps)
                ? definition.steps
                : [];

    const results = [];
    for (const node of steps) {
        // eslint-disable-next-line no-await-in-loop
        const nodeResult = await executeNode(node, context, flow, options);
        results.push(nodeResult);
    }
    return results;
};

const executeFlow = async (flowOrId, context = {}, options = {}) => {
    const flow = typeof flowOrId === 'object' && flowOrId !== null && flowOrId.id
        ? flowOrId
        : await flowService.getFlowById(flowOrId);

    if (!flow || flow.isActive === false || flow.is_active === false) {
        return null;
    }

    const logEntry = await flowService.logExecutionStart({
        flowId: flow.id,
        userId: context.userId || context.actorId || null,
        flowType: flow.type,
        metadata: {
            eventName: context.eventName,
            triggerId: options?.trigger?.id || context.triggerId || null
        }
    });

    try {
        const actions = await runFlowDefinition(flow, context, options);
        await flowService.logExecutionEnd(logEntry.id, 'completed', { actions });
        return { logId: logEntry.id, actions };
    } catch (error) {
        await flowService.logExecutionEnd(logEntry.id, 'failed', { error: error.message });
        throw error;
    }
};

const emitFlowEvent = async (eventName, payload = {}) => {
    const known = AVAILABLE_FLOW_EVENTS.some((evt) => evt.name === eventName);
    if (!known) {
        console.warn(`[flowEngine] Ignoring unknown event: ${eventName}`);
        return { dispatched: 0 };
    }

    const triggers = await flowService.getActiveTriggersByEvent(eventName);
    let dispatched = 0;
    for (const trigger of triggers) {
        if (!matchesConditions(trigger.conditions, payload)) {
            continue;
        }
        dispatched += 1;
        // eslint-disable-next-line no-await-in-loop
        await executeFlow(trigger.flow || trigger.flowId, {
            ...payload,
            eventName,
            triggerId: trigger.id
        }, { trigger });
    }

    return { dispatched, triggers: triggers.map((t) => t.id) };
};

const getDefinitionNodes = (definition = {}) => {
    if (Array.isArray(definition.nodes)) return definition.nodes;
    if (Array.isArray(definition.steps)) return definition.steps;
    if (Array.isArray(definition.actions)) return definition.actions;
    return [];
};

const getNodeMap = (definition = {}) => {
    const nodes = getDefinitionNodes(definition);
    const lookup = new Map();
    nodes.forEach((node) => {
        if (node && node.id) {
            lookup.set(String(node.id), node);
        }
    });
    return { nodes, lookup };
};

const getStartNodeId = (definition = {}, nodes = []) => {
    return definition.start || definition.startNode || definition.startNodeId || nodes[0]?.id || null;
};

const ensureArrayOptions = (options = []) => {
    if (!Array.isArray(options)) return [];
    return options.map((opt) => {
        if (typeof opt === 'string') {
            return { label: opt, value: opt };
        }
        if (opt && typeof opt === 'object') {
            return {
                label: opt.label || opt.value || opt.id || '',
                value: opt.value ?? opt.id ?? opt.label ?? ''
            };
        }
        return { label: String(opt), value: opt };
    });
};

const serializeScreenNode = (node = {}, context = {}) => {
    if (!node) return null;
    const inputs = Array.isArray(node.inputs) ? node.inputs : [];
    const normalizedInputs = inputs.map((field) => {
        const id = field.id || field.name;
        if (!id) {
            return null;
        }
        const defaultValue = field.default ?? field.initialValue ?? null;
        const value = context[id] ?? defaultValue ?? null;
        return {
            id,
            label: field.label || id,
            type: field.type || 'text',
            placeholder: field.placeholder || '',
            required: Boolean(field.required),
            helpText: field.helpText || field.description || '',
            options: ensureArrayOptions(field.options),
            multiple: Boolean(field.multiple),
            value
        };
    }).filter(Boolean);

    return {
        id: node.id,
        type: 'screen',
        title: node.title || node.heading || 'Step',
        description: node.description || node.body || '',
        inputs: normalizedInputs,
        metadata: node.metadata || {},
        outputs: node.outputs || []
    };
};

const parseBooleanInput = (value) => {
    if (typeof value === 'boolean') return value;
    if (value === undefined || value === null) return null;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
        if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    }
    if (typeof value === 'number') {
        if (value === 1) return true;
        if (value === 0) return false;
    }
    return null;
};

const validateScreenInputs = (node = {}, answers = {}) => {
    const errors = [];
    const values = {};
    const inputs = Array.isArray(node.inputs) ? node.inputs : [];
    inputs.forEach((field) => {
        const id = field.id || field.name;
        if (!id) return;
        const raw = answers[id];
        const type = (field.type || 'text').toLowerCase();
        const required = Boolean(field.required);

        if (required && (raw === undefined || raw === null || raw === '')) {
            errors.push({ field: id, message: `${field.label || id} is required` });
            return;
        }
        if (raw === undefined || raw === null || raw === '') {
            return;
        }

        let parsedValue = raw;
        if (type === 'number') {
            const num = Number(raw);
            if (Number.isNaN(num)) {
                errors.push({ field: id, message: `${field.label || id} must be a number` });
                return;
            }
            parsedValue = num;
        } else if (type === 'boolean' || type === 'toggle' || type === 'checkbox') {
            const boolVal = parseBooleanInput(raw);
            if (boolVal === null) {
                errors.push({ field: id, message: `${field.label || id} must be true or false` });
                return;
            }
            parsedValue = boolVal;
        } else if (type === 'select' || type === 'radio' || type === 'dropdown') {
            const options = ensureArrayOptions(field.options);
            const allowedValues = options.map((opt) => opt.value);
            if (!allowedValues.includes(raw)) {
                errors.push({ field: id, message: `${field.label || id} has an invalid selection` });
                return;
            }
            parsedValue = raw;
        } else if (type === 'multi-select' || field.multiple) {
            const arr = Array.isArray(raw) ? raw : String(raw).split(',').map((token) => token.trim()).filter(Boolean);
            parsedValue = arr;
        } else {
            parsedValue = typeof raw === 'string' ? raw.trim() : raw;
        }
        values[id] = parsedValue;
    });

    return { errors, values };
};

const resolveBranchPointer = (pointer = {}, context = {}) => {
    if (!pointer || typeof pointer !== 'object') return null;
    const branches = pointer.branches || pointer.cases || pointer.routes || [];
    if (Array.isArray(branches)) {
        for (const branch of branches) {
            const condition = branch.when || branch.condition || branch.match || branch;
            const next = branch.next || branch.target || branch.goto;
            if (!next) continue;
            if (matchesConditions(condition, context)) {
                return next;
            }
        }
    }
    return pointer.default || pointer.else || pointer.fallback || null;
};

const resolveNextFromNode = (node, context = {}) => {
    if (!node) return null;
    if (typeof node.next === 'string') return node.next;
    if (typeof node.next === 'object' && node.next !== null) {
        return resolveBranchPointer(node.next, context);
    }
    if (node.branches || node.cases || node.routes) {
        return resolveBranchPointer(node, context);
    }
    return null;
};

const startScreenFlow = async ({
    flowId,
    userId = null,
    previewMode = false,
    initialContext = {},
    metadata = {}
}) => {
    const flow = await flowService.getFlowById(flowId);
    if (!flow) {
        const err = new Error('Flow not found');
        err.statusCode = 404;
        throw err;
    }
    if (String(flow.type || '').toLowerCase() !== 'screen') {
        const err = new Error('Flow is not configured for screen execution');
        err.statusCode = 400;
        throw err;
    }
    const { nodes, lookup } = getNodeMap(flow.definition || {});
    if (!nodes.length) {
        const err = new Error('Flow does not contain any nodes');
        err.statusCode = 400;
        throw err;
    }
    const startNodeId = getStartNodeId(flow.definition || {}, nodes);
    const startNode = lookup.get(startNodeId) || nodes.find((n) => n.type === 'screen') || nodes[0];
    if (!startNode || startNode.type !== 'screen') {
        const err = new Error('Flow start node must be a screen');
        err.statusCode = 400;
        throw err;
    }

    const logEntry = await flowService.logExecutionStart({
        flowId: flow.id,
        userId,
        flowType: flow.type,
        metadata: {
            ...metadata,
            previewMode
        }
    });

    const session = await flowService.createFlowSession({
        flowId: flow.id,
        userId,
        currentNodeId: startNode.id,
        context: initialContext || {},
        previewMode,
        executionLogId: logEntry.id
    });

    return {
        sessionId: session.id,
        status: session.status,
        node: serializeScreenNode(startNode, session.context),
        flow: {
            id: flow.id,
            name: flow.name
        },
        previewMode
    };
};

const submitScreenFlowStep = async ({
    flowId,
    sessionId,
    answers = {},
    userId = null
}) => {
    const session = await flowService.getFlowSessionById(sessionId);
    if (!session) {
        const err = new Error('Session not found');
        err.statusCode = 404;
        throw err;
    }

    if (flowId && session.flowId !== flowId) {
        const err = new Error('Session does not belong to requested flow');
        err.statusCode = 400;
        throw err;
    }

    if (session.status !== 'in_progress') {
        return {
            status: session.status,
            sessionId: session.id,
            context: session.context
        };
    }

    const flow = await flowService.getFlowById(session.flowId);
    if (!flow) {
        const err = new Error('Flow not found');
        err.statusCode = 404;
        throw err;
    }
    if (String(flow.type || '').toLowerCase() !== 'screen') {
        const err = new Error('Flow is not configured for screen execution');
        err.statusCode = 400;
        throw err;
    }

    const { nodes, lookup } = getNodeMap(flow.definition || {});
    const currentNode = lookup.get(session.currentNodeId) || nodes.find((n) => n.id === session.currentNodeId);
    if (!currentNode || currentNode.type !== 'screen') {
        const err = new Error('Current flow node is not a screen');
        err.statusCode = 400;
        throw err;
    }

    const validation = validateScreenInputs(currentNode, answers);
    if (validation.errors.length) {
        return {
            validationErrors: validation.errors,
            node: serializeScreenNode(currentNode, session.context),
            sessionId: session.id
        };
    }

    const mergedContext = {
        ...(session.context || {}),
        ...validation.values
    };
    const history = Array.isArray(session.context?.__history) ? session.context.__history.slice() : [];
    history.push({
        nodeId: currentNode.id,
        values: validation.values,
        submittedAt: new Date().toISOString()
    });
    mergedContext.__history = history;

    let nextNodeId = resolveNextFromNode(currentNode, mergedContext);
    const actionResults = [];
    let iterations = 0;
    let nextScreenNode = null;

    while (nextNodeId && iterations < MAX_NODE_ITERATIONS) {
        iterations += 1;
        const candidate = lookup.get(nextNodeId);
        if (!candidate) break;
        if (candidate.type === 'screen') {
            nextScreenNode = candidate;
            break;
        }
        if (candidate.type === 'condition' || candidate.type === 'branch' || candidate.branches) {
            nextNodeId = resolveNextFromNode(candidate, mergedContext);
            continue;
        }
        // eslint-disable-next-line no-await-in-loop
        const actionResult = await executeNode(candidate, mergedContext, flow, { userId });
        actionResults.push(actionResult);
        nextNodeId = resolveNextFromNode(candidate, mergedContext);
    }

    if (iterations >= MAX_NODE_ITERATIONS) {
        await flowService.updateFlowSession(session.id, {
            status: 'aborted',
            context: mergedContext
        });
        if (session.executionLogId) {
            await flowService.logExecutionEnd(session.executionLogId, 'failed', {
                reason: 'max_iterations'
            });
        }
        const err = new Error('Flow exceeded maximum depth');
        err.statusCode = 409;
        throw err;
    }

    if (nextScreenNode) {
        const updated = await flowService.updateFlowSession(session.id, {
            currentNodeId: nextScreenNode.id,
            context: mergedContext
        });
        return {
            status: updated.status,
            sessionId: updated.id,
            node: serializeScreenNode(nextScreenNode, mergedContext),
            actions: actionResults
        };
    }

    const completed = await flowService.updateFlowSession(session.id, {
        status: 'completed',
        context: mergedContext
    });
    if (completed.executionLogId) {
        await flowService.logExecutionEnd(completed.executionLogId, 'completed', {
            context: mergedContext,
            actions: actionResults
        });
    }

    return {
        status: 'completed',
        sessionId: completed.id,
        context: mergedContext,
        actions: actionResults
    };
};

const __private = {
    serializeScreenNode,
    validateScreenInputs,
    resolveNextFromNode
};

module.exports = {
    AVAILABLE_FLOW_EVENTS,
    emitFlowEvent,
    executeFlow,
    startScreenFlow,
    submitScreenFlowStep,
    __private
};
