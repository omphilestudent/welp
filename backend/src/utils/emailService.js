
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
let sendgridMail = null;
const baseEnvPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: baseEnvPath });
const sendgridEnvPath = path.resolve(process.cwd(), 'sendgrid.env');
if (fs.existsSync(sendgridEnvPath)) {
    dotenv.config({ path: sendgridEnvPath, override: false });
}
let getAudiencePricing = null;


const isSendgridConfigured = () => {
    return process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== '';
};

const isEmailConfigured = () => {
    return process.env.EMAIL_USER &&
        process.env.EMAIL_PASSWORD &&
        process.env.EMAIL_USER !== '' &&
        process.env.EMAIL_PASSWORD !== '';
};

const isProviderSendgrid = () => {
    return String(process.env.EMAIL_PROVIDER || '').toLowerCase() === 'sendgrid';
};


let transporter = null;
if (isProviderSendgrid() && isSendgridConfigured()) {
    try {
        sendgridMail = require('@sendgrid/mail');
        sendgridMail.setApiKey(process.env.SENDGRID_API_KEY);
        if (String(process.env.SENDGRID_DATA_RESIDENCY || '').toLowerCase() === 'eu') {
            sendgridMail.setDataResidency('eu');
        }
        console.log('✅ SendGrid email provider configured');
    } catch (error) {
        console.log('⚠️ Failed to initialize SendGrid:', error.message);
        sendgridMail = null;
    }
} else if (isEmailConfigured()) {
    try {
        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: process.env.EMAIL_PORT || 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            },
            ...(process.env.EMAIL_FORCE_IPV4 === 'true'
                ? { family: 4 }
                : {}),
            tls: {
                rejectUnauthorized: false
            }
        });


        transporter.verify((error) => {
            if (error) {
                // Don't disable transporter on verify failure (often transient).
                console.log('⚠️ Email service configured but verify failed:', error.message);
            } else {
                console.log('✅ Email service is ready to send messages');
            }
        });
    } catch (error) {
        console.log('⚠️ Failed to initialize email service:', error.message);
        transporter = null;
    }
} else {
    console.log('📧 Email service not configured. Running in development mode with console logging.');
}

const getPrimaryFrontendUrl = () => {
    const raw = process.env.FRONTEND_URL || process.env.SITE_URL || 'https://welphub.onrender.com';
    const first = String(raw).split(',').map((part) => part.trim()).filter(Boolean)[0];
    return first || 'https://welphub.onrender.com';
};


// ── Review notification helpers ────────────────────────────────────────────────────────────
const BUSINESS_PLAN_TITLES = {
    free_tier: 'Free Tier',
    base: 'Base Plan',
    enhanced: 'Enhanced Plan',
    premium: 'Premium Plan'
};

const BUSINESS_PLAN_FEATURES = {
    free_tier: [
        '100 API calls per day',
        'Business profile access',
        'API keys included'
    ],
    base: [
        '1,000 API calls per day',
        'Business profile access',
        'Basic analytics overview'
    ],
    enhanced: [
        '3,000 API calls per day',
        'Expanded analytics and marketing insights',
        'Upload promotional media assets'
    ],
    premium: [
        '10,000 API calls per day',
        'Advanced behavioral analytics and email insights',
        'Advertise across competitor and partner pages'
    ]
};

const FALLBACK_BUSINESS_PRICING = [
    {
        tier: 'free_tier',
        label: BUSINESS_PLAN_TITLES.free_tier,
        priceLabel: 'Free',
        features: BUSINESS_PLAN_FEATURES.free_tier
    },
    {
        tier: 'base',
        label: BUSINESS_PLAN_TITLES.base,
        priceLabel: 'R1,000 / month',
        features: BUSINESS_PLAN_FEATURES.base
    },
    {
        tier: 'enhanced',
        label: BUSINESS_PLAN_TITLES.enhanced,
        priceLabel: 'R2,000 / month',
        features: BUSINESS_PLAN_FEATURES.enhanced
    },
    {
        tier: 'premium',
        label: BUSINESS_PLAN_TITLES.premium,
        priceLabel: 'R3,000 / month',
        features: BUSINESS_PLAN_FEATURES.premium
    }
];

const toArray = (value) => {
    if (value === null || value === undefined) return [];
    return Array.isArray(value) ? value : [value];
};

const numberWithCommas = (value) => {
    const num = Math.round(Number(value) || 0);
    return num.toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
};

const formatPriceLabel = (amount, symbol = 'R') => {
    if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
        return `${symbol}${amount || ''}`;
    }
    return `${symbol}${numberWithCommas(amount)} / month`;
};

const detectBusinessTier = (plan) => {
    const source = String(plan?.planTier || plan?.planCode || plan?.metadata?.planTier || '').toLowerCase();
    if (!source) return null;
    if (source.includes('premium') || source.includes('pro')) return 'premium';
    if (source.includes('enhanced') || source.includes('plus') || source.includes('growth')) return 'enhanced';
    if (source.includes('base') || source.includes('starter') || source.includes('core')) return 'base';
    return null;
};

const buildBusinessPricingOverview = async (countryCode = 'ZA') => {
    try {
        if (!getAudiencePricing) {
            ({ getAudiencePricing } = require('../services/pricingService'));
        }
        const result = await getAudiencePricing('business', { country: countryCode });
        if (!result || !Array.isArray(result.plans) || !result.plans.length) {
            throw new Error('No pricing catalog found for business audience');
        }
        const symbol = result.currency?.symbol || 'R';
        const entries = [];
        for (const plan of result.plans) {
            const tier = detectBusinessTier(plan);
            if (!tier || entries.some((entry) => entry.tier === tier)) continue;
            entries.push({
                tier,
                label: BUSINESS_PLAN_TITLES[tier] || plan.planTier || plan.planCode,
                priceLabel: formatPriceLabel(plan.amountMajor ?? plan.amount_minor / 100, symbol),
                features: BUSINESS_PLAN_FEATURES[tier] || BUSINESS_PLAN_FEATURES.base
            });
        }
        if (!entries.length) throw new Error('Unable to map catalog rows to tiers');
        const tierOrder = ['base', 'enhanced', 'premium'];
        return entries.sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier));
    } catch (error) {
        console.warn('Business pricing overview fallback used:', error.message);
        return FALLBACK_BUSINESS_PRICING;
    }
};

const buildReviewEmailHtml = ({
    type,
    companyName,
    rating,
    reviewContent,
    reviewDate,
    reviewerName,
    reviewLocation,
    reviewTypeLabel,
    reviewStage,
    dashboardUrl,
    respondUrl,
    claimUrl,
    pricingOverview = FALLBACK_BUSINESS_PRICING
}) => {
    const safeCompanyName = companyName || 'your business';
    const subjectLine = type === 'claimed'
        ? 'New feedback is waiting in your Welp dashboard'
        : 'A Welp review is live for your company';
    const headerColor = type === 'claimed' ? '#111827' : '#0f172a';
    const ctaLabel = type === 'claimed' ? 'Open Business Dashboard' : 'Claim Your Business Profile';
    const ctaLink = type === 'claimed' ? (dashboardUrl || respondUrl) : (claimUrl || dashboardUrl);
    const secondaryCta = type === 'claimed'
        ? `<a class="cta secondary" href="${respondUrl || dashboardUrl}" target="_blank" rel="noopener noreferrer">Respond to Review</a>`
        : '';
    const pricingCards = type === 'claimed'
        ? ''
        : `
        <div class="section">
            <h3>Business Subscription Pricing Overview</h3>
            <div class="pricing-grid">
                ${pricingOverview.map((plan) => `
                    <div class="pricing-card">
                        <p class="plan-title">${plan.label}</p>
                        <p class="plan-price">${plan.priceLabel}</p>
                        <ul>
                            ${plan.features.map((feature) => `<li>${feature}</li>`).join('')}
                        </ul>
                    </div>
                `).join('')}
            </div>
        </div>`;

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8" />
        <style>
            body { font-family: Arial, sans-serif; background:#f3f4f6; color:#111827; margin:0; padding:0; }
            .wrapper { max-width:640px; margin:0 auto; padding:24px; }
            .card { background:#ffffff; border-radius:16px; padding:32px; box-shadow:0 10px 30px rgba(15,23,42,0.08); }
            .header { text-align:center; padding-bottom:24px; border-bottom:1px solid #e5e7eb; }
            .header h1 { margin:0; color:${headerColor}; font-size:24px; }
            .section { margin-top:24px; }
            .section h3 { margin:0 0 8px 0; font-size:18px; color:#0f172a; }
            .details { background:#f9fafb; border-radius:12px; padding:16px; }
            .details p { margin:4px 0; }
            .cta { display:inline-block; margin:16px 8px 0 0; padding:12px 20px; border-radius:999px; text-decoration:none; font-weight:600; }
            .cta.primary { background:#4f46e5; color:#ffffff; }
            .cta.secondary { background:#e0e7ff; color:#4338ca; }
            .pricing-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:16px; }
            .pricing-card { border:1px solid #e5e7eb; border-radius:12px; padding:16px; background:#fdfdfd; }
            .plan-title { font-weight:600; margin:4px 0; }
            .plan-price { font-size:18px; margin:4px 0 12px 0; color:#0f172a; }
            ul { padding-left:18px; margin:0; }
            footer { margin-top:32px; font-size:12px; color:#6b7280; text-align:center; }
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="card">
                <div class="header">
                    <h1>${subjectLine}</h1>
                    <p>${safeCompanyName}</p>
                </div>
                <div class="section">
                    <h3>Review Details</h3>
                    <div class="details">
                        <p><strong>Rating:</strong> ${rating ?? 'N/A'} / 5</p>
                        <p><strong>Review Type:</strong> ${reviewTypeLabel || 'Company Review'}</p>
                        ${reviewStage ? `<p><strong>Stage:</strong> ${reviewStage}</p>` : ''}
                        <p><strong>Reviewer:</strong> ${reviewerName || 'Anonymous reviewer'}</p>
                        <p><strong>Location:</strong> ${reviewLocation || 'Not specified'}</p>
                        <p><strong>Date:</strong> ${reviewDate || 'Today'}</p>
                        <p style="margin-top:12px;"><strong>Feedback:</strong></p>
                        <p>${reviewContent || 'No review text supplied.'}</p>
                    </div>
                </div>
                <div class="section">
                    <p>${type === 'claimed'
                        ? 'Reply to reviews promptly to improve trust and keep your analytics current.'
                        : 'Claim your Welp profile to respond, unlock analytics, and manage advertising placements.'}
                    </p>
                    ${ctaLink ? `<a class="cta primary" href="${ctaLink}" target="_blank" rel="noopener noreferrer">${ctaLabel}</a>` : ''}
                    ${secondaryCta}
                </div>
                ${pricingCards}
                <footer>
                    <p>Need help? Email support@welp.co.za or manage your notification preferences in the admin dashboard.</p>
                    <p>&copy; ${new Date().getFullYear()} Welp</p>
                </footer>
            </div>
        </div>
    </body>
    </html>
    `;
};

const buildReviewEmailText = (payload, pricingOverview = FALLBACK_BUSINESS_PRICING) => {
    const lines = [
        `Company: ${payload.companyName || 'your business'}`,
        `Rating: ${payload.rating ?? 'N/A'} / 5`,
        `Review Type: ${payload.reviewTypeLabel || 'Company Review'}`,
        payload.reviewStage ? `Stage: ${payload.reviewStage}` : null,
        `Reviewer: ${payload.reviewerName || 'Anonymous reviewer'}`,
        `Location: ${payload.reviewLocation || 'Not specified'}`,
        `Date: ${payload.reviewDate || 'Today'}`,
        '',
        `Review: ${payload.reviewContent || 'No review text supplied.'}`,
        ''
    ].filter(Boolean);
    if (payload.type === 'claimed') {
        if (payload.dashboardUrl) lines.push(`Open dashboard: ${payload.dashboardUrl}`);
        if (payload.respondUrl) lines.push(`Respond to review: ${payload.respondUrl}`);
    } else {
        if (payload.claimUrl) lines.push(`Claim profile: ${payload.claimUrl}`);
        lines.push('', 'Business Subscription Pricing:');
        pricingOverview.forEach((plan) => {
            lines.push(`- ${plan.label}: ${plan.priceLabel}`);
        });
    }
    lines.push('', 'You are receiving this email because a new review was posted on Welp.');
    return lines.join('\n');
};

const sendReviewNotificationEmail = async (payload = {}) => {
    const to = toArray(payload.to).filter(Boolean);
    const cc = toArray(payload.cc).filter(Boolean);
    if (!to.length) {
        return { success: false, error: 'No recipient provided' };
    }

    const type = payload.type === 'claimed' ? 'claimed' : 'unclaimed';
    let pricingOverview = FALLBACK_BUSINESS_PRICING;
    if (type !== 'claimed') {
        pricingOverview = await buildBusinessPricingOverview(payload.companyCountry || 'ZA');
    }

    const subject = type === 'claimed'
        ? 'New Review Submitted for Your Business'
        : 'A Review Has Been Posted About Your Company';
    const html = buildReviewEmailHtml({
        ...payload,
        type,
        pricingOverview
    });
    const text = buildReviewEmailText({ ...payload, type }, pricingOverview);

    if (!transporter) {
        console.log('\n=== REVIEW NOTIFICATION (DEV MODE) ===');
        console.log(`To: ${to.join(', ')}`);
        if (cc.length) console.log(`CC: ${cc.join(', ')}`);
        console.log(`Subject: ${subject}`);
        console.log(text.slice(0, 280));
        console.log('======================================\n');
        return { success: true, subject, devMode: true };
    }

    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to,
            cc: cc.length ? cc : undefined,
            subject,
            html,
            text
        });
        return { success: true, info, subject };
    } catch (error) {
        console.error('❌ Failed to send review notification email:', error.message);
        return { success: false, error: error.message, subject };
    }
};

const sendDailyReviewReminderEmail = async (payload = {}) => {
    const to = toArray(payload.to).filter(Boolean);
    if (!to.length) {
        return { success: false, error: 'No recipient provided' };
    }

    const subject = payload.subject || 'Reminder: Share today’s work experience';
    const companyName = payload.companyName || 'your workplace';
    const checklistUrl = payload.checklistUrl || payload.dashboardUrl || (process.env.FRONTEND_URL || 'http://localhost:5173') + '/dashboard';
    const html = `
    <html>
    <body style="font-family: Arial, sans-serif; background:#f3f4f6; color:#111827; padding:24px;">
        <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
            <h2 style="margin-top:0;">Daily work review reminder</h2>
            <p>Help ${companyName} improve by sharing today’s work experience.</p>
            <p style="margin:16px 0;">
                <a href="${checklistUrl}" style="display:inline-block;padding:12px 20px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:999px;font-weight:600;">
                    Open Daily Review Checklist
                </a>
            </p>
            <p style="color:#6b7280;font-size:13px;">If you already submitted today, thank you!</p>
        </div>
    </body>
    </html>`;

    const text = `Daily work review reminder\n\nShare today’s work experience for ${companyName}.\nOpen checklist: ${checklistUrl}\n\nIf you already submitted today, thank you!`;

    if (!transporter) {
        console.log('\n=== DAILY REVIEW REMINDER (DEV MODE) ===');
        console.log(`To: ${to.join(', ')}`);
        console.log(`Subject: ${subject}`);
        console.log(text);
        console.log('========================================\n');
        return { success: true, subject, devMode: true };
    }

    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to,
            subject,
            html,
            text
        });
        return { success: true, info, subject };
    } catch (error) {
        console.error('❌ Failed to send daily review reminder:', error.message);
        return { success: false, error: error.message, subject };
    }
};

const sendClaimInvitation = async (companyEmail, companyName, companyId) => {
    const claimLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/claim/${companyId}`;
    if (!transporter) {
        console.log('\n=== EMAIL NOTIFICATION (DEV MODE) ===');
        console.log(`To: ${companyEmail}`);
        console.log(`Subject: Claim ${companyName} on Welp`);
        console.log(`Claim Link: ${claimLink}`);
        console.log('=====================================\n');
        return { success: true, devMode: true };
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: companyEmail,
        subject: `Claim ${companyName} on Welp`,
        html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { padding: 30px; background: #f9f9f9; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; text-decoration: none; border-radius: 30px; margin: 20px 0; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>Welp Business Verification</h1></div>
            <div class="content">
              <h2>Claim Your Business on Welp</h2>
              <p>Hello,</p>
              <p>Your company <strong>${companyName}</strong> has been listed on Welp - the employee wellbeing review platform.</p>
              <p>To claim your company profile and start managing reviews, click the button below:</p>
              <div style="text-align: center;">
                <a href="${claimLink}" class="button">Claim ${companyName}</a>
              </div>
              <p>If you didn't expect this email, please ignore it.</p>
              <p>Best regards,<br>The Welp Team</p>
            </div>
            <div class="footer"><p>&copy; ${new Date().getFullYear()} Welp. All rights reserved.</p></div>
          </div>
        </body>
        </html>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Claim invitation email sent to:', companyEmail);
        return { success: true, info };
    } catch (error) {
        console.error('❌ Failed to send email:', error.message);
        return { success: true, devMode: true };
    }
};


const sendVerificationEmail = async (email, code) => {
    if (!transporter) {
        console.log('\n=== VERIFICATION EMAIL (DEV MODE) ===');
        console.log(`To: ${email}`);
        console.log(`Verification code: ${code}`);
        console.log('=====================================\n');
        return { success: true, devMode: true };
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Verify Your Email - Welp',
        html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { padding: 30px; background: #f9f9f9; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px; }
            .code { font-size: 36px; font-weight: bold; color: #667eea; text-align: center; padding: 20px; background: #fff; border-radius: 10px; margin: 20px 0; letter-spacing: 5px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>Welp Email Verification</h1></div>
            <div class="content">
              <h2>Verify Your Email</h2>
              <p>Use the following verification code to complete your request:</p>
              <div class="code">${code}</div>
              <p>This code will expire in 10 minutes.</p>
              <p>If you didn't request this, please ignore this email.</p>
              <p>Best regards,<br>The Welp Team</p>
            </div>
            <div class="footer"><p>&copy; ${new Date().getFullYear()} Welp. All rights reserved.</p></div>
          </div>
        </body>
        </html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Verification email sent to:', email);
        return { success: true };
    } catch (error) {
        console.error('❌ Failed to send verification email:', error.message);
        return { success: true, devMode: true };
    }
};


const sendApplicationConfirmation = async (email, name) => {
    if (!transporter) {
        console.log('\n=== APPLICATION CONFIRMATION (DEV MODE) ===');
        console.log(`To: ${email}`);
        console.log(`Name: ${name}`);
        console.log('============================================\n');
        return { success: true, devMode: true };
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Psychologist Application Received - Welp',
        html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { padding: 30px; background: #f9f9f9; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header"><h1>Application Received!</h1></div>
            <div class="content">
              <h2>Thank you for applying, ${name}!</h2>
              <p>We have received your application to become a verified psychologist on Welp.</p>
              <p>Our team will review your credentials and get back to you within 3-5 business days.</p>
              <p>If you have any questions, please contact us at support@welp.com</p>
              <p>Best regards,<br>The Welp Team</p>
            </div>
            <div class="footer"><p>&copy; ${new Date().getFullYear()} Welp. All rights reserved.</p></div>
          </div>
        </body>
        </html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Application confirmation email sent to:', email);
        return { success: true };
    } catch (error) {
        console.error('❌ Failed to send confirmation email:', error.message);
        return { success: true, devMode: true };
    }
};


const sendKYCApprovalEmail = async (email, companyName, status = 'approved') => {
    if (!transporter) {
        console.log('\n=== KYC EMAIL (DEV MODE) ===');
        console.log(`To: ${email}`);
        console.log(`Subject: KYC Application ${status} - ${companyName}`);
        console.log('=====================================\n');
        return { success: true, devMode: true };
    }

    const isApproved = status === 'approved';
    const subject = isApproved
        ? `✅ Your KYC Application for ${companyName} is Approved!`
        : `📝 KYC Application Received - ${companyName}`;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject,
        html: `
        <!DOCTYPE html>
        <html>
        <body>
            <h1>${isApproved ? 'KYC Approved' : 'KYC Received'} - ${companyName}</h1>
            <p>Status: ${status}</p>
        </body>
        </html>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`✅ KYC ${status} email sent to:`, email);
        return { success: true, info };
    } catch (error) {
        console.error('❌ Failed to send KYC email:', error.message);
        return { success: false, error: error.message };
    }
};


const sendKYCRejectionEmail = async (email, companyName, reason) => {
    if (!transporter) {
        console.log('\n=== KYC REJECTION EMAIL (DEV MODE) ===');
        console.log(`To: ${email}`);
        console.log(`Subject: KYC Application Update - ${companyName}`);
        console.log(`Reason: ${reason || 'Documents require clarification'}`);
        console.log('=====================================\n');
        return { success: true, devMode: true };
    }

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `📋 Action Required: KYC Application for ${companyName}`,
        html: `
        <!DOCTYPE html>
        <html>
        <body>
            <h1>KYC Action Required - ${companyName}</h1>
            <p>Reason: ${reason || 'Documents require clarification'}</p>
        </body>
        </html>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ KYC rejection email sent to:', email);
        return { success: true, info };
    } catch (error) {
        console.error('❌ Failed to send KYC rejection email:', error.message);
        return { success: false, error: error.message };
    }
};

const getEmailProviderStatus = () => ({
    provider: sendgridMail ? 'sendgrid' : transporter ? 'smtp' : 'none',
    sendgridConfigured: Boolean(sendgridMail),
    smtpConfigured: Boolean(transporter),
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || null
});

const sendEmail = async ({ to, subject, html, text }) => {
    if (sendgridMail) {
        try {
            const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
            await sendgridMail.send({
                to,
                from,
                subject,
                text,
                html
            });
            return { success: true, provider: 'sendgrid' };
        } catch (error) {
            console.error('❌ Failed to send SendGrid email:', error.message);
            return { success: false, error: error.message };
        }
    }

    if (!transporter) {
        console.log('\n=== EMAIL NOTIFICATION (DEV MODE) ===');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        if (text) console.log(`Text: ${text}`);
        if (html) console.log(`HTML length: ${html.length}`);
        console.log('=====================================\n');
        return { success: true, devMode: true };
    }

    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to,
            subject,
            html,
            text
        });
        return { success: true, info };
    } catch (error) {
        console.error('❌ Failed to send email:', error.message);
        return { success: false, error: error.message };
    }
};

const formatPlanLabel = (plan = '') => {
    if (!plan) return 'your Welp subscription';
    return plan.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const APPLICATION_STATUS_LABELS = {
    pending_review: 'Pending Review',
    under_verification: 'Under Verification',
    awaiting_information: 'Additional Information Required',
    approved: 'Approved',
    rejected: 'Rejected'
};

const sendSubscriptionCancellationEmail = async ({ email, name, previousPlan, ownerType }) => {
    if (!email) {
        console.log('No recipient email provided for subscription cancellation notice');
        return { success: false, reason: 'missing-email' };
    }
    const planLabel = formatPlanLabel(previousPlan);
    const greeting = name ? `Hi ${name}` : 'Hello';
    const subject = 'Your Welp subscription has been cancelled';
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 520px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb; }
            .cta { display: inline-block; margin-top: 18px; padding: 10px 18px; background: #4f46e5; color: #fff; border-radius: 999px; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <p>${greeting},</p>
            <p>We've confirmed your request to cancel ${planLabel}. Your account is now on the Welp free tier${ownerType ? ` for your ${ownerType} workspace` : ''}.</p>
            <p>You can upgrade again at any time to regain premium analytics, extended messaging limits, and advertising tools.</p>
            <p>If you didn't authorize this change or need help, reply to this email and we'll assist you.</p>
            <p>- The Welp Team</p>
            <a class="cta" href="${process.env.FRONTEND_URL || 'https://welphub.onrender.com'}/pricing">Compare plans</a>
          </div>
        </body>
        </html>
    `;
    const text = `${greeting},

We've confirmed your request to cancel ${planLabel}. Your account is now on the Welp free tier${ownerType ? ` for your ${ownerType} workspace` : ''}. You can upgrade again anytime from the pricing page.`;
    if (!transporter) {
        console.log('\n=== SUBSCRIPTION CANCELLATION (DEV MODE) ===');
        console.log(`To: ${email}`);
        console.log(`Subject: ${subject}`);
        console.log(text);
        console.log('===========================================\n');
        return { success: true, devMode: true };
    }
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject,
            html,
            text: text.replace(/\s+/g, ' ').trim()
        });
        return { success: true };
    } catch (error) {
        console.error('Failed to send cancellation email:', error.message);
        return { success: false, error: error.message };
    }
};

const sendMarketingEmail = async ({ to, subject, html, text }) => {
    return sendEmail({ to, subject, html, text });
};

const formatApplicationTypeLabel = (type) => type === 'business' ? 'business claim' : 'psychologist application';

const sendApplicationStatusEmail = async ({ email, name, type, status, notes }) => {
    if (!email) return { success: false, reason: 'missing-email' };
    const normalizedStatus = APPLICATION_STATUS_LABELS[status] || status;
    const greeting = name ? `Hi ${name}` : 'Hello';
    const typeLabel = formatApplicationTypeLabel(type);
    const subjectByStatus = {
        approved: `Your ${typeLabel} has been approved`,
        rejected: `Update on your ${typeLabel}`,
        awaiting_information: `More information needed for your ${typeLabel}`
    };
    const subject = subjectByStatus[status] || `Status updated for your ${typeLabel}`;
    const statusMessage = status === 'approved'
        ? 'We have completed our review and unlocked full access to your dashboard.'
        : status === 'rejected'
            ? 'After reviewing your documents we were unable to approve this submission.'
            : 'We need a little more information to complete your verification.';

    const actionLine = status === 'awaiting_information'
        ? 'Please reply to this email with the requested documents or upload them from your dashboard.'
        : status === 'approved'
            ? 'You can now log in to Welp and start using all features immediately.'
            : 'You are welcome to re-apply once the outstanding items are resolved.';

    const detailBlock = notes
        ? `<p style="margin:16px 0;padding:12px 16px;background:#f5f5f5;border-radius:8px;"><strong>Reviewer notes:</strong><br>${notes}</p>`
        : '';

    const html = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
          <div style="max-width: 560px; margin: 0 auto; padding: 24px;">
            <p>${greeting},</p>
            <p>The status of your ${typeLabel} is now <strong>${normalizedStatus}</strong>.</p>
            <p>${statusMessage}</p>
            ${detailBlock}
            <p>${actionLine}</p>
            <p style="margin-top:24px;">— The Welp Compliance Team</p>
          </div>
        </body>
        </html>
    `;
    const text = `${greeting},

The status of your ${typeLabel} is now ${normalizedStatus}. ${statusMessage} ${notes ? `Notes: ${notes}.` : ''} ${actionLine}`;

    if (!transporter) {
        console.log('\n=== APPLICATION STATUS (DEV MODE) ===');
        console.log(`To: ${email}`);
        console.log(`Subject: ${subject}`);
        console.log(text);
        console.log('=====================================\n');
        return { success: true, devMode: true };
    }

    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject,
            html,
            text
        });
        return { success: true };
    } catch (error) {
        console.error('Failed to send application status email:', error.message);
        return { success: false, error: error.message };
    }
};

async function sendMessageNotificationEmail({ senderName, receiverName, receiverEmail, conversationId }) {
    if (!receiverEmail) return { success: false, reason: 'missing-email' };
    const greeting = receiverName ? `Hi ${receiverName}` : 'Hi there';
    const subject = `New message from ${senderName || 'a Welp user'}`;
    const baseUrl = getPrimaryFrontendUrl();
    const redirectPath = `/messages?conversation=${conversationId}`;
    const loginUrl = `${baseUrl}/login?redirect=${encodeURIComponent(redirectPath)}`;
    const html = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <div style="max-width: 560px; margin: 0 auto; padding: 24px;">
            <p>${greeting},</p>
            <p>You have received a new message from <strong>${senderName || 'a Welp user'}</strong>.</p>
            <p style="margin: 20px 0;">
              <a href="${loginUrl}" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 10px 18px; border-radius: 999px; text-decoration: none;">
                Login &amp; continue the chat
              </a>
            </p>
            <p>If you did not expect this, you can safely ignore this message.</p>
            <p style="margin-top: 24px;">— The Welp Team</p>
          </div>
        </body>
        </html>
    `;
    const text = `${greeting},

You have received a new message from ${senderName || 'a Welp user'}.

Login to continue the chat: ${loginUrl}

— The Welp Team`;

    return sendEmail({ to: receiverEmail, subject, html, text });
}

async function sendConversationRequestEmail({ senderName, receiverName, receiverEmail, conversationId }) {
    if (!receiverEmail) return { success: false, reason: 'missing-email' };
    const greeting = receiverName ? `Hi ${receiverName}` : 'Hi there';
    const subject = `New chat request from ${senderName || 'a Welp user'}`;
    const baseUrl = getPrimaryFrontendUrl();
    const redirectPath = `/messages?conversation=${conversationId}`;
    const loginUrl = `${baseUrl}/login?redirect=${encodeURIComponent(redirectPath)}`;

    const html = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <div style="max-width: 560px; margin: 0 auto; padding: 24px;">
            <p>${greeting},</p>
            <p><strong>${senderName || 'A Welp user'}</strong> sent you a chat request.</p>
            <p style="margin: 20px 0;">
              <a href="${loginUrl}" style="display: inline-block; background: #0ea5e9; color: #ffffff; padding: 10px 18px; border-radius: 999px; text-decoration: none;">
                Review request
              </a>
            </p>
            <p style="margin-top: 24px;">— The Welp Team</p>
          </div>
        </body>
        </html>
    `;

    const text = `${greeting},

${senderName || 'A Welp user'} sent you a chat request.

Review request: ${loginUrl}

— The Welp Team`;

    return sendEmail({ to: receiverEmail, subject, html, text });
}

async function sendConversationAcceptedEmail({ senderName, receiverName, receiverEmail, conversationId }) {
    if (!receiverEmail) return { success: false, reason: 'missing-email' };
    const greeting = receiverName ? `Hi ${receiverName}` : 'Hi there';
    const subject = `Chat request accepted by ${senderName || 'a Welp user'}`;
    const baseUrl = getPrimaryFrontendUrl();
    const redirectPath = `/messages?conversation=${conversationId}`;
    const loginUrl = `${baseUrl}/login?redirect=${encodeURIComponent(redirectPath)}`;

    const html = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <div style="max-width: 560px; margin: 0 auto; padding: 24px;">
            <p>${greeting},</p>
            <p>Your chat request was accepted by <strong>${senderName || 'a Welp user'}</strong>.</p>
            <p style="margin: 20px 0;">
              <a href="${loginUrl}" style="display: inline-block; background: #22c55e; color: #ffffff; padding: 10px 18px; border-radius: 999px; text-decoration: none;">
                Open chat
              </a>
            </p>
            <p style="margin-top: 24px;">— The Welp Team</p>
          </div>
        </body>
        </html>
    `;

    const text = `${greeting},

Your chat request was accepted by ${senderName || 'a Welp user'}.

Open chat: ${loginUrl}

— The Welp Team`;

    return sendEmail({ to: receiverEmail, subject, html, text });
}

async function sendTicketNotificationEmail({ receiverEmail, receiverName, ticketNumber, ticketTitle, ticketStatus, ticketId }) {
    if (!receiverEmail) return { success: false, reason: 'missing-email' };
    const greeting = receiverName ? `Hi ${receiverName}` : 'Hi there';
    const subject = `Ticket ${ticketNumber}: ${ticketTitle}`;
    const baseUrl = process.env.FRONTEND_URL || process.env.SITE_URL || 'https://welphub.onrender.com';
    const redirectPath = `/tickets?ticket=${ticketId}`;
    const loginUrl = `${baseUrl}/login?redirect=${encodeURIComponent(redirectPath)}`;
    const html = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <div style="max-width: 560px; margin: 0 auto; padding: 24px;">
            <p>${greeting},</p>
            <p>Your ticket <strong>${ticketNumber}</strong> is now <strong>${ticketStatus}</strong>.</p>
            <p><strong>${ticketTitle}</strong></p>
            <p style="margin: 20px 0;">
              <a href="${loginUrl}" style="display: inline-block; background: #0ea5e9; color: #ffffff; padding: 10px 18px; border-radius: 999px; text-decoration: none;">
                View ticket
              </a>
            </p>
            <p>Need to add more details? Reply inside your ticket thread.</p>
            <p style="margin-top: 24px;">— The Welp Support Team</p>
          </div>
        </body>
        </html>
    `;
    const text = `${greeting},

Your ticket ${ticketNumber} is now ${ticketStatus}.

${ticketTitle}

View ticket: ${loginUrl}

— The Welp Support Team`;

    return sendEmail({ to: receiverEmail, subject, html, text });
}

const buildPermissionList = (permissions = {}) => {
    const entries = [
        ['Can view', Boolean(permissions.canView)],
        ['Can edit', Boolean(permissions.canEdit)],
        ['Can use', Boolean(permissions.canUse)]
    ];
    return entries.map(([label, value]) => `<li>${label}: ${value ? 'Yes' : 'No'}</li>`).join('');
};

const sendAppAccessEmail = async ({ to, name, appName, loginUrl, pageUrl, pageName, permissions }) => {
    if (!to || !appName) {
        return { success: false, error: 'Missing recipient or app label' };
    }
    const greeting = name ? `Hi ${name}` : 'Hello';
    const subject = `Access granted to ${appName} on Kodi Builder`;
    const html = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <div style="max-width: 560px; margin: 0 auto; padding: 24px;">
            <h2>${greeting},</h2>
            <p>You've been granted access to <strong>${appName}</strong> inside the Kodi Builder.</p>
            <p>
              <a href="${loginUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 18px; border-radius: 999px; text-decoration: none;">
                Log in to Kodi Builder
              </a>
            </p>
              ${pageUrl ? `<p><a href="${pageUrl}">Open the assigned page${pageName ? ` (${pageName})` : ''}</a></p>` : ''}
            <div style="margin-top: 16px;">
              <p><strong>Permissions:</strong></p>
              <ul>${buildPermissionList(permissions)}</ul>
            </div>
            <p style="margin-top: 24px;">If you did not expect this access, contact your administrator.</p>
            <p>— The Kodi Builder Team</p>
          </div>
        </body>
        </html>
    `;
    const textLines = [
        `${greeting},`,
        '',
        `You've been granted access to ${appName} inside the Kodi Builder.`,
        loginUrl ? `Log in: ${loginUrl}` : '',
          pageUrl ? `Assigned page: ${pageName ? `${pageName} - ` : ''}${pageUrl}` : '',
        '',
        'Permissions:',
        `- Can view: ${Boolean(permissions.canView) ? 'Yes' : 'No'}`,
        `- Can edit: ${Boolean(permissions.canEdit) ? 'Yes' : 'No'}`,
        `- Can use: ${Boolean(permissions.canUse) ? 'Yes' : 'No'}`,
        '',
        'If you did not expect this access, contact your administrator.',
        '— The Kodi Builder Team'
    ];
    const text = textLines.filter(Boolean).join('\n');
    return sendEmail({ to, subject, html, text });
};

const sendKodiAppInviteEmail = async ({ to, name, appName, role, loginUrl, inviteUrl, pageUrl, pageName, username, otp }) => {
    if (!to || !appName || !inviteUrl) {
        return { success: false, error: 'Missing invitation details' };
    }
    const greeting = name ? `Hi ${name}` : 'Hello';
    const subject = `Invitation to ${appName}`;
    const html = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <div style="max-width: 560px; margin: 0 auto; padding: 24px;">
            <h2>${greeting},</h2>
            <p>You have been invited to the <strong>${appName}</strong> app in Kodi Portal.</p>
            <p><strong>Role:</strong> ${role || 'member'}</p>
            <p><strong>Username:</strong> ${username || 'assigned separately'}</p>
            <p><strong>One-time password:</strong> ${otp || 'available in your invite'}</p>
            <p>
              <a href="${inviteUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 18px; border-radius: 999px; text-decoration: none;">
                Sign in to Kodi
              </a>
            </p>
            ${pageUrl ? `<p>Default page: <a href="${pageUrl}">${pageName || 'Open page'}</a></p>` : ''}
            <p>Login: ${loginUrl}</p>
            <p style="margin-top: 24px;">If you did not expect this invitation, ignore this email.</p>
            <p>— The Kodi Portal Team</p>
          </div>
        </body>
        </html>
    `;
    const text = [
        `${greeting},`,
        '',
        `You have been invited to ${appName}.`,
        `Role: ${role || 'member'}`,
        username ? `Username: ${username}` : '',
        otp ? `One-time password: ${otp}` : '',
        `Sign in: ${inviteUrl}`,
        loginUrl ? `Login: ${loginUrl}` : '',
        pageUrl ? `Default page: ${pageName || 'Open page'} - ${pageUrl}` : '',
        '',
        '— The Kodi Portal Team'
    ].filter(Boolean).join('\n');
    return sendEmail({ to, subject, html, text });
};

const sendKodiRoleUpdatedEmail = async ({ to, name, appName, role, loginUrl }) => {
    if (!to || !appName) {
        return { success: false, error: 'Missing recipient or app name' };
    }
    const greeting = name ? `Hi ${name}` : 'Hello';
    const subject = `Role updated in ${appName}`;
    const html = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <div style="max-width: 560px; margin: 0 auto; padding: 24px;">
            <h2>${greeting},</h2>
            <p>Your role in <strong>${appName}</strong> has been updated.</p>
            <p><strong>New role:</strong> ${role || 'member'}</p>
            <p>Login: <a href="${loginUrl}">${loginUrl}</a></p>
            <p>— The Kodi Portal Team</p>
          </div>
        </body>
        </html>
    `;
    const text = [
        `${greeting},`,
        '',
        `Your role in ${appName} has been updated.`,
        `New role: ${role || 'member'}`,
        loginUrl ? `Login: ${loginUrl}` : '',
        '',
        '— The Kodi Portal Team'
    ].filter(Boolean).join('\n');
    return sendEmail({ to, subject, html, text });
};

const sendKodiPageAssignedEmail = async ({ to, name, appName, pageName, pageUrl, loginUrl }) => {
    if (!to || !appName || !pageName) {
        return { success: false, error: 'Missing recipient or page details' };
    }
    const greeting = name ? `Hi ${name}` : 'Hello';
    const subject = `New page assigned in ${appName}`;
    const html = `
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
          <div style="max-width: 560px; margin: 0 auto; padding: 24px;">
            <h2>${greeting},</h2>
            <p>A new page has been assigned in <strong>${appName}</strong>.</p>
            <p><strong>Page:</strong> ${pageName}</p>
            ${pageUrl ? `<p>Open: <a href="${pageUrl}">${pageUrl}</a></p>` : ''}
            <p>Login: <a href="${loginUrl}">${loginUrl}</a></p>
            <p>— The Kodi Portal Team</p>
          </div>
        </body>
        </html>
    `;
    const text = [
        `${greeting},`,
        '',
        `A new page has been assigned in ${appName}.`,
        `Page: ${pageName}`,
        pageUrl ? `Open: ${pageUrl}` : '',
        loginUrl ? `Login: ${loginUrl}` : '',
        '',
        '— The Kodi Portal Team'
    ].filter(Boolean).join('\n');
    return sendEmail({ to, subject, html, text });
};

module.exports = {
    sendClaimInvitation,
    sendVerificationEmail,
    sendApplicationConfirmation,
    sendKYCApprovalEmail,
    sendKYCRejectionEmail,
    sendEmail,
    getEmailProviderStatus,
    sendMarketingEmail,
    sendSubscriptionCancellationEmail,
    sendApplicationStatusEmail,
    sendReviewNotificationEmail,
    sendDailyReviewReminderEmail,
    sendMessageNotificationEmail,
    sendConversationRequestEmail,
    sendConversationAcceptedEmail,
    sendTicketNotificationEmail,
    sendAppAccessEmail,
    sendKodiAppInviteEmail,
    sendKodiRoleUpdatedEmail,
    sendKodiPageAssignedEmail
};
