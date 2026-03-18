const assert = require('assert');
const database = require('../src/utils/database');
const service = require('../src/modules/marketing/marketing.service');
const { renderTemplate } = require('../src/modules/marketing/marketing.templates');

(async () => {
    const originalQuery = database.query;
    try {
        database.query = async (sql, params) => {
            if (sql.includes('SELECT * FROM marketing_email_templates')) {
                return { rows: [{ id: 't1', key: 'employee_subscription_campaign', subject: 'Hi {{first_name}}' }] };
            }
            if (sql.includes('system_settings')) {
                return { rows: [{ value: { employee_marketing_enabled: true } }] };
            }
            if (sql.includes('INSERT INTO email_delivery_logs')) {
                return { rows: [{ id: 'log-1' }] };
            }
            return { rows: [] };
        };

        const templates = await service.listTemplates();
        assert.strictEqual(templates.length, 1);

        const rendered = renderTemplate(
            { subject: 'Hello {{first_name}}', html_body: '<p>{{full_name}}</p>', text_body: 'Hi {{first_name}}' },
            { first_name: 'Alex', full_name: 'Alex Doe' }
        );
        assert.strictEqual(rendered.subject, 'Hello Alex');

        console.log('✅ Marketing service smoke tests passed');
    } catch (error) {
        console.error('❌ Marketing service tests failed:', error);
        process.exit(1);
    } finally {
        database.query = originalQuery;
        process.exit(0);
    }
})();
