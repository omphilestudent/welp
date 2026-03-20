const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { query } = require('../utils/database');
const { getAdChargeBreakdown } = require('./adsService');

const INVOICE_FOLDER = path.join(__dirname, '../../uploads/invoices');
fs.mkdirSync(INVOICE_FOLDER, { recursive: true });

const INVOICE_PERIOD_DAYS = 30;

const generateInvoiceNumber = () => {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `INV-AD-${datePart}-${rand}`;
};

const formatMoney = (minor) => `$${(Number(minor || 0) / 100).toFixed(2)}`;

const buildInvoiceHtml = ({ invoice, business, items }) => {
    const period = `${new Date(invoice.period_start).toLocaleDateString()} - ${new Date(invoice.period_end).toLocaleDateString()}`;
    return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Ad Invoice ${invoice.invoice_number}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
      h1 { margin-bottom: 4px; }
      .meta { margin-bottom: 24px; color: #475569; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; }
      th { background: #f8fafc; }
      .total { text-align: right; font-weight: bold; }
    </style>
  </head>
  <body>
    <h1>Advertising Invoice</h1>
    <div class="meta">
      <div>Invoice: ${invoice.invoice_number}</div>
      <div>Business: ${business?.name || 'Business'}</div>
      <div>Period: ${period}</div>
      <div>Issued: ${new Date(invoice.created_at).toLocaleDateString()}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Campaign</th>
          <th>Placement</th>
          <th>Base</th>
          <th>Priority</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item) => `
          <tr>
            <td>${item.description}</td>
            <td>${item.placement || '-'}</td>
            <td>${formatMoney(item.base_price_minor)}</td>
            <td>${formatMoney(item.priority_surcharge_minor)}</td>
            <td>${formatMoney(item.total_minor)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p class="total">Total Due: ${formatMoney(invoice.total_minor)}</p>
  </body>
</html>`;
};

const generateInvoiceDocument = async ({ invoice, business, items }) => {
    const html = buildInvoiceHtml({ invoice, business, items });
    const filename = `invoice-${invoice.id}.html`;
    const filePath = path.join(INVOICE_FOLDER, filename);
    await fs.promises.writeFile(filePath, html, 'utf8');
    return `/uploads/invoices/${filename}`;
};

const fetchInvoiceCampaigns = async (businessId) => {
    const result = await query(
        `
        SELECT
            c.*,
            (
                SELECT jsonb_agg(jsonb_build_object('placement', ap.placement, 'weight', ap.weight))
                FROM ad_placements ap
                WHERE ap.campaign_id = c.id
            ) AS placements
        FROM advertising_campaigns c
        WHERE c.business_id = $1
          AND c.review_status = 'approved'
          AND c.status IN ('active','paused','completed','expired')
          AND c.status <> 'removed'
          AND COALESCE(c.last_invoiced_at, c.billing_cycle_anchor, c.created_at) <= NOW() - ($2 || ' days')::interval
        ORDER BY c.created_at ASC
        `,
        [businessId, INVOICE_PERIOD_DAYS]
    );
    return result.rows || [];
};

const generateInvoicesDue = async () => {
    const businesses = await query(
        `
        SELECT DISTINCT business_id
        FROM advertising_campaigns
        WHERE review_status = 'approved'
          AND status IN ('active','paused','completed','expired')
          AND status <> 'removed'
          AND COALESCE(last_invoiced_at, billing_cycle_anchor, created_at) <= NOW() - ($1 || ' days')::interval
        `,
        [INVOICE_PERIOD_DAYS]
    );

    const generated = [];

    for (const row of businesses.rows) {
        const businessId = row.business_id;
        const campaigns = await fetchInvoiceCampaigns(businessId);
        if (!campaigns.length) continue;

        const periodStart = campaigns
            .map((c) => c.last_invoiced_at || c.billing_cycle_anchor || c.created_at)
            .reduce((min, value) => (min && min < value ? min : value), null) || new Date();
        const periodEnd = new Date(new Date(periodStart).getTime() + INVOICE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

        const invoiceInsert = await query(
            `INSERT INTO ad_invoices (business_id, invoice_number, period_start, period_end, subtotal_minor, total_minor)
             VALUES ($1, $2, $3, $4, 0, 0)
             RETURNING *`,
            [businessId, generateInvoiceNumber(), periodStart, periodEnd]
        );
        const invoice = invoiceInsert.rows[0];

        const items = [];
        let subtotal = 0;

        for (const campaign of campaigns) {
            const placements = Array.isArray(campaign.placements) && campaign.placements.length
                ? campaign.placements
                : [{ placement: campaign.placement_type || 'business_profile', weight: 1 }];
            placements.forEach((placementEntry) => {
                const breakdown = getAdChargeBreakdown({
                    placement: placementEntry.placement,
                    adOption: campaign.ad_option || 'standard',
                    priorityLevel: campaign.priority_level || 1
                });
                subtotal += breakdown.totalMinor;
                items.push({
                    campaign_id: campaign.id,
                    description: campaign.name || 'Ad Campaign',
                    placement: placementEntry.placement,
                    base_price_minor: breakdown.basePriceMinor,
                    priority_surcharge_minor: breakdown.prioritySurchargeMinor,
                    total_minor: breakdown.totalMinor
                });
            });
        }

        const itemValues = [];
        const itemParams = [];
        items.forEach((item) => {
            itemParams.push(
                invoice.id,
                item.campaign_id,
                item.description,
                item.placement,
                item.base_price_minor,
                item.priority_surcharge_minor,
                item.total_minor
            );
            itemValues.push(
                `($${itemParams.length - 6}, $${itemParams.length - 5}, $${itemParams.length - 4}, $${itemParams.length - 3}, $${itemParams.length - 2}, $${itemParams.length - 1}, $${itemParams.length})`
            );
        });

        if (itemValues.length) {
            await query(
                `INSERT INTO ad_invoice_items (invoice_id, campaign_id, description, placement, base_price_minor, priority_surcharge_minor, total_minor)
                 VALUES ${itemValues.join(', ')}`,
                itemParams
            );
        }

        const business = await query(`SELECT name FROM companies WHERE id = $1`, [businessId]);
        const invoiceUrl = await generateInvoiceDocument({
            invoice: { ...invoice, period_start: periodStart, period_end: periodEnd, total_minor: subtotal },
            business: business.rows[0],
            items
        });

        await query(
            `UPDATE ad_invoices
             SET subtotal_minor = $2, total_minor = $2, invoice_url = $3
             WHERE id = $1`,
            [invoice.id, subtotal, invoiceUrl]
        );

        await query(
            `UPDATE advertising_campaigns
             SET last_invoiced_at = $2
             WHERE id = ANY($1::uuid[])`,
            [campaigns.map((c) => c.id), periodEnd]
        );

        generated.push({ invoiceId: invoice.id, businessId });
    }

    return generated;
};

const listBusinessInvoices = async (businessId) => {
    const result = await query(
        `SELECT * FROM ad_invoices WHERE business_id = $1 ORDER BY created_at DESC`,
        [businessId]
    );
    return result.rows;
};

const getInvoiceWithItems = async (invoiceId, businessId) => {
    const invoiceResult = await query(
        `SELECT * FROM ad_invoices WHERE id = $1 AND business_id = $2`,
        [invoiceId, businessId]
    );
    if (!invoiceResult.rows.length) return null;
    const items = await query(
        `SELECT * FROM ad_invoice_items WHERE invoice_id = $1 ORDER BY created_at ASC`,
        [invoiceId]
    );
    return { invoice: invoiceResult.rows[0], items: items.rows };
};

const startAdInvoiceScheduler = () => {
    return cron.schedule('0 2 * * *', async () => {
        try {
            await generateInvoicesDue();
        } catch (error) {
            console.warn('Ad invoice scheduler error:', error.message);
        }
    });
};

module.exports = {
    generateInvoicesDue,
    listBusinessInvoices,
    getInvoiceWithItems,
    generateInvoiceDocument,
    startAdInvoiceScheduler
};
