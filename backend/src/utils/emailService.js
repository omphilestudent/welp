
const nodemailer = require('nodemailer');
require('dotenv').config();


const isEmailConfigured = () => {
    return process.env.EMAIL_USER &&
        process.env.EMAIL_PASSWORD &&
        process.env.EMAIL_USER !== '' &&
        process.env.EMAIL_PASSWORD !== '';
};


let transporter = null;
if (isEmailConfigured()) {
    try {
        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: process.env.EMAIL_PORT || 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            },
            tls: {
                rejectUnauthorized: false
            }
        });


        transporter.verify((error) => {
            if (error) {
                console.log('⚠️ Email service configured but not working:', error.message);
                transporter = null;
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

const sendEmail = async ({ to, subject, html, text }) => {
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

module.exports = {
    sendClaimInvitation,
    sendVerificationEmail,
    sendApplicationConfirmation,
    sendKYCApprovalEmail,
    sendKYCRejectionEmail,
    sendEmail,
    sendMarketingEmail,
    sendSubscriptionCancellationEmail,
    sendApplicationStatusEmail
};
