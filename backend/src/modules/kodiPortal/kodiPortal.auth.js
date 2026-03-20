const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const repository = require('./kodiPortal.repository');

const OTP_TTL_MINUTES = 30;
const FIRST_LOGIN_TTL_MINUTES = 15;

const logAudit = async ({ userId, action, notes }) => {
    try {
        await repository.query(
            `INSERT INTO kodi_audit_logs (entity_type, entity_id, action, performed_by_user_id, notes)
             VALUES ($1,$2,$3,$4,$5)`,
            ['kodi_portal_identity', userId || null, action, userId || null, notes || null]
        );
    } catch (error) {
        console.warn('Kodi auth audit failed:', error.message);
    }
};

const buildJwt = (userId, tokenVersion = 0, firstLogin = false) => {
    return jwt.sign(
        { userId, tokenVersion, portal: true, firstLogin },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

const recordLoginActivity = async (userId) => {
    if (!userId) return;
    try {
        await repository.query(
            `UPDATE users
             SET last_login = CURRENT_TIMESTAMP,
                 last_active = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [userId]
        );
    } catch (error) {
        console.warn('Kodi auth login activity update failed:', error.message);
    }
};

const signInWithUsername = async ({ username, password, otp }) => {
    const identity = await repository.getIdentityByUsername(username);
    if (!identity) throw new Error('Invalid credentials');
    const userRow = await repository.query(
        `SELECT id, token_version
         FROM users
         WHERE id = $1`,
        [identity.user_id]
    );
    const user = userRow.rows[0];
    if (!user) throw new Error('Invalid credentials');

    if (identity.first_login_required) {
        if (!otp || !identity.otp_hash) throw new Error('One-time password required');
        if (identity.otp_expires_at && new Date(identity.otp_expires_at) < new Date()) {
            throw new Error('One-time password expired');
        }
        const ok = await bcrypt.compare(String(otp), identity.otp_hash);
        if (!ok) throw new Error('Invalid one-time password');
        const token = crypto.randomBytes(20).toString('hex');
        const expires = new Date(Date.now() + FIRST_LOGIN_TTL_MINUTES * 60_000);
        await repository.updateIdentity({
            userId: identity.user_id,
            updates: { first_login_token: token, first_login_expires_at: expires }
        });
        await logAudit({
            userId: identity.user_id,
            action: 'kodi_auth_first_login_requested',
            notes: JSON.stringify({ username })
        });
        await recordLoginActivity(identity.user_id);
        return {
            firstLoginRequired: true,
            token: buildJwt(user.id, user.token_version, true),
            firstLoginToken: token
        };
    }

    if (!identity.password_hash || !password) {
        throw new Error('Password required');
    }
    const ok = await bcrypt.compare(String(password), identity.password_hash);
    if (!ok) throw new Error('Invalid credentials');
    await recordLoginActivity(identity.user_id);
    await logAudit({
        userId: identity.user_id,
        action: 'kodi_auth_login',
        notes: JSON.stringify({ username })
    });
    return { token: buildJwt(user.id, user.token_version), firstLoginRequired: false };
};

const completeFirstLogin = async ({ userId, firstLoginToken, password }) => {
    const identity = await repository.getIdentityByUserId(userId);
    if (!identity || !identity.first_login_required) {
        throw new Error('First login not required');
    }
    if (!identity.first_login_token || identity.first_login_token !== firstLoginToken) {
        throw new Error('Invalid first login token');
    }
    if (identity.first_login_expires_at && new Date(identity.first_login_expires_at) < new Date()) {
        throw new Error('First login token expired');
    }
    const hash = await bcrypt.hash(String(password), 10);
    await repository.updateIdentity({
        userId,
        updates: {
            password_hash: hash,
            otp_hash: null,
            otp_expires_at: null,
            first_login_required: false,
            first_login_token: null,
            first_login_expires_at: null
        }
    });
    await logAudit({
        userId,
        action: 'kodi_auth_first_login_complete',
        notes: null
    });
    const userRow = await repository.query(
        `SELECT id, token_version
         FROM users
         WHERE id = $1`,
        [userId]
    );
    const user = userRow.rows[0];
    return { token: buildJwt(user.id, user.token_version), firstLoginRequired: false };
};

module.exports = {
    signInWithUsername,
    completeFirstLogin
};
