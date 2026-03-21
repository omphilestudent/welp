const path = require('path');
const fs = require('fs');
const { uploadToCloudinary, isCloudinaryConfigured } = require('../utils/cloudinary');
const { query } = require('../utils/database');
const {
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
    calculateLedgerTotals,
    generateMonthlyStatement,
    listStatements,
    getPsychologistPlan,
    psychologistHasLeadAccess,
    calculateCheckoutTotals,
    calculateSessionBaseAmount,
    getWelpProcessingFeeMinor,
    fromMinor
} = require('../services/psychologistBillingService');

const getRatesForPsychologist = async (req, res) => {
    try {
        const { psychologistId } = req.params;
        const rates = await listRates(psychologistId);
        res.json({ rates });
    } catch (error) {
        console.error('Get psychologist rates error:', error);
        res.status(500).json({ error: 'Failed to load rates' });
    }
};

const getMyRates = async (req, res) => {
    try {
        const rates = await listRates(req.user.id);
        res.json({ rates });
    } catch (error) {
        console.error('Get my rates error:', error);
        res.status(500).json({ error: 'Failed to load rates' });
    }
};

const createRate = async (req, res) => {
    try {
        const { amount, currencyCode, durationMinutes, label, setActive = true } = req.body;
        if (!amount || Number(amount) <= 0) {
            return res.status(400).json({ error: 'Rate amount must be greater than 0' });
        }
        const allowedDurations = [15, 30, 60];
        const minutes = Number(durationMinutes);
        if (!allowedDurations.includes(minutes)) {
            return res.status(400).json({ error: 'durationMinutes must be 15, 30, or 60' });
        }
        const rate = await upsertRate({
            psychologistId: req.user.id,
            label: label || `${minutes}-minute session`,
            amountMajor: Number(amount),
            currencyCode: currencyCode || 'USD',
            durationType: 'per_session',
            durationMinutes: minutes,
            isActive: Boolean(setActive)
        });
        res.status(201).json({ rate });
    } catch (error) {
        console.error('Create rate error:', error);
        res.status(500).json({ error: 'Failed to save rate' });
    }
};

const setActiveRate = async (req, res) => {
    try {
        const { rateId } = req.params;
        const rate = await setRateActive(rateId, req.user.id);
        if (!rate) {
            return res.status(404).json({ error: 'Rate not found' });
        }
        res.json({ rate });
    } catch (error) {
        console.error('Set rate error:', error);
        res.status(500).json({ error: 'Failed to update rate' });
    }
};

const getPayoutDetails = async (req, res) => {
    try {
        const account = await getPayoutAccount(req.user.id);
        res.json({
            account,
            requirements: getPayoutFieldRequirements(account?.country_code),
            isComplete: isPayoutProfileComplete(account)
        });
    } catch (error) {
        console.error('Get payout details error:', error);
        res.status(500).json({ error: 'Failed to load payout details' });
    }
};

const updatePayoutDetails = async (req, res) => {
    try {
        const {
            accountNumber,
            accountHolder,
            bankName,
            notes,
            countryCode,
            branchCode,
            routingNumber,
            swiftCode
        } = req.body || {};
        const validation = validatePayoutDetailsByCountry(countryCode, {
            accountNumber,
            accountHolder,
            branchCode,
            routingNumber,
            swiftCode
        });
        if (validation.missing.length) {
            return res.status(400).json({ error: `Missing required fields: ${validation.missing.join(', ')}` });
        }
        const account = await upsertPayoutAccount(req.user.id, {
            accountNumber: String(accountNumber).trim(),
            accountHolder,
            bankName,
            notes,
            countryCode,
            branchCode,
            routingNumber,
            swiftCode
        });
        res.json({
            account,
            requirements: validation.requirements,
            isComplete: isPayoutProfileComplete(account)
        });
    } catch (error) {
        console.error('Update payout details error:', error);
        res.status(500).json({ error: 'Failed to save payout details' });
    }
};

const getAvailabilityForPsychologist = async (req, res) => {
    try {
        const { psychologistId } = req.params;
        const weekStart = req.query.weekStart ? new Date(req.query.weekStart) : new Date();
        const availability = await listWeeklyAvailability({
            psychologistId,
            weekStart: weekStart.toISOString()
        });
        res.json({ availability, weekStart: weekStart.toISOString() });
    } catch (error) {
        console.error('Get availability error:', error);
        res.status(500).json({ error: 'Failed to load availability' });
    }
};

const getWeeklyAvailabilityForDashboard = async (req, res) => {
    try {
        const weekStart = req.query.weekStart ? new Date(req.query.weekStart) : new Date();
        const availability = await listWeeklyAvailability({
            psychologistId: req.user.id,
            weekStart: weekStart.toISOString()
        });
        res.json({ availability, weekStart: weekStart.toISOString() });
    } catch (error) {
        console.error('Get weekly availability error:', error);
        res.status(500).json({ error: 'Failed to load availability' });
    }
};

const updateWeeklyAvailabilityForDashboard = async (req, res) => {
    try {
        const { slots } = req.body || {};
        const updates = await upsertWeeklyAvailability({
            psychologistId: req.user.id,
            slots
        });
        res.json({ updates });
    } catch (error) {
        console.error('Update weekly availability error:', error);
        res.status(500).json({ error: 'Failed to save availability' });
    }
};

const createBookingForPsychologist = async (req, res) => {
    try {
        const { psychologistId } = req.params;
        const { rateId, scheduledAt, durationMinutes = 60 } = req.body || {};
        if (!rateId || !scheduledAt) {
            return res.status(400).json({ error: 'rateId and scheduledAt are required' });
        }
        const rate = await getActiveRate(psychologistId);
        if (!rate || (rate.id !== rateId && rateId)) {
            const { rows } = await query(
                `SELECT * FROM psychologist_rates WHERE id = $1 AND psychologist_id = $2 AND is_active = true`,
                [rateId, psychologistId]
            );
            if (!rows.length) {
                return res.status(400).json({ error: 'Selected rate is not active' });
            }
            if (Number(durationMinutes) && Number(rows[0].duration_minutes) !== Number(durationMinutes)) {
                return res.status(400).json({ error: 'Duration does not match selected rate' });
            }
        }
        const booking = await createBooking({
            psychologistId,
            employeeId: req.user.id,
            rateId,
            scheduledAt,
            durationMinutes: Number(durationMinutes) || Number(rate?.duration_minutes || 60)
        });
        res.status(201).json({ booking });
    } catch (error) {
        if (error.code === 'SLOT_UNAVAILABLE') {
            return res.status(409).json({ error: error.message });
        }
        console.error('Create booking error:', error);
        res.status(500).json({ error: 'Failed to create booking' });
    }
};

const checkoutBookingPayment = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const payment = await checkoutBooking({ bookingId, payerId: req.user.id });
        res.json({ payment });
    } catch (error) {
        if (error.code === 'BOOKING_NOT_FOUND') {
            return res.status(404).json({ error: error.message });
        }
        if (error.code === 'BOOKING_ALREADY_PROCESSED') {
            return res.status(400).json({ error: error.message });
        }
        console.error('Checkout booking error:', error);
        res.status(500).json({ error: 'Failed to process payment' });
    }
};

const getPsychologistLedger = async (req, res) => {
    try {
        const payments = await listPaymentsForPsychologist(req.user.id);
        const totals = calculateLedgerTotals(payments);
        res.json({ payments, totals });
    } catch (error) {
        console.error('Get ledger error:', error);
        res.status(500).json({ error: 'Failed to load ledger' });
    }
};

const getEarningsSummary = async (req, res) => {
    try {
        const payments = await listPaymentsForPsychologist(req.user.id);
        const totals = calculateLedgerTotals(payments);
        res.json({
            totals,
            totalsFormatted: {
                gross: fromMinor(totals.grossMinor),
                fee: fromMinor(totals.feeMinor),
                net: fromMinor(totals.netMinor),
                unpaid: fromMinor(totals.unpaidMinor)
            }
        });
    } catch (error) {
        console.error('Get earnings summary error:', error);
        res.status(500).json({ error: 'Failed to load earnings summary' });
    }
};

const listMonthlyStatements = async (req, res) => {
    try {
        const statements = await listStatements(req.user.id);
        res.json({ statements });
    } catch (error) {
        console.error('List statements error:', error);
        res.status(500).json({ error: 'Failed to load statements' });
    }
};

const generateStatement = async (req, res) => {
    try {
        const { year, month } = req.body || {};
        const numericYear = Number(year);
        const numericMonth = Number(month);
        if (!numericYear || !numericMonth || numericMonth < 1 || numericMonth > 12) {
            return res.status(400).json({ error: 'Valid year and month are required' });
        }
        const periodStart = new Date(Date.UTC(numericYear, numericMonth - 1, 1));
        const periodEnd = new Date(Date.UTC(numericYear, numericMonth, 1));
        const payload = await generateMonthlyStatement({
            psychologistId: req.user.id,
            periodStart: periodStart.toISOString().slice(0, 10),
            periodEnd: periodEnd.toISOString().slice(0, 10)
        });
        res.json(payload);
    } catch (error) {
        console.error('Generate statement error:', error);
        res.status(500).json({ error: 'Failed to generate statement' });
    }
};

const downloadStatement = async (req, res) => {
    try {
        const { statementId } = req.params;
        const result = await query(
            `SELECT * FROM psychologist_statements WHERE id = $1 AND psychologist_id = $2`,
            [statementId, req.user.id]
        );
        const statement = result.rows[0];
        if (!statement) {
            return res.status(404).json({ error: 'Statement not found' });
        }
        const filename = path.basename(String(statement.statement_url || ''));
        const filePath = path.join(__dirname, '../../uploads/statements', filename);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Statement file not found' });
        }
        return res.download(filePath, filename);
    } catch (error) {
        console.error('Download statement error:', error);
        res.status(500).json({ error: 'Failed to download statement' });
    }
};

const uploadPayoutProof = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Proof of account document is required' });
        }
        let proofUrl = `/uploads/payout-proofs/${req.file.filename}`;
        if (isCloudinaryConfigured()) {
            const cloudUrl = await uploadToCloudinary(req.file.path, { folder: 'welp/payout-proofs' });
            if (!cloudUrl) {
                return res.status(500).json({ error: 'Failed to upload proof document' });
            }
            proofUrl = cloudUrl;
        }
        const update = await query(
            `UPDATE psychologist_payout_accounts
             SET proof_document_url = $1,
                 proof_document_type = $2,
                 proof_verified = false,
                 updated_at = CURRENT_TIMESTAMP
             WHERE psychologist_id = $3
             RETURNING *`,
            [proofUrl, req.file.mimetype || null, req.user.id]
        );
        if (!update.rows.length) {
            return res.status(400).json({ error: 'Save payout details before uploading proof' });
        }
        const account = update.rows[0];
        res.json({ account, isComplete: isPayoutProfileComplete(account) });
    } catch (error) {
        console.error('Upload payout proof error:', error);
        res.status(500).json({ error: 'Failed to upload proof document' });
    }
};

const getDashboardPlan = async (req, res) => {
    try {
        const plan = await getPsychologistPlan(req.user.id);
        const leadAccess = await psychologistHasLeadAccess(req.user.id);
        res.json({ plan, leadAccess });
    } catch (error) {
        console.error('Get plan error:', error);
        res.status(500).json({ error: 'Failed to load plan' });
    }
};

const getBookingPreview = async (req, res) => {
    try {
        const { psychologistId } = req.params;
        const activeRate = await getActiveRate(psychologistId);
        if (!activeRate) {
            return res.status(404).json({ error: 'No active rate found' });
        }
        const durationMinutes = Number(req.query.durationMinutes || 60);
        const baseAmountMinor = calculateSessionBaseAmount({ rate: activeRate, durationMinutes });
        const totals = calculateCheckoutTotals({ baseAmountMinor });
        res.json({
            rate: activeRate,
            durationMinutes,
            baseAmountMinor,
            welpFeeMinor: totals.welpFeeMinor,
            totalAmountMinor: totals.totalAmountMinor
        });
    } catch (error) {
        console.error('Booking preview error:', error);
        res.status(500).json({ error: 'Failed to load booking preview' });
    }
};

const adminLookupLedgerByAccount = async (req, res) => {
    try {
        const { accountNumber } = req.body || {};
        if (!accountNumber) {
            return res.status(400).json({ error: 'Account number is required' });
        }
        const accountResult = await query(
            `SELECT psychologist_id, account_number, account_holder, bank_name
             FROM psychologist_payout_accounts
             WHERE account_number = $1`,
            [String(accountNumber).trim()]
        );
        const account = accountResult.rows[0];
        if (!account) {
            return res.status(404).json({ error: 'No psychologist found for that account number' });
        }
        const payments = await listPaymentsForPsychologist(account.psychologist_id);
        const totals = calculateLedgerTotals(payments);
        res.json({
            psychologistId: account.psychologist_id,
            account,
            payments,
            totals
        });
    } catch (error) {
        console.error('Admin ledger lookup error:', error);
        res.status(500).json({ error: 'Failed to load ledger' });
    }
};

const adminMarkPayoutPaid = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const updated = await query(
            `UPDATE psychologist_session_payments
             SET payout_status = 'paid',
                 payout_processed_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND payout_status <> 'paid'
             RETURNING *`,
            [paymentId]
        );
        if (!updated.rows.length) {
            return res.status(404).json({ error: 'Payment not found or already paid' });
        }
        res.json({ payment: updated.rows[0] });
    } catch (error) {
        console.error('Admin payout update error:', error);
        res.status(500).json({ error: 'Failed to update payout status' });
    }
};

module.exports = {
    getRatesForPsychologist,
    getMyRates,
    createRate,
    setActiveRate,
    getPayoutDetails,
    updatePayoutDetails,
    getAvailabilityForPsychologist,
    getWeeklyAvailabilityForDashboard,
    updateWeeklyAvailabilityForDashboard,
    createBookingForPsychologist,
    checkoutBookingPayment,
    getPsychologistLedger,
    getEarningsSummary,
    listMonthlyStatements,
    generateStatement,
    downloadStatement,
    uploadPayoutProof,
    getDashboardPlan,
    getBookingPreview,
    adminLookupLedgerByAccount,
    adminMarkPayoutPaid
};
