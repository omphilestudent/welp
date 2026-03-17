const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: { rejectUnauthorized: false }
});

(async () => {
  const result = await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: 'omphilestudent@gmail.com',
    subject: 'Welp SMTP test',
    text: 'This is a test email from Welp backend SMTP configuration.',
    html: '<p>This is a test email from Welp backend SMTP configuration.</p>'
  });
  console.log({ success: true, messageId: result.messageId });
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
