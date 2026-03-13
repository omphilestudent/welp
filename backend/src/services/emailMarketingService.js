const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { query } = require('../utils/database');
const { getAudiencePricing } = require('./pricingService');
const { sendEmail } = require('../utils/emailService');

const AUDIENCE_TO_ROLE = {
    user: 'employee',
    psychologist: 'psychologist',
    business: 'business'
};

const OWNER_TYPE_MAP = {
    user: 'user',
    psychologist: 'psychologist',
    business: 'business'
};

const VALID_RECURRENCE = ['none', 'daily', 'weekly', 'monthly'];
const DEFAULT_TIMEZONE = 'Africa/Johannesburg';
const DEFAULT_SEND_HOUR = 14;
const DEFAULT_SEND_MINUTE = 0;
const LOGO_FILES = ['logo-1.png', 'logo.png', 'logo-2.png'];
const SAST_OFFSET_SUFFIX = '+02:00';
const EMAIL_CAMPAIGN_BATCH_SIZE = Number(process.env.EMAIL_CAMPAIGN_BATCH_SIZE || 3);
const EMAIL_CAMPAIGN_RECIPIENT_LIMIT = Number(process.env.EMAIL_CAMPAIGN_MAX_RECIPIENTS || 500);
const EMAIL_CAMPAIGN_CRON = process.env.EMAIL_CAMPAIGN_CRON || '*/5 * * * *';
const BASE_FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const BASE_BACKEND_URL = (process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:5000').replace(/\/$/, '');

let tablesInitialized = false;
let logosCache = null;
let schedulerJob = null;

const formatTime = (hour, minute) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

const isIsoWithZone = (value) => /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);

const appendSastOffset = (value) => {
    if (isIsoWithZone(value)) return value;
    return `${value}${SAST_OFFSET_SUFFIX}`;
};

const convertSastToUtc = (value) => {
    if (!value) return null;
    if (value instanceof Date) {
        return new Date(value.getTime());
    }
    const trimmed = String(value).trim();
    const body = trimmed.includes('T')
        ? trimmed
        : `${trimmed}T${formatTime(DEFAULT_SEND_HOUR, DEFAULT_SEND_MINUTE)}:00`;
    const iso = appendSastOffset(body);
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error('Invalid schedule date/time provided');
    }
    return parsed;
};

const computeDefaultSchedule = () => {
    const now = new Date();
    const future = new Date(now.getTime());
    future.setUTCDate(future.getUTCDate() + 3);
    const datePart = future.toISOString().split('T')[0];
    const iso = `${datePart}T${formatTime(DEFAULT_SEND_HOUR, DEFAULT_SEND_MINUTE)}:00`;
    return convertSastToUtc(iso);
};

const normalizeScheduleInput = (input = {}) => {
    if (input.scheduleDate && input.scheduleTime) {
        return convertSastToUtc(`${input.scheduleDate}T${input.scheduleTime}:00`);
    }
    if (input.scheduleDate) {
        return convertSastToUtc(`${input.scheduleDate}T${formatTime(DEFAULT_SEND_HOUR, DEFAULT_SEND_MINUTE)}:00`);
    }
    if (input.scheduleDateTime) {
        return convertSastToUtc(input.scheduleDateTime);
    }
    return computeDefaultSchedule();
};

const parseJson = (value, fallback) => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'object' && !Buffer.isBuffer(value)) return value;
    try {
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
};

const toAbsoluteUrl = (value) => {
    if (!value) return null;
    if (value.startsWith('data:')) return value;
    if (/^https?:\/\//i.test(value)) return value;
    const base = value.startsWith('/uploads') ? BASE_BACKEND_URL : BASE_FRONTEND_URL;
    return `${base}${value.startsWith('/') ? '' : '/'}${value}`;
};

const normalizeCampaignPayload = (input = {}, existing = {}) => {
    const fallbackPayload = existing.payload || {};
    const payloadSource = input.payload || input;
    const payload = {
        intro: payloadSource.intro ?? fallbackPayload.intro ?? 'We refreshed our pricing plans to deliver more value and clearer limits.',
        previewText: payloadSource.previewText ?? fallbackPayload.previewText ?? '',
        ctaLabel: payloadSource.ctaLabel ?? fallbackPayload.ctaLabel ?? 'View Pricing',
        ctaUrl: toAbsoluteUrl(payloadSource.ctaUrl ?? fallbackPayload.ctaUrl ?? `${BASE_FRONTEND_URL}/pricing`),
        country: payloadSource.country ?? fallbackPayload.country ?? null,
        currency: payloadSource.currency ?? fallbackPayload.currency ?? null
    };

    const assetUrls = Array.isArray(input.assetUrls)
        ? input.assetUrls.filter(Boolean)
        : Array.isArray(existing.asset_urls)
            ? existing.asset_urls
            : [];

    return {
        name: (input.name ?? existing.name ?? '').trim(),
        subject: (input.subject ?? existing.subject ?? '').trim(),
        audience: (input.audience ?? existing.audience ?? 'user').toLowerCase(),
        recurrence: (input.recurrence ?? existing.recurrence ?? 'none').toLowerCase(),
        requireSubscription: input.requireSubscription ?? existing.require_subscription ?? false,
        payload,
        assetUrls
    };
};

const initEmailMarketingTables = async () => {
    if (tablesInitialized) return;
    await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await query(`
        CREATE TABLE IF NOT EXISTS email_campaigns (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name VARCHAR(150) NOT NULL,
            subject VARCHAR(255) NOT NULL,
            audience VARCHAR(32) NOT NULL,
            status VARCHAR(24) NOT NULL DEFAULT 'scheduled',
            schedule_timezone VARCHAR(64) DEFAULT '${DEFAULT_TIMEZONE}',
            scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
            next_run_at TIMESTAMP WITH TIME ZONE,
            last_run_at TIMESTAMP WITH TIME ZONE,
            recurrence VARCHAR(24) NOT NULL DEFAULT 'none',
            require_subscription BOOLEAN DEFAULT false,
            payload JSONB DEFAULT '{}'::jsonb,
            asset_urls JSONB DEFAULT '[]'::jsonb,
            created_by UUID,
            updated_by UUID,
            last_error TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await query(`
        CREATE TABLE IF NOT EXISTS email_campaign_logs (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
            recipient_id UUID,
            recipient_email CITEXT NOT NULL,
            status VARCHAR(24) NOT NULL,
            error_message TEXT,
            sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_email_campaign_status ON email_campaigns(status, next_run_at)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_email_campaign_logs_campaign ON email_campaign_logs(campaign_id, sent_at DESC)`);
    tablesInitialized = true;
};

const serializeCampaignRow = (row) => {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        subject: row.subject,
        audience: row.audience,
        status: row.status,
        schedule_timezone: row.schedule_timezone,
        scheduled_for: row.scheduled_for,
        next_run_at: row.next_run_at,
        last_run_at: row.last_run_at,
        recurrence: row.recurrence,
        require_subscription: row.require_subscription,
        payload: parseJson(row.payload, {}),
        asset_urls: parseJson(row.asset_urls, []),
        created_by: row.created_by,
        updated_by: row.updated_by,
        last_error: row.last_error,
        created_at: row.created_at,
        updated_at: row.updated_at,
        sent_count: Number(row.sent_count || row.sent_total || 0),
        failed_count: Number(row.failed_count || row.failed_total || 0)
    };
};

const listCampaigns = async () => {
    await initEmailMarketingTables();
    const result = await query(`
        SELECT c.*,
               COALESCE(SUM(CASE WHEN l.status = 'sent' THEN 1 END), 0) AS sent_count,
               COALESCE(SUM(CASE WHEN l.status = 'failed' THEN 1 END), 0) AS failed_count
        FROM email_campaigns c
        LEFT JOIN email_campaign_logs l ON l.campaign_id = c.id
        GROUP BY c.id
        ORDER BY c.created_at DESC
    `);
    return result.rows.map(serializeCampaignRow);
};

const getCampaignRow = async (id) => {
    await initEmailMarketingTables();
    const result = await query('SELECT * FROM email_campaigns WHERE id = $1 LIMIT 1', [id]);
    return result.rows[0] || null;
};

const getCampaignById = async (id) => {
    const row = await getCampaignRow(id);
    return serializeCampaignRow(row);
};

const getCampaignLogs = async (campaignId, limit = 200) => {
    await initEmailMarketingTables();
    const result = await query(
        `SELECT * FROM email_campaign_logs WHERE campaign_id = $1 ORDER BY sent_at DESC LIMIT $2`,
        [campaignId, limit]
    );
    return result.rows;
};

const createCampaign = async (input = {}, userId) => {
    await initEmailMarketingTables();
    const normalized = normalizeCampaignPayload(input);
    if (!normalized.name) {
        throw new Error('Campaign name is required');
    }
    if (!normalized.subject) {
        throw new Error('Subject is required');
    }
    if (!AUDIENCE_TO_ROLE[normalized.audience]) {
        throw new Error('Unsupported audience');
    }
    if (!VALID_RECURRENCE.includes(normalized.recurrence)) {
        throw new Error('Unsupported recurrence value');
    }
    const scheduledFor = normalizeScheduleInput(input);
    const result = await query(
        `INSERT INTO email_campaigns
            (name, subject, audience, status, schedule_timezone, scheduled_for, next_run_at,
             recurrence, require_subscription, payload, asset_urls, created_by, updated_by)
         VALUES ($1,$2,$3,'scheduled',$4,$5,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$10)
         RETURNING *`,
        [
            normalized.name,
            normalized.subject,
            normalized.audience,
            DEFAULT_TIMEZONE,
            scheduledFor,
            normalized.recurrence,
            normalized.requireSubscription,
            JSON.stringify(normalized.payload),
            JSON.stringify(normalized.assetUrls || []),
            userId || null
        ]
    );
    return serializeCampaignRow(result.rows[0]);
};

const updateCampaign = async (id, updates = {}, userId) => {
    await initEmailMarketingTables();
    const existing = await getCampaignById(id);
    if (!existing) {
        throw new Error('Campaign not found');
    }
    if (existing.status === 'processing') {
        throw new Error('Campaign is currently sending; try again later');
    }
    const normalized = normalizeCampaignPayload(updates, existing);
    const scheduleChanged = updates.scheduleDate || updates.scheduleTime || updates.scheduleDateTime;
    const scheduledFor = scheduleChanged
        ? normalizeScheduleInput(updates)
        : existing.scheduled_for;
    const queryParts = [];
    const values = [];
    const pushSet = (clause, value) => {
        values.push(value);
        queryParts.push(`${clause} = $${values.length}`);
    };

    pushSet('name', normalized.name || existing.name);
    pushSet('subject', normalized.subject || existing.subject);
    pushSet('audience', normalized.audience);
    pushSet('recurrence', VALID_RECURRENCE.includes(normalized.recurrence) ? normalized.recurrence : existing.recurrence);
    pushSet('require_subscription', Boolean(normalized.requireSubscription));
    pushSet('payload', JSON.stringify(normalized.payload));
    pushSet('asset_urls', JSON.stringify(normalized.assetUrls));
    if (scheduleChanged) {
        pushSet('scheduled_for', scheduledFor);
        pushSet('next_run_at', scheduledFor);
    }
    pushSet('updated_by', userId || existing.updated_by);
    pushSet('updated_at', new Date());

    const result = await query(
        `UPDATE email_campaigns
         SET ${queryParts.join(', ')}
         WHERE id = $${values.length + 1}
         RETURNING *`,
        [...values, id]
    );
    return serializeCampaignRow(result.rows[0]);
};

const deleteCampaign = async (id) => {
    await initEmailMarketingTables();
    await query('DELETE FROM email_campaigns WHERE id = $1', [id]);
};

const findAssetFile = async (fileName) => {
    const searchDirs = [
        path.join(__dirname, '../../frontend/public'),
        path.join(__dirname, '../../public'),
        path.join(process.cwd(), 'frontend', 'public')
    ];
    for (const dir of searchDirs) {
        const candidate = path.join(dir, fileName);
        try {
            await fsp.access(candidate);
            const data = await fsp.readFile(candidate);
            const ext = path.extname(fileName).replace('.', '') || 'png';
            return `data:image/${ext};base64,${data.toString('base64')}`;
        } catch (error) {
            // continue
        }
    }
    return `${BASE_FRONTEND_URL}/${fileName}`;
};

const loadDefaultLogos = async () => {
    if (logosCache) return logosCache;
    const logos = [];
    for (const file of LOGO_FILES) {
        logos.push(await findAssetFile(file));
    }
    logosCache = logos;
    return logos;
};

const fetchPricingSnapshot = async (campaign) => {
    try {
        return await getAudiencePricing(campaign.audience, {
            country: campaign.payload?.country || undefined,
            currency: campaign.payload?.currency || undefined
        });
    } catch (error) {
        console.warn('Email marketing pricing fetch failed:', error.message);
        return { plans: [] };
    }
};

const renderPricingGrid = (plans = []) => {
    if (!Array.isArray(plans) || plans.length === 0) {
        return '<p style=\"color:#6b7280;margin:16px 0\">Pricing data is temporarily unavailable.</p>';
    }
    const cards = plans.slice(0, 3).map((plan) => {
        const features = Array.isArray(plan.features) ? plan.features.slice(0, 4) : [];
        const featureList = features.length
            ? `<ul style=\"padding-left:18px;margin:12px 0 0 0;color:#4b5563\">${features.map((feature) => `<li>${feature}</li>`).join('')}</ul>`
            : '';
        return `
            <div style=\"border:1px solid #e5e7eb;border-radius:12px;padding:16px;flex:1;min-width:180px;margin:8px\">
                <div style=\"font-size:14px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em\">${plan.planTier || plan.tier || 'Plan'}</div>
                <h4 style=\"margin:8px 0;font-size:18px;color:#111827\">${plan.displayName || plan.planCode}</h4>
                <div style=\"font-size:28px;font-weight:600;color:#111827\">${plan.priceFormatted || plan.price || '$0.00'}</div>
                <div style=\"font-size:12px;color:#6b7280\">${plan.billingPeriod === 'annual' ? 'per year' : 'per month'}</div>
                ${featureList}
            </div>
        `;
    }).join('');
    return `<div style=\"display:flex;flex-wrap:wrap;margin:0 -8px\">${cards}</div>`;
};

const buildTextVersion = (campaign, recipient, pricing) => {
    const name = recipient?.display_name || recipient?.email || 'there';
    const intro = campaign.payload?.intro || 'Here are the latest Welp plans tailored for you.';
    const plans = (pricing?.plans || []).slice(0, 3).map((plan) => {
        const label = plan.displayName || plan.planCode || 'Plan';
        return `• ${label}: ${plan.priceFormatted || plan.price || '$0.00'}`;
    });

    return [
        `Hi ${name},`,
        '',
        intro,
        '',
        plans.length ? ['Top plans:', ...plans, ''] : [],
        `View more details: ${campaign.payload?.ctaUrl || `${BASE_FRONTEND_URL}/pricing`}`,
        '',
        '— The Welp Team'
    ].flat().join('\n');
};

const buildCampaignEmail = async (campaign, recipient, pricingSnapshot) => {
    const logos = await loadDefaultLogos();
    const assets = (campaign.asset_urls || []).map(toAbsoluteUrl);
    const heroImages = [...logos, ...assets].slice(0, 4);
    const pricing = pricingSnapshot || await fetchPricingSnapshot(campaign);
    const pricingHtml = renderPricingGrid(pricing?.plans || []);
    const ctaLabel = campaign.payload?.ctaLabel || 'View Pricing';
    const ctaUrl = campaign.payload?.ctaUrl || `${BASE_FRONTEND_URL}/pricing`;

    const html = `
<!DOCTYPE html>
<html lang=\"en\">
<head>
  <meta charset=\"UTF-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />
  <title>${campaign.subject}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background:#f3f4f6; margin:0; padding:0; color:#111827; }
    .container { max-width:640px; margin:0 auto; padding:24px; }
    .card { background:#ffffff; border-radius:16px; padding:32px; box-shadow:0 25px 50px -12px rgba(15,23,42,0.15); border:1px solid #e5e7eb; }
    .logo-grid { display:flex; flex-wrap:wrap; gap:12px; justify-content:flex-start; margin-bottom:16px; }
    .logo-grid img { width:80px; height:auto; object-fit:contain; }
    .cta-btn { display:inline-block; padding:14px 32px; background:linear-gradient(135deg,#4f46e5,#7c3aed); color:#fff; border-radius:999px; text-decoration:none; font-weight:600; margin:24px 0; }
    .footer { font-size:12px; color:#6b7280; text-align:center; margin-top:16px; }
  </style>
</head>
<body>
  <div class=\"container\">
    <div class=\"card\">
      <div class=\"logo-grid\">
        ${heroImages.map((src) => `<img src=\"${src}\" alt=\"Brand asset\" />`).join('')}
      </div>
      <p style=\"font-size:14px; color:#6b7280; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:8px;\">${campaign.audience} pricing update</p>
      <h1 style=\"margin:0 0 16px; font-size:28px; line-height:1.2;\">${campaign.subject}</h1>
      <p style=\"font-size:17px; line-height:1.6; color:#111827;\">${campaign.payload?.intro || ''}</p>
      <div>${pricingHtml}</div>
      <a class=\"cta-btn\" href=\"${ctaUrl}\" target=\"_blank\" rel=\"noopener\">${ctaLabel}</a>
      <p style=\"font-size:14px; color:#4b5563;\">Prefer to revisit later? You can always see the full comparison inside Welp.</p>
    </div>
    <div class=\"footer\">
      <p>This message was scheduled for ${campaign.schedule_timezone || DEFAULT_TIMEZONE} and sent from Welp.</p>
      ${campaign.last_error ? `<p style=\"color:#b91c1c;\">${campaign.last_error}</p>` : ''}
    </div>
  </div>
</body>
</html>`;

    const text = buildTextVersion(campaign, recipient, pricing);
    return { html, text, pricing };
};

const logCampaignDelivery = async (campaignId, recipient, status, errorMessage = null) => {
    await query(
        `INSERT INTO email_campaign_logs (campaign_id, recipient_id, recipient_email, status, error_message)
         VALUES ($1, $2, $3, $4, $5)`,
        [campaignId, recipient?.id || null, recipient?.email, status, errorMessage]
    );
};

const computeNextRecurrence = (fromDate, recurrence) => {
    const base = fromDate ? new Date(fromDate) : computeDefaultSchedule();
    if (Number.isNaN(base.getTime())) return null;
    const increments = { daily: 1, weekly: 7, monthly: 30 };
    const days = increments[recurrence];
    if (!days) return null;
    const next = new Date(base.getTime());
    next.setUTCDate(next.getUTCDate() + days);
    return next;
};

const getRecipientsForCampaign = async (campaign) => {
    const role = AUDIENCE_TO_ROLE[campaign.audience] || 'employee';
    const ownerType = OWNER_TYPE_MAP[campaign.audience] || 'user';
    const requireSubscription = Boolean(campaign.require_subscription);

    const result = await query(
        `SELECT u.id, u.email, u.display_name, u.role
         FROM users u
         LEFT JOIN user_settings us ON us.user_id = u.id
         LEFT JOIN subscription_records sr
           ON sr.owner_id = u.id AND sr.owner_type = $2 AND sr.status = 'active'
         WHERE u.role = $1
           AND u.is_active = true
           AND u.email IS NOT NULL
           AND (us.marketing_notifications IS NULL OR us.marketing_notifications = true)
           AND ($3::boolean = false OR sr.id IS NOT NULL)
         ORDER BY u.created_at ASC
         LIMIT $4`,
        [role, ownerType, requireSubscription, EMAIL_CAMPAIGN_RECIPIENT_LIMIT]
    );
    return result.rows;
};

const runCampaign = async (rowOrId) => {
    const row = rowOrId?.id ? rowOrId : await getCampaignRow(rowOrId);
    if (!row) return null;
    const campaign = serializeCampaignRow(row);
    await query(
        `UPDATE email_campaigns
         SET status = 'processing', last_error = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [campaign.id]
    );

    try {
        const recipients = await getRecipientsForCampaign(campaign);
        if (recipients.length === 0) {
            await query(
                `UPDATE email_campaigns
                 SET status = 'failed', last_error = 'No eligible recipients', updated_at = CURRENT_TIMESTAMP, next_run_at = NULL
                 WHERE id = $1`,
                [campaign.id]
            );
            return { sent: 0, failed: 0 };
        }

        const pricing = await fetchPricingSnapshot(campaign);
        let sent = 0;
        let failed = 0;
        for (const recipient of recipients) {
            const composed = await buildCampaignEmail(campaign, recipient, pricing);
            const response = await sendEmail({
                to: recipient.email,
                subject: campaign.subject,
                html: composed.html,
                text: composed.text
            });

            if (response.success) {
                sent += 1;
                await logCampaignDelivery(campaign.id, recipient, 'sent');
            } else {
                failed += 1;
                await logCampaignDelivery(campaign.id, recipient, 'failed', response.error || 'Unknown error');
            }
        }

        const recurring = campaign.recurrence && campaign.recurrence !== 'none';
        const nextRun = recurring ? computeNextRecurrence(campaign.next_run_at || campaign.scheduled_for, campaign.recurrence) : null;
        const finalStatus = recurring ? 'scheduled' : (failed === recipients.length ? 'failed' : 'sent');
        const errorMessage = failed ? `${failed} recipient(s) failed to receive` : null;

        await query(
            `UPDATE email_campaigns
             SET status = $2,
                 last_run_at = CURRENT_TIMESTAMP,
                 next_run_at = $3,
                 last_error = $4,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [campaign.id, finalStatus, nextRun, errorMessage]
        );

        return { sent, failed, nextRun };
    } catch (error) {
        await query(
            `UPDATE email_campaigns
             SET status = 'retrying', last_error = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [campaign.id, error.message]
        );
        throw error;
    }
};

const processDueCampaigns = async () => {
    await initEmailMarketingTables();
    const result = await query(
        `SELECT * FROM email_campaigns
         WHERE status IN ('scheduled', 'retrying')
           AND next_run_at <= NOW()
         ORDER BY next_run_at ASC
         LIMIT $1`,
        [EMAIL_CAMPAIGN_BATCH_SIZE]
    );
    for (const campaign of result.rows) {
        try {
            await runCampaign(campaign);
        } catch (error) {
            console.warn(`Email campaign ${campaign.id} failed:`, error.message);
        }
    }
};

const startEmailCampaignScheduler = () => {
    if (schedulerJob) return schedulerJob;
    schedulerJob = cron.schedule(EMAIL_CAMPAIGN_CRON, () => {
        processDueCampaigns().catch((error) => {
            console.warn('Email campaign scheduler error:', error.message);
        });
    }, { timezone: 'UTC' });
    console.log('✅ Email marketing scheduler initialized');
    return schedulerJob;
};

const previewCampaignById = async (id) => {
    const campaign = await getCampaignById(id);
    if (!campaign) {
        throw new Error('Campaign not found');
    }
    const pricing = await fetchPricingSnapshot(campaign);
    const composed = await buildCampaignEmail(campaign, { display_name: 'Preview User', email: 'preview@example.com' }, pricing);
    return {
        subject: campaign.subject,
        html: composed.html,
        text: composed.text,
        pricing: (pricing?.plans || []).slice(0, 3)
    };
};

const previewDraftCampaign = async (input = {}) => {
    const normalized = normalizeCampaignPayload(input);
    const scheduledFor = normalizeScheduleInput(input);
    const draft = serializeCampaignRow({
        id: input.id || null,
        name: normalized.name || 'Draft Campaign',
        subject: normalized.subject || 'Preview Email',
        audience: normalized.audience || 'user',
        status: 'preview',
        schedule_timezone: DEFAULT_TIMEZONE,
        scheduled_for: scheduledFor,
        next_run_at: scheduledFor,
        last_run_at: null,
        recurrence: normalized.recurrence || 'none',
        require_subscription: normalized.requireSubscription,
        payload: normalized.payload,
        asset_urls: normalized.assetUrls,
        created_at: new Date(),
        updated_at: new Date()
    });
    const pricing = await fetchPricingSnapshot(draft);
    const composed = await buildCampaignEmail(draft, { display_name: 'Preview User', email: 'preview@example.com' }, pricing);
    return {
        subject: draft.subject,
        html: composed.html,
        text: composed.text,
        pricing: (pricing?.plans || []).slice(0, 3)
    };
};

const sendCampaignNow = async (id) => {
    const campaign = await getCampaignById(id);
    if (!campaign) {
        throw new Error('Campaign not found');
    }
    await query(
        `UPDATE email_campaigns
         SET next_run_at = NOW(), status = 'scheduled'
         WHERE id = $1`,
        [campaign.id]
    );
    return runCampaign(campaign.id);
};

module.exports = {
    initEmailMarketingTables,
    listCampaigns,
    getCampaignById,
    getCampaignLogs,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    previewCampaignById,
    previewDraftCampaign,
    sendCampaignNow,
    processDueCampaigns,
    startEmailCampaignScheduler,
    __testables: {
        convertSastToUtc,
        computeDefaultSchedule,
        normalizeCampaignPayload,
        renderPricingGrid,
        buildTextVersion
    }
};
