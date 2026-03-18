const { sendEmail } = require('../../utils/emailService');
const { renderTemplate } = require('./marketing.templates');

const buildLogoUrl = () => {
    const base = process.env.FRONTEND_URL || process.env.SITE_URL || 'https://welphub.onrender.com';
    return `${base.replace(/\/$/, '')}/logo-1.png`;
};

const wrapBrandedHtml = ({ html, preheader }) => {
    const logoUrl = buildLogoUrl();
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin:0; padding:0; background:#f8fafc; font-family: Arial, sans-serif; color:#0f172a; }
    .container { max-width:640px; margin:0 auto; padding:24px; }
    .card { background:#ffffff; border-radius:16px; padding:24px; border:1px solid #e2e8f0; }
    .logo { width:140px; margin-bottom:16px; }
    .preheader { display:none; max-height:0; overflow:hidden; color:#f8fafc; opacity:0; }
    .cta { display:inline-block; padding:10px 18px; background:#2563eb; color:#ffffff !important; border-radius:999px; text-decoration:none; font-weight:600; }
    .footer { margin-top:24px; font-size:12px; color:#64748b; text-align:center; }
  </style>
</head>
<body>
  <div class="preheader">${preheader || ''}</div>
  <div class="container">
    <div class="card">
      <img class="logo" src="${logoUrl}" alt="Welp logo" />
      ${html}
    </div>
    <div class="footer">
      <p>Need help? Reply to this email or contact support.</p>
    </div>
  </div>
</body>
</html>
    `;
};

const sendTemplatedEmail = async ({ template, to, variables, metadata }) => {
    const rendered = renderTemplate(template, variables);
    const html = wrapBrandedHtml({ html: rendered.html, preheader: rendered.preheader });
    const text = rendered.text || rendered.html?.replace(/<[^>]+>/g, '') || '';
    const subject = rendered.subject || template.subject || 'Welp update';
    const result = await sendEmail({ to, subject, html, text, metadata });
    return { result, subject, html, text };
};

module.exports = {
    sendTemplatedEmail,
    wrapBrandedHtml
};
