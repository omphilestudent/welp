const path = require('path');
const fs = require('fs');
const { query } = require('../utils/database');
const { getActiveSubscription } = require('./subscriptionService');

const DEFAULT_CURRENCY = (process.env.DEFAULT_CURRENCY || 'USD').toUpperCase();
const WELP_PROCESSING_FEE_MAJOR = Number(process.env.WELP_PROCESSING_FEE || 200);
const DEFAULT_PAYOUT_COUNTRY = (process.env.DEFAULT_PAYOUT_COUNTRY || 'ZA').toUpperCase();

const toMinor = (amountMajor) => Math.round(Number(amountMajor || 0) * 100);
const fromMinor = (amountMinor) => Number(amountMinor || 0) / 100;

const getWelpProcessingFeeMinor = () => toMinor(WELP_PROCESSING_FEE_MAJOR);

const getPsychologistPlan = async (psychologistId) => {
    const record = await getActiveSubscription('psychologist', psychologistId);
    if (!record) return { planCode: 'psychologist_free', tier: 'free' };
    const planCode = record.plan_code || record.planCode || 'psychologist_free';
    const normalized = String(planCode).toLowerCase();
    if (normalized.includes('premium') || normalized.includes('standard')) {
        return { planCode, tier: 'premium' };
    }
    return { planCode, tier: 'free' };
};

const psychologistHasLeadAccess = async (psychologistId) => {
    const plan = await getPsychologistPlan(psychologistId);
    return plan.tier === 'premium';
};

const getPsychologistRecommendationWeight = async ({ psychologistId, viewerTier }) => {
    const plan = await getPsychologistPlan(psychologistId);
    const isPaidViewer = viewerTier === 'premium';
    if (plan.tier === 'free' && isPaidViewer) {
        return 0.3;
    }
    return plan.tier === 'premium' ? 1.2 : 0.6;
};

const listRates = async (psychologistId) => {
    const result = await query(
        `SELECT *
         FROM psychologist_rates
         WHERE psychologist_id = $1
         ORDER BY duration_minutes ASC, created_at DESC`,
        [psychologistId]
    );
    return result.rows;
};

const upsertRate = async ({
    psychologistId,
    label,
    amountMajor,
    currencyCode = DEFAULT_CURRENCY,
    durationType = 'per_session',
    durationMinutes = 60,
    isActive = true
}) => {
    const amountMinor = toMinor(amountMajor);
    const result = await query(
        `INSERT INTO psychologist_rates
         (psychologist_id, label, amount_minor, currency_code, duration_type, duration_minutes, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (psychologist_id, duration_minutes) DO UPDATE
         SET label = EXCLUDED.label,
             amount_minor = EXCLUDED.amount_minor,
             currency_code = EXCLUDED.currency_code,
             duration_type = EXCLUDED.duration_type,
             is_active = EXCLUDED.is_active,
             updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [psychologistId, label || null, amountMinor, currencyCode, durationType, Number(durationMinutes) || 60, isActive]
    );
    return result.rows[0];
};

const setRateActive = async (rateId, psychologistId) => {
    await query(
        `UPDATE psychologist_rates
         SET is_active = false
         WHERE psychologist_id = $1`,
        [psychologistId]
    );
    const result = await query(
        `UPDATE psychologist_rates
         SET is_active = true, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND psychologist_id = $2
         RETURNING *`,
        [rateId, psychologistId]
    );
    return result.rows[0] || null;
};

const getActiveRate = async (psychologistId) => {
    const result = await query(
        `SELECT *
         FROM psychologist_rates
         WHERE psychologist_id = $1 AND is_active = true
         ORDER BY created_at DESC
         LIMIT 1`,
        [psychologistId]
    );
    return result.rows[0] || null;
};

const getPayoutAccount = async (psychologistId) => {
    const result = await query(
        `SELECT *
         FROM psychologist_payout_accounts
         WHERE psychologist_id = $1`,
        [psychologistId]
    );
    return result.rows[0] || null;
};

const upsertPayoutAccount = async (psychologistId, payload) => {
    const {
        accountNumber,
        accountHolder,
        bankName,
        notes,
        countryCode,
        branchCode,
        routingNumber,
        swiftCode
    } = payload || {};
    const result = await query(
        `INSERT INTO psychologist_payout_accounts
         (psychologist_id, account_number, account_holder, bank_name, notes, country_code, branch_code, routing_number, swift_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (psychologist_id) DO UPDATE
         SET account_number = EXCLUDED.account_number,
             account_holder = EXCLUDED.account_holder,
             bank_name = EXCLUDED.bank_name,
             notes = EXCLUDED.notes,
             country_code = EXCLUDED.country_code,
             branch_code = EXCLUDED.branch_code,
             routing_number = EXCLUDED.routing_number,
             swift_code = EXCLUDED.swift_code,
             updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
            psychologistId,
            accountNumber,
            accountHolder || null,
            bankName || null,
            notes || null,
            countryCode || DEFAULT_PAYOUT_COUNTRY,
            branchCode || null,
            routingNumber || null,
            swiftCode || null
        ]
    );
    return result.rows[0];
};

const getPayoutFieldRequirements = (countryCode) => {
    const code = String(countryCode || DEFAULT_PAYOUT_COUNTRY).toUpperCase();
    const base = {
        countryCode: code,
        required: ['accountNumber', 'accountHolder'],
        optional: ['bankName', 'notes']
    };
    if (code === 'ZA') {
        base.required.push('branchCode');
        base.optional.push('bankName');
        return base;
    }
    if (code === 'US') {
        base.required.push('routingNumber');
        return base;
    }
    base.optional.push('swiftCode');
    return base;
};

const validatePayoutDetailsByCountry = (countryCode, payload) => {
    const requirements = getPayoutFieldRequirements(countryCode);
    const missing = requirements.required.filter((field) => {
        const value = payload?.[field];
        return !value || String(value).trim().length === 0;
    });
    return { requirements, missing };
};

const isPayoutProfileComplete = (account) => {
    if (!account) return false;
    const { requirements, missing } = validatePayoutDetailsByCountry(account.country_code, {
        accountNumber: account.account_number,
        accountHolder: account.account_holder,
        branchCode: account.branch_code,
        routingNumber: account.routing_number,
        swiftCode: account.swift_code
    });
    if (missing.length) return false;
    return Boolean(account.proof_document_url);
};

const getAvailability = async (psychologistId, fromDate) => {
    const result = await query(
        `SELECT id, scheduled_for, title, type, status, location
         FROM psychologist_schedule_items
         WHERE psychologist_id = $1
           AND scheduled_for >= $2
         ORDER BY scheduled_for ASC`,
        [psychologistId, fromDate]
    );
    return result.rows;
};

const listWeeklyAvailability = async ({ psychologistId, weekStart }) => {
    const start = new Date(weekStart);
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const slotsResult = await query(
        `SELECT day_of_week, hour, is_available
         FROM psychologist_hourly_availability
         WHERE psychologist_id = $1`,
        [psychologistId]
    );
    const bookedResult = await query(
        `SELECT scheduled_at, duration_minutes
         FROM psychologist_session_bookings
         WHERE psychologist_id = $1
           AND status IN ('pending', 'confirmed')
           AND scheduled_at >= $2
           AND scheduled_at < $3`,
        [psychologistId, start.toISOString(), end.toISOString()]
    );
    const availableMap = new Map();
    slotsResult.rows.forEach((row) => {
        availableMap.set(`${row.day_of_week}-${row.hour}`, row.is_available);
    });
    const bookedMap = new Set();
    bookedResult.rows.forEach((row) => {
        const date = new Date(row.scheduled_at);
        const dayOfWeek = date.getUTCDay();
        const hour = date.getUTCHours();
        bookedMap.add(`${dayOfWeek}-${hour}`);
    });
    const slots = [];
    for (let day = 0; day < 7; day += 1) {
        for (let hour = 0; hour < 24; hour += 1) {
            const key = `${day}-${hour}`;
            const isAvailable = Boolean(availableMap.get(key));
            const isBooked = bookedMap.has(key);
            slots.push({
                dayOfWeek: day,
                hour,
                isAvailable: isAvailable && !isBooked
            });
        }
    }
    return slots;
};

const upsertWeeklyAvailability = async ({ psychologistId, slots }) => {
    if (!Array.isArray(slots)) return [];
    const updates = [];
    for (const slot of slots) {
        const day = Number(slot.dayOfWeek);
        const hour = Number(slot.hour);
        if (Number.isNaN(day) || Number.isNaN(hour)) continue;
        await query(
            `INSERT INTO psychologist_hourly_availability
             (psychologist_id, day_of_week, hour, is_available)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (psychologist_id, day_of_week, hour)
             DO UPDATE SET is_available = EXCLUDED.is_available,
                           updated_at = CURRENT_TIMESTAMP`,
            [psychologistId, day, hour, Boolean(slot.isAvailable)]
        );
        updates.push({ dayOfWeek: day, hour, isAvailable: Boolean(slot.isAvailable) });
    }
    return updates;
};

const ensureBookingSlot = async ({ psychologistId, scheduledAt, durationMinutes }) => {
    const scheduledStart = new Date(scheduledAt);
    const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60 * 1000);
    const dayOfWeek = scheduledStart.getUTCDay();
    const hour = scheduledStart.getUTCHours();
    const availabilityResult = await query(
        `SELECT is_available
         FROM psychologist_hourly_availability
         WHERE psychologist_id = $1 AND day_of_week = $2 AND hour = $3`,
        [psychologistId, dayOfWeek, hour]
    );
    if (!availabilityResult.rows.length || !availabilityResult.rows[0].is_available) {
        return false;
    }
    const result = await query(
        `SELECT id
         FROM psychologist_session_bookings
         WHERE psychologist_id = $1
           AND status IN ('pending', 'confirmed')
           AND scheduled_at < $2
           AND (scheduled_at + make_interval(mins => duration_minutes)) > $3
         LIMIT 1`,
        [psychologistId, scheduledEnd.toISOString(), scheduledStart.toISOString()]
    );
    return result.rows.length === 0;
};

const createBooking = async ({
    psychologistId,
    employeeId,
    rateId,
    scheduledAt,
    durationMinutes
}) => {
    const slotOk = await ensureBookingSlot({ psychologistId, scheduledAt, durationMinutes });
    if (!slotOk) {
        const error = new Error('Selected time is no longer available');
        error.code = 'SLOT_UNAVAILABLE';
        throw error;
    }
    const result = await query(
        `INSERT INTO psychologist_session_bookings
         (psychologist_id, employee_id, rate_id, scheduled_at, duration_minutes, status)
         VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING *`,
        [psychologistId, employeeId, rateId, scheduledAt, durationMinutes]
    );
    return result.rows[0];
};

const calculateSessionBaseAmount = ({ rate, durationMinutes }) => {
    if (!rate) return 0;
    if (rate.duration_minutes) {
        return Number(rate.amount_minor || 0);
    }
    if (rate.duration_type === 'per_minute') {
        return Number(rate.amount_minor || 0) * Number(durationMinutes || 0);
    }
    const hours = Number(durationMinutes || 0) / 60;
    return Math.round(Number(rate.amount_minor || 0) * hours);
};

const calculateCheckoutTotals = ({ baseAmountMinor }) => {
    const fee = getWelpProcessingFeeMinor();
    const total = Number(baseAmountMinor || 0) + fee;
    return { baseAmountMinor, welpFeeMinor: fee, totalAmountMinor: total };
};

const checkoutBooking = async ({ bookingId, payerId }) => {
    const bookingResult = await query(
        `SELECT b.*, r.amount_minor, r.currency_code, r.duration_type
         FROM psychologist_session_bookings b
         LEFT JOIN psychologist_rates r ON r.id = b.rate_id
         WHERE b.id = $1`,
        [bookingId]
    );
    const booking = bookingResult.rows[0];
    if (!booking) {
        const error = new Error('Booking not found');
        error.code = 'BOOKING_NOT_FOUND';
        throw error;
    }
    if (booking.status !== 'pending') {
        const error = new Error('Booking already processed');
        error.code = 'BOOKING_ALREADY_PROCESSED';
        throw error;
    }

    const baseAmountMinor = calculateSessionBaseAmount({
        rate: booking,
        durationMinutes: booking.duration_minutes
    });
    const { welpFeeMinor, totalAmountMinor } = calculateCheckoutTotals({ baseAmountMinor });

    const paymentResult = await query(
        `INSERT INTO psychologist_session_payments
         (booking_id, payer_user_id, psychologist_id, base_amount_minor, welp_fee_minor, total_amount_minor, currency_code, payment_status, payout_status, paid_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'paid', 'unpaid', CURRENT_TIMESTAMP)
         RETURNING *`,
        [
            bookingId,
            payerId,
            booking.psychologist_id,
            baseAmountMinor,
            welpFeeMinor,
            totalAmountMinor,
            booking.currency_code || DEFAULT_CURRENCY
        ]
    );

    await query(
        `UPDATE psychologist_session_bookings
         SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [bookingId]
    );

    return paymentResult.rows[0];
};

const listPaymentsForPsychologist = async (psychologistId) => {
    const result = await query(
        `SELECT p.*, b.scheduled_at, b.duration_minutes
         FROM psychologist_session_payments p
         JOIN psychologist_session_bookings b ON b.id = p.booking_id
         WHERE p.psychologist_id = $1
         ORDER BY p.paid_at DESC`,
        [psychologistId]
    );
    return result.rows;
};

const markPayoutPaid = async ({ paymentId }) => {
    const result = await query(
        `UPDATE psychologist_session_payments
         SET payout_status = 'paid',
             payout_processed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND payout_status <> 'paid'
         RETURNING *`,
        [paymentId]
    );
    return result.rows[0] || null;
};

const calculateLedgerTotals = (payments) => {
    const totals = {
        grossMinor: 0,
        feeMinor: 0,
        netMinor: 0,
        unpaidMinor: 0
    };
    payments.forEach((payment) => {
        totals.grossMinor += Number(payment.base_amount_minor || 0);
        totals.feeMinor += Number(payment.welp_fee_minor || 0);
        totals.netMinor += Number(payment.base_amount_minor || 0);
        if (payment.payout_status !== 'paid') {
            totals.unpaidMinor += Number(payment.base_amount_minor || 0);
        }
    });
    return totals;
};

const generateMonthlyStatement = async ({ psychologistId, periodStart, periodEnd }) => {
    const result = await query(
        `SELECT p.*, b.scheduled_at, b.duration_minutes
         FROM psychologist_session_payments p
         JOIN psychologist_session_bookings b ON b.id = p.booking_id
         WHERE p.psychologist_id = $1
           AND p.paid_at >= $2
           AND p.paid_at < $3
         ORDER BY p.paid_at ASC`,
        [psychologistId, periodStart, periodEnd]
    );
    const payments = result.rows;
    const totals = calculateLedgerTotals(payments);
    const filename = `psychologist-statement-${psychologistId}-${periodStart}.txt`;
    const statementsDir = path.join(__dirname, '../../uploads/statements');
    if (!fs.existsSync(statementsDir)) {
        fs.mkdirSync(statementsDir, { recursive: true });
    }
    const filePath = path.join(statementsDir, filename);
    const lines = [
        `Statement period: ${periodStart} to ${periodEnd}`,
        `Psychologist ID: ${psychologistId}`,
        `Gross earnings: ${fromMinor(totals.grossMinor).toFixed(2)}`,
        `Welp fees: ${fromMinor(totals.feeMinor).toFixed(2)}`,
        `Net earnings: ${fromMinor(totals.netMinor).toFixed(2)}`,
        '',
        'Payments:'
    ];
    payments.forEach((payment) => {
        lines.push(
            `${payment.paid_at} | Base ${fromMinor(payment.base_amount_minor).toFixed(2)} | Fee ${fromMinor(payment.welp_fee_minor).toFixed(2)} | Status ${payment.payout_status}`
        );
    });
    fs.writeFileSync(filePath, lines.join('\n'));

    const statement = await query(
        `INSERT INTO psychologist_statements
         (psychologist_id, period_start, period_end, total_gross_minor, total_fee_minor, total_net_minor, currency_code, statement_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (psychologist_id, period_start, period_end)
         DO UPDATE SET total_gross_minor = EXCLUDED.total_gross_minor,
                       total_fee_minor = EXCLUDED.total_fee_minor,
                       total_net_minor = EXCLUDED.total_net_minor,
                       statement_url = EXCLUDED.statement_url,
                       updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [
            psychologistId,
            periodStart,
            periodEnd,
            totals.grossMinor,
            totals.feeMinor,
            totals.netMinor,
            DEFAULT_CURRENCY,
            `/uploads/statements/${filename}`
        ]
    );

    return { statement: statement.rows[0], payments, totals };
};

const listStatements = async (psychologistId) => {
    const result = await query(
        `SELECT *
         FROM psychologist_statements
         WHERE psychologist_id = $1
         ORDER BY period_start DESC`,
        [psychologistId]
    );
    return result.rows;
};

module.exports = {
    DEFAULT_CURRENCY,
    toMinor,
    fromMinor,
    getWelpProcessingFeeMinor,
    getPsychologistPlan,
    psychologistHasLeadAccess,
    getPsychologistRecommendationWeight,
    listRates,
    upsertRate,
    setRateActive,
    getActiveRate,
    getPayoutAccount,
    upsertPayoutAccount,
    getPayoutFieldRequirements,
    validatePayoutDetailsByCountry,
    isPayoutProfileComplete,
    getAvailability,
    listWeeklyAvailability,
    upsertWeeklyAvailability,
    createBooking,
    checkoutBooking,
    listPaymentsForPsychologist,
    markPayoutPaid,
    calculateSessionBaseAmount,
    calculateCheckoutTotals,
    calculateLedgerTotals,
    generateMonthlyStatement,
    listStatements
};
