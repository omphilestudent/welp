const { query } = require('../utils/database');

const PREFIXES = {
    business: '100',
    psychologist: '200',
    employee: '300'
};

const isValidAccountNumber = (value) => {
    return typeof value === 'string' && /^\d{10}$/.test(value);
};

const normalizePrefix = (role) => {
    const key = String(role || '').toLowerCase();
    return PREFIXES[key] || null;
};

const reserveNextAccountNumber = async (prefix) => {
    const result = await query(
        `UPDATE account_number_sequences
         SET last_value = last_value + 1
         WHERE prefix = $1
         RETURNING last_value`,
        [prefix]
    );
    if (!result.rows.length) {
        throw new Error('Account number sequence missing');
    }
    const numeric = result.rows[0].last_value;
    return `${prefix}${String(numeric).padStart(7, '0')}`;
};

const assignAccountNumber = async ({ ownerType, ownerId, prefix }) => {
    if (!ownerId || !prefix) return null;
    const existing = await query(
        `SELECT account_number
         FROM account_number_registry
         WHERE owner_type = $1 AND owner_id = $2`,
        [ownerType, ownerId]
    );
    if (existing.rows.length) {
        return existing.rows[0].account_number;
    }

    let accountNumber = null;
    let attempts = 0;
    while (!accountNumber && attempts < 5) {
        attempts += 1;
        const candidate = await reserveNextAccountNumber(prefix);
        try {
            await query(
                `INSERT INTO account_number_registry (account_number, owner_type, owner_id)
                 VALUES ($1, $2, $3)`,
                [candidate, ownerType, ownerId]
            );
            accountNumber = candidate;
        } catch (error) {
            if (String(error?.code) !== '23505') {
                throw error;
            }
        }
    }

    return accountNumber;
};

const assignAccountNumberToUser = async (userId, role) => {
    const prefix = normalizePrefix(role);
    if (!prefix) return null;
    const accountNumber = await assignAccountNumber({ ownerType: 'user', ownerId: userId, prefix });
    if (!accountNumber) return null;
    await query(
        `UPDATE users
         SET account_number = $1
         WHERE id = $2`,
        [accountNumber, userId]
    );
    return accountNumber;
};

const assignAccountNumberToCompany = async (companyId) => {
    const accountNumber = await assignAccountNumber({ ownerType: 'company', ownerId: companyId, prefix: PREFIXES.business });
    if (!accountNumber) return null;
    await query(
        `UPDATE companies
         SET account_number = $1
         WHERE id = $2`,
        [accountNumber, companyId]
    );
    return accountNumber;
};

const resolveAccountNumber = async (accountNumber) => {
    if (!isValidAccountNumber(accountNumber)) return null;
    const result = await query(
        `SELECT account_number, owner_type, owner_id
         FROM account_number_registry
         WHERE account_number = $1`,
        [accountNumber]
    );
    return result.rows[0] || null;
};

module.exports = {
    PREFIXES,
    isValidAccountNumber,
    normalizePrefix,
    assignAccountNumberToUser,
    assignAccountNumberToCompany,
    resolveAccountNumber
};
