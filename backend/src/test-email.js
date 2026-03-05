
const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmail() {
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    try {
        await transporter.verify();
        console.log('✅ Email configuration is valid!');


        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: 'Test Email from Welp',
            text: 'If you receive this, your email configuration is working!'
        });
        console.log('✅ Test email sent:', info.messageId);
    } catch (error) {
        console.error('❌ Email error:', error.message);
    }
}

testEmail();