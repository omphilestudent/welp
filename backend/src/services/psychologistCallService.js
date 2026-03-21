const { query } = require('../utils/database');
const { getPsychologistPlan } = require('./psychologistBillingService');

const DEFAULT_CURRENCY = (process.env.DEFAULT_CURRENCY || 'USD').toUpperCase();
const FREE_CALL_FEE_MAJOR = Number(process.env.PSYCH_FREE_CALL_FEE || 30);
const PREMIUM_MINUTES_PER_CLIENT = Number(process.env.PSYCH_PREMIUM_MINUTES_PER_CLIENT || 120);

const toMinor = (amountMajor) => Math.round(Number(amountMajor || 0) * 100);

const getPsychologistClientEntitlement = async (psychologistId, employeeId) => {
    const plan = await getPsychologistPlan(psychologistId);
    const tier = plan?.tier || 'free';
    const allowance = tier === 'premium' ? PREMIUM_MINUTES_PER_CLIENT : 0;

    const existing = await query(
        `SELECT * FROM psychologist_client_call_accounts
         WHERE psychologist_id = $1 AND employee_id = $2`,
        [psychologistId, employeeId]
    );
    if (existing.rows.length) {
        const record = existing.rows[0];
        return {
            ...record,
            plan_tier: tier,
            minute_allowance: tier === 'premium' ? allowance : record.minute_allowance
        };
    }

    const minutesRemaining = tier === 'premium' ? allowance : 0;
    const inserted = await query(
        `INSERT INTO psychologist_client_call_accounts
         (psychologist_id, employee_id, plan_tier, minute_allowance, minutes_used, minutes_remaining)
         VALUES ($1, $2, $3, $4, 0, $4)
         RETURNING *`,
        [psychologistId, employeeId, tier, minutesRemaining]
    );
    return inserted.rows[0];
};

const updateClientMinutes = async ({ psychologistId, employeeId, minutesUsedDelta }) => {
    const record = await getPsychologistClientEntitlement(psychologistId, employeeId);
    const allowance = Number(record.minute_allowance || 0);
    const used = Math.max(0, Number(record.minutes_used || 0) + Number(minutesUsedDelta || 0));
    const remaining = allowance > 0 ? Math.max(0, allowance - used) : 0;
    const updated = await query(
        `UPDATE psychologist_client_call_accounts
         SET minutes_used = $1,
             minutes_remaining = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE psychologist_id = $3 AND employee_id = $4
         RETURNING *`,
        [used, remaining, psychologistId, employeeId]
    );
    return updated.rows[0] || record;
};

const getPsychologistClientCallFeeMinor = async (psychologistId, employeeId) => {
    const plan = await getPsychologistPlan(psychologistId);
    if (plan?.tier !== 'free') return 0;
    const feeMinor = toMinor(FREE_CALL_FEE_MAJOR);
    await query(
        `INSERT INTO psychologist_call_fees
         (psychologist_id, employee_id, fee_minor, currency_code, status)
         VALUES ($1, $2, $3, $4, 'due')
         ON CONFLICT (psychologist_id, employee_id)
         DO UPDATE SET fee_minor = EXCLUDED.fee_minor,
                       currency_code = EXCLUDED.currency_code,
                       updated_at = CURRENT_TIMESTAMP`,
        [psychologistId, employeeId, feeMinor, DEFAULT_CURRENCY]
    );
    return feeMinor;
};

const isPsychologistBusy = async ({ psychologistId, scheduledAt, durationMinutes }) => {
    const start = scheduledAt ? new Date(scheduledAt) : new Date();
    const end = new Date(start.getTime() + Number(durationMinutes || 60) * 60 * 1000);
    const busy = await query(
        `SELECT id
         FROM psychologist_session_bookings
         WHERE psychologist_id = $1
           AND status IN ('pending', 'confirmed')
           AND scheduled_at < $2
           AND (scheduled_at + make_interval(mins => duration_minutes)) > $3
         LIMIT 1`,
        [psychologistId, end.toISOString(), start.toISOString()]
    );
    return busy.rows.length > 0;
};

module.exports = {
    DEFAULT_CURRENCY,
    FREE_CALL_FEE_MAJOR,
    PREMIUM_MINUTES_PER_CLIENT,
    getPsychologistClientEntitlement,
    updateClientMinutes,
    getPsychologistClientCallFeeMinor,
    isPsychologistBusy
};
