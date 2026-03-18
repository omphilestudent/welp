const database = require('../utils/database');
const query = (...args) => database.query(...args);

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

const hydrateVersion = (row = {}) => {
    if (!row) return null;
    return {
        id: row.id,
        flowId: row.flow_id,
        version: row.version_number,
        definition: parseJson(row.definition, {}),
        created_by: row.created_by,
        created_at: row.created_at
    };
};

const hydrateComponent = (row = {}) => {
    if (!row || !row.id) return null;
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        type: row.component_type,
        config: parseJson(row.config, {}),
        isShared: row.is_shared !== false,
        created_by: row.created_by,
        updated_by: row.updated_by,
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
    const flow = hydrateFlow(result.rows[0]);
    await createFlowVersionEntry({
        flowId: flow.id,
        definition: flow.definition,
        userId
    });
    await ensureDefaultFlowPermissions(flow.id);
    return flow;
};

const updateFlow = async (id, updates = {}) => {
    const sets = [];
    const params = [];
    let definitionPayload = null;

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
        definitionPayload = updates.definition;
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
    const flow = hydrateFlow(result.rows[0]);
    if (definitionPayload !== null) {
        await createFlowVersionEntry({
            flowId: flow.id,
            definition: definitionPayload,
            userId: updates.updatedBy || null
        });
    }
    return flow;
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
    const row = result.rows[0];
    if (row) {
        await updateFlowMetrics(row);
    }
    return row;
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

const getLatestVersionNumber = async (flowId) => {
    const result = await query(
        `SELECT COALESCE(MAX(version_number), 0) AS max
         FROM flow_versions
         WHERE flow_id = $1`,
        [flowId]
    );
    return Number(result.rows[0]?.max || 0);
};

const createFlowVersionEntry = async ({ flowId, definition, userId }) => {
    const nextVersion = (await getLatestVersionNumber(flowId)) + 1;
    await query(
        `INSERT INTO flow_versions (flow_id, version_number, definition, created_by)
         VALUES ($1, $2, $3::jsonb, $4)`,
        [flowId, nextVersion, toJsonString(definition), userId || null]
    );
    return nextVersion;
};

const listFlowVersions = async (flowId, limit = 20) => {
    const result = await query(
        `SELECT *
         FROM flow_versions
         WHERE flow_id = $1
         ORDER BY version_number DESC
         LIMIT $2`,
        [flowId, limit]
    );
    return result.rows.map(hydrateVersion);
};

const rollbackFlowVersion = async ({ flowId, versionId, userId }) => {
    const versionResult = await query(
        `SELECT *
         FROM flow_versions
         WHERE id = $1 AND flow_id = $2
         LIMIT 1`,
        [versionId, flowId]
    );
    const version = hydrateVersion(versionResult.rows[0]);
    if (!version) return null;
    const flow = await updateFlow(flowId, {
        definition: version.definition,
        updatedBy: userId
    });
    return { flow, version };
};

const listFlowComponents = async ({ type } = {}) => {
    const params = [];
    const clauses = [];
    if (type) {
        params.push(type);
        clauses.push(`component_type = $${params.length}`);
    }
    const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await query(
        `SELECT *
         FROM flow_components
         ${whereClause}
         ORDER BY updated_at DESC`,
        params
    );
    return result.rows.map(hydrateComponent);
};

const createFlowComponent = async ({ name, description, componentType, config, isShared = true, userId }) => {
    const result = await query(
        `INSERT INTO flow_components (name, description, component_type, config, is_shared, created_by, updated_by)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $6)
         RETURNING *`,
        [name, description || null, componentType, toJsonString(config), isShared, userId || null]
    );
    return hydrateComponent(result.rows[0]);
};

const updateFlowComponent = async (componentId, updates = {}) => {
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
    if (updates.componentType !== undefined) {
        params.push(updates.componentType);
        sets.push(`component_type = $${params.length}`);
    }
    if (updates.config !== undefined) {
        params.push(toJsonString(updates.config));
        sets.push(`config = $${params.length}::jsonb`);
    }
    if (updates.isShared !== undefined) {
        params.push(Boolean(updates.isShared));
        sets.push(`is_shared = $${params.length}`);
    }
    if (!sets.length) {
        const result = await query(`SELECT * FROM flow_components WHERE id = $1`, [componentId]);
        return hydrateComponent(result.rows[0]);
    }
    params.push(updates.updatedBy || null);
    sets.push(`updated_by = $${params.length}`);
    params.push(componentId);
    const result = await query(
        `UPDATE flow_components
         SET ${sets.join(', ')},
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $${params.length}
         RETURNING *`,
        params
    );
    return hydrateComponent(result.rows[0]);
};

const deleteFlowComponent = async (componentId) => {
    const result = await query(
        `DELETE FROM flow_components
         WHERE id = $1
         RETURNING *`,
        [componentId]
    );
    return hydrateComponent(result.rows[0]);
};

const ensureDefaultFlowPermissions = async (flowId) => {
    await query(
        `INSERT INTO flow_permissions (flow_id, role, can_view, can_edit, can_execute)
         VALUES
            ($1, 'super_admin', true, true, true),
            ($1, 'admin', true, true, false)
         ON CONFLICT (flow_id, role) DO NOTHING`,
        [flowId]
    );
};

const getFlowPermissions = async (flowId) => {
    const result = await query(
        `SELECT *
         FROM flow_permissions
         WHERE flow_id = $1`,
        [flowId]
    );
    return result.rows;
};

const upsertFlowPermission = async (flowId, role, permissions = {}) => {
    const payload = {
        can_view: permissions.can_view !== undefined ? permissions.can_view : true,
        can_edit: !!permissions.can_edit,
        can_execute: !!permissions.can_execute
    };
    const result = await query(
        `INSERT INTO flow_permissions (flow_id, role, can_view, can_edit, can_execute)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (flow_id, role)
         DO UPDATE SET can_view = EXCLUDED.can_view,
                       can_edit = EXCLUDED.can_edit,
                       can_execute = EXCLUDED.can_execute`,
        [flowId, role, payload.can_view, payload.can_edit, payload.can_execute]
    );
    return result.rowCount > 0;
};

const hasPermission = async (flowId, role, capability) => {
    const normalizedRole = (role || 'anonymous').toLowerCase();
    const result = await query(
        `SELECT can_view, can_edit, can_execute
         FROM flow_permissions
         WHERE flow_id = $1 AND role = $2`,
        [flowId, normalizedRole]
    );
    if (result.rows.length === 0) {
        // default: admins have full access, others can execute only if capability is execute and flow is active
        if (['admin', 'super_admin'].includes(normalizedRole)) return true;
        return capability === 'execute';
    }
    const row = result.rows[0];
    if (capability === 'view') return row.can_view;
    if (capability === 'edit') return row.can_edit;
    if (capability === 'execute') return row.can_execute;
    return false;
};

const ensurePermissionOrThrow = async (flowId, role, capability) => {
    const allowed = await hasPermission(flowId, role, capability);
    if (!allowed) {
        const err = new Error('Insufficient flow permissions');
        err.statusCode = 403;
        throw err;
    }
};

const updateFlowMetrics = async (logRow) => {
    if (!logRow?.flow_id) return;
    const windowDate = (logRow.started_at || new Date()).toISOString().slice(0, 10);
    const durationMs = logRow.ended_at && logRow.started_at
        ? (new Date(logRow.ended_at) - new Date(logRow.started_at))
        : 0;
    const durationSeconds = durationMs > 0 ? durationMs / 1000 : 0;
    const isSuccess = logRow.status === 'completed';
    const isFailure = logRow.status && logRow.status !== 'completed';
    await query(
        `INSERT INTO flow_metrics (flow_id, window_date, executions, success_count, failure_count, avg_duration_seconds)
         VALUES ($1, $2, 1, $3, $4, $5)
         ON CONFLICT (flow_id, window_date)
         DO UPDATE SET
            executions = flow_metrics.executions + 1,
            success_count = flow_metrics.success_count + EXCLUDED.success_count,
            failure_count = flow_metrics.failure_count + EXCLUDED.failure_count,
            avg_duration_seconds = CASE
                WHEN flow_metrics.executions + 1 = 0 THEN 0
                ELSE ((flow_metrics.avg_duration_seconds * flow_metrics.executions) + $5) / (flow_metrics.executions + 1)
            END`,
        [
            logRow.flow_id,
            windowDate,
            isSuccess ? 1 : 0,
            isFailure ? 1 : 0,
            durationSeconds
        ]
    );
};

const getFlowAnalytics = async (flowId, days = 30) => {
    const result = await query(
        `SELECT *
         FROM flow_metrics
         WHERE flow_id = $1
           AND window_date >= CURRENT_DATE - ($2::int * INTERVAL '1 day')
         ORDER BY window_date DESC`,
        [flowId, days]
    );
    return result.rows;
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
    updateFlowSession,
    listFlowVersions,
    rollbackFlowVersion,
    listFlowComponents,
    createFlowComponent,
    updateFlowComponent,
    deleteFlowComponent,
    ensureDefaultFlowPermissions,
    getFlowPermissions,
    upsertFlowPermission,
    ensurePermissionOrThrow,
    getFlowAnalytics
};
