// backend/src/utils/emailService.js
const nodemailer = require('nodemailer');
require('dotenv').config();

// Check if email is configured
const isEmailConfigured = () => {
    return process.env.EMAIL_USER &&
        process.env.EMAIL_PASSWORD &&
        process.env.EMAIL_USER !== '' &&
        process.env.EMAIL_PASSWORD !== '';
};

// Create transporter only if configured
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

        // Verify connection
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

// Send claim invitation
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

// Send verification email
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

// Send application confirmation
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

// New KYC approval email
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

// New KYC rejection email
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

module.exports = {
    sendClaimInvitation,
    sendVerificationEmail,
    sendApplicationConfirmation,
    sendKYCApprovalEmail,
    sendKYCRejectionEmail
};