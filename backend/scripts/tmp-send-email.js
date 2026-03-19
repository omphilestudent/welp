const { sendEmail } = require('../src/utils/emailService');
sendEmail({
  to: 'omphile.mohlala@umuzi.org',
  subject: 'Kodi Test Email',
  text: 'This is a test email from Kodi via SendGrid/SMTP.',
  html: '<p>This is a test email from Kodi via SendGrid/SMTP.</p>'
}).then((r) => {
  console.log(r);
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
