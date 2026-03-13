const { query } = require('./database');

const TABLE_CHECK_TTL_MS = 5 * 60 * 1000;
let auditTableReady = false;
let lastCheckedAt = 0;

const ensureAuditTable = async () => {
    if (auditTableReady && lastCheckedAt + TABLE_CHECK_TTL_MS > Date.now()) {
        return true;
    }
    try {
        const result = await query(
            `SELECT EXISTS (
                 SELECT 1
                 FROM information_schema.tables
                 WHERE table_schema = 'public'
                   AND table_name = 'audit_logs'
             ) AS present`
        );
        auditTableReady = Boolean(result.rows[0]?.present);
        lastCheckedAt = Date.now();
        return auditTableReady;
    } catch (error) {
        console.error('Audit table check failed:', error.message);
        return false;
    }
};

const toJson = (value) => {
    if (value === undefined) return null;
    try {
        return value === null ? null : JSON.stringify(value);
    } catch {
        return null;
    }
};

const recordAuditLog = async ({
    userId = null,
    adminId = null,
    actorRole = null,
    action,
    entityType = null,
    entityId = null,
    oldValues = null,
    newValues = null,
    metadata = null,
    ipAddress = null,
    userAgent = null
}) => {
    if (!action) return;
    if (!await ensureAuditTable()) {
        return;
    }

    try {
        await query(
            `INSERT INTO audit_logs (
                 user_id,
                 admin_id,
                 actor_role,
                 action,
                 entity_type,
                 entity_id,
                 old_values,
                 new_values,
                 metadata,
                 ip_address,
                 user_agent
             ) VALUES (
                 $1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11
             )`,
            [
                userId,
                adminId,
                actorRole,
                action,
                entityType,
                entityId,
                toJson(oldValues),
                toJson(newValues),
                toJson(metadata),
                ipAddress,
                userAgent
            ]
        );
    } catch (error) {
        console.error('Failed to record audit log:', error.message);
    }
};

module.exports = {
    recordAuditLog
};
