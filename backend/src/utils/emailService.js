// backend/src/utils/emailService.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

const sendClaimInvitation = async (companyEmail, companyName, companyId) => {
    const claimLink = `${process.env.FRONTEND_URL}/claim/${companyId}`;

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
          .header { background: #000; color: #fff; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { 
            display: inline-block; 
            padding: 10px 20px; 
            background: #000; 
            color: #fff; 
            text-decoration: none; 
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer { text-align: center; padding: 20px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welp</h1>
          </div>
          <div class="content">
            <h2>Your Company Has Been Listed on Welp</h2>
            <p>Hello,</p>
            <p>Your company <strong>${companyName}</strong> has been listed on Welp - the employee wellbeing review platform.</p>
            <p>To claim your company profile and start managing reviews, click the button below:</p>
            <div style="text-align: center;">
              <a href="${claimLink}" class="button">Claim ${companyName}</a>
            </div>
            <p>If you didn't expect this email, please ignore it.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Welp. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Claim invitation email sent to:', companyEmail);
    } catch (error) {
        console.error('Failed to send email:', error);
    }
};

module.exports = { sendClaimInvitation };