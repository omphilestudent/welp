const { query } = require('../utils/database');

const parseJson = (value, fallback = {}) => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const toJsonString = (value, fallback = {}) => {
    if (!value) return JSON.stringify(fallback);
    if (typeof value === 'string') {
        try {
            JSON.parse(value);
            return value;
        } catch {
            return JSON.stringify(fallback);
        }
    }
    return JSON.stringify(value);
};

const hydrateFlow = (row = {}) => {
    if (!row || !row.id) return null;
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        type: row.type,
        definition: parseJson(row.definition, {}),
        isActive: row.is_active !== false,
        is_active: row.is_active !== false,
        createdBy: row.created_by,
        updatedBy: row.updated_by,
        created_at: row.created_at,
        updated_at: row.updated_at
    };
};

const hydrateTrigger = (row = {}) => {
    if (!row || !row.id) return null;
    return {
        id: row.id,
        flowId: row.flow_id,
        eventName: row.event_name,
        conditions: parseJson(row.conditions, {}),
        isActive: row.is_active !== false,
        flow: row.flow_id
            ? {
                id: row.flow_id,
                name: row.flow_name || row.name,
                type: row.flow_type || row.type,
                definition: parseJson(row.flow_definition || row.definition, {}),
                isActive: row.flow_is_active !== false
            }
            : null,
        created_at: row.created_at,
        updated_at: row.updated_at
    };
};

const hydrateSession = (row = {}) => {
    if (!row || !row.id) return null;
    return {
        id: row.id,
        flowId: row.flow_id,
        userId: row.user_id,
        status: row.status,
        currentNodeId: row.current_node_id,
        context: parseJson(row.context, {}),
        previewMode: row.preview_mode === true,
        executionLogId: row.execution_log_id,
        lastSubmittedAt: row.last_submitted_at,
        created_at: row.created_at,
        updated_at: row.updated_at
    };
};

const listFlows = async ({ type, search, isActive } = {}) => {
    const conditions = [];
    const params = [];

    if (type) {
        params.push(type);
        conditions.push(`type = $${params.length}`);
    }
    if (typeof isActive === 'boolean') {
        params.push(isActive);
        conditions.push(`is_active = $${params.length}`);
    }
    if (search) {
        params.push(`%${search}%`);
        conditions.push(`(LOWER(name) LIKE LOWER($${params.length}) OR LOWER(description) LIKE LOWER($${params.length}))`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
        `SELECT *
         FROM flows
         ${whereClause}
         ORDER BY updated_at DESC`,
        params
    );
    return result.rows.map(hydrateFlow);
};

const getFlowById = async (id) => {
    const result = await query(`SELECT * FROM flows WHERE id = $1 LIMIT 1`, [id]);
    return hydrateFlow(result.rows[0]);
};

const createFlow = async ({ name, description, type, definition, isActive = true, userId }) => {
    const result = await query(
        `INSERT INTO flows (name, description, type, definition, is_active, created_by, updated_by)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $6)
         RETURNING *`,
        [
            name,
            description || null,
            type,
            toJsonString(definition),
            isActive,
            userId || null
        ]
    );
    return hydrateFlow(result.rows[0]);
};

const updateFlow = async (id, updates = {}) => {
    const sets = [];
    const params = [];

    if (updates.name !== undefined) {
        params.push(updates.name);
        sets.push(`name = $${params.length}`);
    }
    if (updates.description !== undefined) {
        params.push(updates.description);
        sets.push(`description = $${params.length}`);
    }
    if (updates.type !== undefined) {
        params.push(updates.type);
        sets.push(`type = $${params.length}`);
    }
    if (updates.definition !== undefined) {
        params.push(toJsonString(updates.definition));
        sets.push(`definition = $${params.length}::jsonb`);
    }
    if (updates.isActive !== undefined) {
        params.push(Boolean(updates.isActive));
        sets.push(`is_active = $${params.length}`);
    }
    if (updates.updatedBy !== undefined) {
        params.push(updates.updatedBy);
        sets.push(`updated_by = $${params.length}`);
    }

    if (!sets.length) {
        return getFlowById(id);
    }

    params.push(id);
    const sql = `
        UPDATE flows
        SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${params.length}
        RETURNING *`;

    const result = await query(sql, params);
    return hydrateFlow(result.rows[0]);
};

const deleteFlow = async (id) => {
    await query(`DELETE FROM flow_triggers WHERE flow_id = $1`, [id]);
    const result = await query(`DELETE FROM flows WHERE id = $1 RETURNING *`, [id]);
    return hydrateFlow(result.rows[0]);
};

const logExecutionStart = async ({ flowId, userId = null, flowType = null, metadata = {} }) => {
    const result = await query(
        `INSERT INTO flow_execution_logs (flow_id, user_id, flow_type, status, metadata)
         VALUES ($1, $2, $3, 'in_progress', $4::jsonb)
         RETURNING *`,
        [flowId, userId, flowType, toJsonString(metadata)]
    );
    return result.rows[0];
};

const logExecutionEnd = async (logId, status = 'completed', metadata = {}) => {
    const result = await query(
        `UPDATE flow_execution_logs
         SET status = $2,
             ended_at = CURRENT_TIMESTAMP,
             metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
         WHERE id = $1
         RETURNING *`,
        [logId, status, toJsonString(metadata)]
    );
    return result.rows[0];
};

const listExecutionLogs = async (flowId, limit = 25) => {
    const result = await query(
        `SELECT *
         FROM flow_execution_logs
         WHERE flow_id = $1
         ORDER BY started_at DESC
         LIMIT $2`,
        [flowId, limit]
    );
    return result.rows.map((row) => ({
        id: row.id,
        flowId: row.flow_id,
        status: row.status,
        flowType: row.flow_type,
        userId: row.user_id,
        started_at: row.started_at,
        ended_at: row.ended_at,
        metadata: parseJson(row.metadata, {})
    }));
};

const listFlowTriggers = async () => {
    const result = await query(
        `SELECT
            ft.*,
            f.name AS flow_name,
            f.type AS flow_type,
            f.definition AS flow_definition,
            f.is_active AS flow_is_active
         FROM flow_triggers ft
         JOIN flows f ON f.id = ft.flow_id
         ORDER BY ft.updated_at DESC`
    );
    return result.rows.map(hydrateTrigger);
};

const createFlowTrigger = async ({ flowId, eventName, conditions, isActive = true }) => {
    const result = await query(
        `INSERT INTO flow_triggers (flow_id, event_name, conditions, is_active)
         VALUES ($1, $2, $3::jsonb, $4)
         RETURNING *`,
        [flowId, eventName, toJsonString(conditions), isActive]
    );
    return hydrateTrigger(result.rows[0]);
};

const updateFlowTrigger = async (triggerId, updates = {}) => {
    const sets = [];
    const params = [];

    if (updates.flowId) {
        params.push(updates.flowId);
        sets.push(`flow_id = $${params.length}`);
    }
    if (updates.eventName) {
        params.push(updates.eventName);
        sets.push(`event_name = $${params.length}`);
    }
    if (updates.conditions !== undefined) {
        params.push(toJsonString(updates.conditions));
        sets.push(`conditions = $${params.length}::jsonb`);
    }
    if (typeof updates.isActive === 'boolean') {
        params.push(updates.isActive);
        sets.push(`is_active = $${params.length}`);
    }

    if (!sets.length) {
        const result = await query(`SELECT * FROM flow_triggers WHERE id = $1`, [triggerId]);
        return hydrateTrigger(result.rows[0]);
    }

    params.push(triggerId);
    const result = await query(
        `UPDATE flow_triggers
         SET ${sets.join(', ')},
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $${params.length}
         RETURNING *`,
        params
    );
    return hydrateTrigger(result.rows[0]);
};

const deleteFlowTrigger = async (triggerId) => {
    const result = await query(
        `DELETE FROM flow_triggers
         WHERE id = $1
         RETURNING *`,
        [triggerId]
    );
    return hydrateTrigger(result.rows[0]);
};

const getActiveTriggersByEvent = async (eventName) => {
    const result = await query(
        `SELECT
            ft.*,
            f.name AS flow_name,
            f.type AS flow_type,
            f.definition AS flow_definition,
            f.is_active AS flow_is_active
         FROM flow_triggers ft
         JOIN flows f ON f.id = ft.flow_id
         WHERE ft.event_name = $1
           AND ft.is_active = true
           AND f.is_active = true`,
        [eventName]
    );
    return result.rows.map(hydrateTrigger).filter(Boolean);
};

const createFlowSession = async ({
    flowId,
    userId = null,
    currentNodeId,
    context = {},
    previewMode = false,
    executionLogId = null
}) => {
    const result = await query(
        `INSERT INTO flow_sessions (
            flow_id,
            user_id,
            status,
            current_node_id,
            context,
            preview_mode,
            execution_log_id,
            last_submitted_at
        )
        VALUES ($1, $2, 'in_progress', $3, $4::jsonb, $5, $6, CURRENT_TIMESTAMP)
        RETURNING *`,
        [flowId, userId, currentNodeId || null, toJsonString(context), previewMode, executionLogId]
    );
    return hydrateSession(result.rows[0]);
};

const getFlowSessionById = async (sessionId) => {
    const result = await query(
        `SELECT * FROM flow_sessions
         WHERE id = $1
         LIMIT 1`,
        [sessionId]
    );
    return hydrateSession(result.rows[0]);
};

const updateFlowSession = async (sessionId, updates = {}) => {
    const sets = [];
    const params = [];

    if (updates.status) {
        params.push(updates.status);
        sets.push(`status = $${params.length}`);
    }
    if (updates.currentNodeId !== undefined) {
        params.push(updates.currentNodeId);
        sets.push(`current_node_id = $${params.length}`);
    }
    if (updates.context !== undefined) {
        params.push(toJsonString(updates.context));
        sets.push(`context = $${params.length}::jsonb`);
    }
    if (updates.executionLogId !== undefined) {
        params.push(updates.executionLogId);
        sets.push(`execution_log_id = $${params.length}`);
    }
    if (updates.lastSubmittedAt !== undefined) {
        params.push(updates.lastSubmittedAt);
        sets.push(`last_submitted_at = $${params.length}`);
    } else {
        sets.push(`last_submitted_at = CURRENT_TIMESTAMP`);
    }

    if (!sets.length) {
        return getFlowSessionById(sessionId);
    }

    params.push(sessionId);
    const result = await query(
        `UPDATE flow_sessions
         SET ${sets.join(', ')},
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $${params.length}
         RETURNING *`,
        params
    );
    return hydrateSession(result.rows[0]);
};

module.exports = {
    listFlows,
    getFlowById,
    createFlow,
    updateFlow,
    deleteFlow,
    logExecutionStart,
    logExecutionEnd,
    listExecutionLogs,
    listFlowTriggers,
    createFlowTrigger,
    updateFlowTrigger,
    deleteFlowTrigger,
    getActiveTriggersByEvent,
    createFlowSession,
    getFlowSessionById,
    updateFlowSession
};
