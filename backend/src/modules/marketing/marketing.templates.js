const TEMPLATE_VARIABLES = [
    'first_name',
    'full_name',
    'product_name',
    'subscription_name',
    'company_name',
    'review_count',
    'register_link',
    'chat_link',
    'sender_name'
];

const safeReplace = (template, vars) => {
    let output = template || '';
    for (const key of TEMPLATE_VARIABLES) {
        const value = vars?.[key] ?? '';
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        output = output.replace(regex, String(value));
    }
    return output;
};

const renderTemplate = (template, vars) => ({
    subject: safeReplace(template.subject || '', vars),
    preheader: safeReplace(template.preheader || '', vars),
    html: safeReplace(template.html_body || '', vars),
    text: safeReplace(template.text_body || '', vars)
});

module.exports = {
    renderTemplate,
    TEMPLATE_VARIABLES
};
