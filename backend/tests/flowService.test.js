const assert = require('assert');
const database = require('../src/utils/database');
const flowService = require('../src/services/flowService');
const { emitFlowEvent, AVAILABLE_FLOW_EVENTS } = require('../src/services/flowEngine');

const mockRes = () => ({
    statusCode: 200,
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(payload) {
        this.body = payload;
        return this;
    }
});

(async () => {
    const originalQuery = database.query;
    const originalServiceFns = {
        getActiveTriggersByEvent: flowService.getActiveTriggersByEvent,
        getFlowById: flowService.getFlowById,
        logExecutionStart: flowService.logExecutionStart,
        logExecutionEnd: flowService.logExecutionEnd
    };

    try {
        // --- createFlow persists JSON definition ---
        let capturedParams = null;
        database.query = async (sql, params) => {
            if (sql.includes('INSERT INTO flows')) {
                capturedParams = params;
                return {
                    rows: [{
                        id: 'flow-1',
                        name: params[0],
                        type: params[2],
                        description: params[1],
                        definition: params[3],
                        is_active: params[4]
                    }]
                };
            }
            if (sql.includes('SELECT COALESCE(MAX')) {
                return { rows: [{ max: 0 }] };
            }
            if (sql.includes('INSERT INTO flow_versions')) {
                return { rows: [] };
            }
            if (sql.includes('INSERT INTO flow_permissions')) {
                return { rowCount: 1 };
            }
            return { rows: [] };
        };
        const created = await flowService.createFlow({
            name: 'Welcome Flow',
            description: 'Greets new users',
            type: 'trigger',
            definition: { actions: [{ type: 'log', message: 'Hello {{email}}' }] },
            isActive: true,
            userId: 'admin-1'
        });
        assert.strictEqual(created.name, 'Welcome Flow');
        assert.ok(capturedParams[3].includes('{{email}}'), 'definition should be stored as JSON');

        // --- listFlows applies filters ---
        database.query = async () => ({
            rows: [{
                id: 'flow-1',
                name: 'Welcome Flow',
                type: 'trigger',
                definition: '{"actions":[]}',
                is_active: true
            }]
        });
        const flows = await flowService.listFlows({ type: 'trigger', search: 'welcome' });
        assert.strictEqual(flows.length, 1);
        assert.strictEqual(flows[0].definition.actions.length, 0);

        // --- trigger creation and hydration ---
        let triggerParams = null;
        database.query = async (_sql, params) => {
            triggerParams = params;
            return {
                rows: [{
                    id: 'trigger-1',
                    flow_id: 'flow-1',
                    event_name: params[1],
                    conditions: params[2],
                    is_active: params[3]
                }]
            };
        };
        const trigger = await flowService.createFlowTrigger({
            flowId: 'flow-1',
            eventName: 'user.signup',
            conditions: { match: { role: 'employee' } },
            isActive: true
        });
        assert.deepStrictEqual(triggerParams[2], JSON.stringify({ match: { role: 'employee' } }));
        assert.strictEqual(trigger.eventName, 'user.signup');
        assert.strictEqual(trigger.conditions.match.role, 'employee');

        // --- execution logs listing ---
        database.query = async () => ({
            rows: [{
                id: 'log-1',
                flow_id: 'flow-1',
                status: 'completed',
                flow_type: 'trigger',
                user_id: 'user-1',
                metadata: '{"result":"ok"}',
                started_at: new Date(),
                ended_at: new Date()
            }]
        });
        const logs = await flowService.listExecutionLogs('flow-1', 5);
        assert.strictEqual(logs[0].metadata.result, 'ok');

        // --- Simulate emitFlowEvent dispatch path ---
        flowService.getActiveTriggersByEvent = async () => ([
            {
                id: 'trigger-1',
                flowId: 'flow-1',
                flow: {
                    id: 'flow-1',
                    name: 'Welcome Flow',
                    type: 'trigger',
                    definition: { actions: [{ type: 'log', message: 'Hi {{email}}' }] },
                    isActive: true
                },
                conditions: { match: { role: 'employee' } },
                isActive: true
            }
        ]);
        flowService.getFlowById = async () => ({
            id: 'flow-1',
            name: 'Welcome Flow',
            type: 'trigger',
            definition: { actions: [{ type: 'log', message: 'Hi {{email}}' }] },
            isActive: true
        });
        let loggedStatus = null;
        flowService.logExecutionStart = async () => ({ id: 'log-1' });
        flowService.logExecutionEnd = async (_id, status) => {
            loggedStatus = status;
            return { id: _id, status };
        };

        const eventResult = await emitFlowEvent('user.signup', {
            userId: 'user-1',
            email: 'employee@example.com',
            role: 'employee'
        });
        assert.strictEqual(eventResult.dispatched, 1);
        assert.strictEqual(loggedStatus, 'completed');

        // --- Flow events list exposed ---
        assert.ok(Array.isArray(AVAILABLE_FLOW_EVENTS), 'Events constant should be exposed');
        assert.ok(AVAILABLE_FLOW_EVENTS.find((evt) => evt.name === 'user.signup'));

        console.log('✅ Flow service + engine smoke tests passed');
    } catch (error) {
        console.error('❌ Flow service tests failed:', error);
        process.exit(1);
    } finally {
        database.query = originalQuery;
        Object.assign(flowService, originalServiceFns);
    }
})();
