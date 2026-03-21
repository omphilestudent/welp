const bcrypt = require('bcryptjs');
const { query } = require('../utils/database');

const PIN_MIN_LENGTH = Number(process.env.REMOTE_PIN_MIN_LENGTH || 4);
const PIN_MAX_LENGTH = Number(process.env.REMOTE_PIN_MAX_LENGTH || 6);
const PIN_MAX_ATTEMPTS = Number(process.env.REMOTE_PIN_MAX_ATTEMPTS || 5);
const PIN_LOCK_MINUTES = Number(process.env.REMOTE_PIN_LOCK_MINUTES || 15);

const normalizePin = (pin) => String(pin || '').trim();

const validatePin = (pin) => {
    const normalized = normalizePin(pin);
    if (!normalized) {
        const error = new Error('Remote PIN is required');
        error.statusCode = 400;
        throw error;
    }
    if (!/^\d+$/.test(normalized)) {
        const error = new Error('Remote PIN must contain only digits');
        error.statusCode = 400;
        throw error;
    }
    if (normalized.length < PIN_MIN_LENGTH || normalized.length > PIN_MAX_LENGTH) {
        const error = new Error(`Remote PIN must be ${PIN_MIN_LENGTH}-${PIN_MAX_LENGTH} digits`);
        error.statusCode = 400;
        throw error;
    }
    return normalized;
};

const fetchPinState = async (userId) => {
    const result = await query(
        `SELECT remote_pin_hash, remote_pin_set_at, remote_pin_attempt_count, remote_pin_locked_until
         FROM users
         WHERE id = $1`,
        [userId]
    );
    return result.rows[0] || null;
};

const getRemotePinStatus = async (userId) => {
    const state = await fetchPinState(userId);
    if (!state) return { enabled: false };
    return {
        enabled: Boolean(state.remote_pin_hash),
        setAt: state.remote_pin_set_at,
        attemptCount: Number(state.remote_pin_attempt_count || 0),
        lockedUntil: state.remote_pin_locked_until
    };
};

const ensureNotLocked = (state) => {
    if (!state?.remote_pin_locked_until) return;
    const lockedUntil = new Date(state.remote_pin_locked_until);
    if (Number.isNaN(lockedUntil.getTime())) return;
    if (lockedUntil.getTime() > Date.now()) {
        const error = new Error('Remote PIN is temporarily locked. Try again later.');
        error.statusCode = 429;
        error.lockedUntil = lockedUntil;
        throw error;
    }
};

const lockIfNeeded = async (userId, attemptCount) => {
    if (attemptCount < PIN_MAX_ATTEMPTS) {
        await query(
            `UPDATE users
             SET remote_pin_attempt_count = $2
             WHERE id = $1`,
            [userId, attemptCount]
        );
        return null;
    }
    const lockUntil = new Date(Date.now() + PIN_LOCK_MINUTES * 60_000);
    await query(
        `UPDATE users
         SET remote_pin_attempt_count = $2,
             remote_pin_locked_until = $3
         WHERE id = $1`,
        [userId, attemptCount, lockUntil]
    );
    return lockUntil;
};

const setRemotePin = async ({ userId, pin }) => {
    const normalized = validatePin(pin);
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(normalized, salt);
    await query(
        `UPDATE users
         SET remote_pin_hash = $2,
             remote_pin_set_at = CURRENT_TIMESTAMP,
             remote_pin_attempt_count = 0,
             remote_pin_locked_until = NULL
         WHERE id = $1`,
        [userId, hash]
    );
    return { enabled: true };
};

const verifyRemotePin = async ({ userId, pin }) => {
    const normalized = validatePin(pin);
    const state = await fetchPinState(userId);
    if (!state?.remote_pin_hash) {
        const error = new Error('Remote PIN is not set');
        error.statusCode = 400;
        throw error;
    }

    ensureNotLocked(state);

    const matches = await bcrypt.compare(normalized, state.remote_pin_hash);
    if (!matches) {
        const nextAttempts = Number(state.remote_pin_attempt_count || 0) + 1;
        const lockedUntil = await lockIfNeeded(userId, nextAttempts);
        const error = new Error('Incorrect Remote PIN');
        error.statusCode = 401;
        error.attemptsRemaining = Math.max(0, PIN_MAX_ATTEMPTS - nextAttempts);
        error.lockedUntil = lockedUntil;
        throw error;
    }

    await query(
        `UPDATE users
         SET remote_pin_attempt_count = 0,
             remote_pin_locked_until = NULL
         WHERE id = $1`,
        [userId]
    );

    return { ok: true };
};

const changeRemotePin = async ({ userId, currentPin, newPin }) => {
    await verifyRemotePin({ userId, pin: currentPin });
    return setRemotePin({ userId, pin: newPin });
};

module.exports = {
    PIN_MIN_LENGTH,
    PIN_MAX_LENGTH,
    PIN_MAX_ATTEMPTS,
    PIN_LOCK_MINUTES,
    getRemotePinStatus,
    setRemotePin,
    verifyRemotePin,
    changeRemotePin
};
