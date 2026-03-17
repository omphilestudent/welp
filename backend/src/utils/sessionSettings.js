const { query } = require('./database');

const SESSION_SETTING_KEYS = {
    inactivityTimeoutMinutes: 'inactivity_timeout_minutes',
    autoLogoutEnabled: 'auto_logout_enabled'
};

const DEFAULT_SESSION_SETTINGS = {
    inactivityTimeoutMinutes: 30,
    autoLogoutEnabled: false
};

const tableExists = async (tableName) => {
    try {
        const result = await query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = $1
            )`,
            [tableName]
        );
        return result.rows[0].exists;
    } catch {
        return false;
    }
};

const parseStoredValue = (value) => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
};

const normalizeSessionSettings = (rows = []) => {
    const settings = { ...DEFAULT_SESSION_SETTINGS };
    rows.forEach((row) => {
        const key = row.key;
        const parsed = parseStoredValue(row.value);
        if (key === SESSION_SETTING_KEYS.inactivityTimeoutMinutes) {
            const numeric = Number(parsed);
            settings.inactivityTimeoutMinutes = Number.isFinite(numeric) && numeric > 0
                ? numeric
                : DEFAULT_SESSION_SETTINGS.inactivityTimeoutMinutes;
        }
        if (key === SESSION_SETTING_KEYS.autoLogoutEnabled) {
            settings.autoLogoutEnabled = Boolean(parsed);
        }
    });
    return settings;
};

const fetchSessionSettings = async () => {
    if (!await tableExists('system_settings')) {
        return { ...DEFAULT_SESSION_SETTINGS };
    }
    const keys = Object.values(SESSION_SETTING_KEYS);
    const result = await query(
        `SELECT key, value FROM system_settings WHERE key = ANY($1)`,
        [keys]
    );
    return normalizeSessionSettings(result.rows || []);
};

const persistSessionSettings = async (updates = {}, updatedBy = null) => {
    if (!await tableExists('system_settings')) {
        throw new Error('Table not found');
    }
    const entries = [];
    if (updates.inactivityTimeoutMinutes !== undefined) {
        entries.push({
            key: SESSION_SETTING_KEYS.inactivityTimeoutMinutes,
            value: Number(updates.inactivityTimeoutMinutes)
        });
    }
    if (updates.autoLogoutEnabled !== undefined) {
        entries.push({
            key: SESSION_SETTING_KEYS.autoLogoutEnabled,
            value: Boolean(updates.autoLogoutEnabled)
        });
    }
    if (!entries.length) {
        return fetchSessionSettings();
    }

    for (const entry of entries) {
        await query(
            `INSERT INTO system_settings (key, value, updated_by)
             VALUES ($1, $2, $3)
             ON CONFLICT (key)
             DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP`,
            [entry.key, JSON.stringify(entry.value), updatedBy]
        );
    }

    return fetchSessionSettings();
};

module.exports = {
    DEFAULT_SESSION_SETTINGS,
    SESSION_SETTING_KEYS,
    fetchSessionSettings,
    persistSessionSettings
};
