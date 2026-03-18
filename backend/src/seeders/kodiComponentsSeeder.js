const { query } = require('../utils/database');

const defaultComponents = [
    {
        component_name: 'DataTable',
        component_type: 'widget',
        code: 'frontend:DataTable',
        config: {
            category: 'data',
            props: ['title', 'columns', 'data', 'pageSize'],
            events: ['onRowClick']
        }
    },
    {
        component_name: 'RecordViewer',
        component_type: 'page_block',
        code: 'frontend:RecordViewer',
        config: {
            category: 'data',
            props: ['title', 'record'],
            events: []
        }
    },
    {
        component_name: 'CardList',
        component_type: 'widget',
        code: 'frontend:CardList',
        config: {
            category: 'ui',
            props: ['title', 'items'],
            events: ['onCardClick']
        }
    },
    {
        component_name: 'ClientApplicationsWidget',
        component_type: 'widget',
        code: 'frontend:ClientApplicationsWidget',
        config: {
            category: 'business',
            props: ['title', 'apiEndpoint', 'limit'],
            events: ['onApprove', 'onReject']
        }
    },
    {
        component_name: 'CaseWidget',
        component_type: 'widget',
        code: 'frontend:CaseWidget',
        config: {
            category: 'business',
            props: ['title', 'apiEndpoint', 'limit'],
            events: ['onCreate', 'onEscalate', 'onResolve']
        }
    },
    {
        component_name: 'AdsWidget',
        component_type: 'widget',
        code: 'frontend:AdsWidget',
        config: {
            category: 'business',
            props: ['title', 'apiEndpoint', 'limit'],
            events: ['onApprove', 'onReject']
        }
    },
    {
        component_name: 'Tabs',
        component_type: 'layout',
        code: 'frontend:Tabs',
        config: {
            category: 'layout',
            props: ['tabs'],
            events: []
        }
    },
    {
        component_name: 'Accordion',
        component_type: 'layout',
        code: 'frontend:Accordion',
        config: {
            category: 'layout',
            props: ['items'],
            events: []
        }
    },
    {
        component_name: 'Button',
        component_type: 'widget',
        code: 'frontend:Button',
        config: {
            category: 'action',
            props: ['label', 'variant', 'navigateTo', 'apiEndpoint', 'method', 'payload', 'triggerEvent', 'eventPayload'],
            events: []
        }
    },
    {
        component_name: 'FormBuilder',
        component_type: 'widget',
        code: 'frontend:FormBuilder',
        config: {
            category: 'action',
            props: ['title', 'fields', 'apiEndpoint', 'method', 'submitLabel'],
            events: ['onSubmit']
        }
    },
    {
        component_name: 'NotificationPanel',
        component_type: 'widget',
        code: 'frontend:NotificationPanel',
        config: {
            category: 'utility',
            props: ['title'],
            events: []
        }
    },
    {
        component_name: 'PanelHighlight',
        component_type: 'widget',
        code: 'frontend:PanelHighlight',
        config: {
            category: 'kodi',
            props: [
                { name: 'title', type: 'string', label: 'Title', default: 'Highlights' },
                { name: 'description', type: 'string', label: 'Description', default: 'Track the most important calls and tasks.' },
                { name: 'badge', type: 'string', label: 'Badge', default: 'Live' },
                { name: 'actions', type: 'array', label: 'Action Buttons', default: '["Add Call","New Task","Send Update"]' },
                { name: 'stats', type: 'array', label: 'Stats', default: '["Leads: 8","Calls: 12","Open Tasks: 3"]' },
                { name: 'accentColor', type: 'string', label: 'Accent Color', default: '#0f62fe' },
                { name: 'textColor', type: 'string', label: 'Text Color', default: '#ffffff' }
            ],
            events: ['onAction'],
            permissions: ['admin', 'sales', 'customer_service'],
            style: { theme: 'kodi', spacing: 'medium' }
        }
    },
    {
        component_name: 'RecordPage',
        component_type: 'page_block',
        code: 'frontend:RecordPage',
        config: {
            category: 'kodi',
            props: [
                {
                    name: 'client',
                    type: 'object',
                    label: 'Client Profile',
                    description: 'Object with name, account, phone, email, status',
                    default: '{"name":"Jordan Smith","account":"AC-124","phone":"+1 (555) 010-1010","email":"jordan@example.com","status":"VIP"}'
                },
                {
                    name: 'timeline',
                    type: 'array',
                    label: 'Timeline',
                    default: '["Last contact: Email - 8 mins ago","Next follow-up: Demo Friday","Notes: Referral from Anna"]'
                },
                {
                    name: 'filters',
                    type: 'array',
                    label: 'Quick Filters',
                    default: '["Open","Prospect","VIP"]'
                },
                { name: 'highlight', type: 'string', label: 'Highlight Tag', default: 'Priority client' },
                {
                    name: 'quickMessage',
                    type: 'string',
                    label: 'Quick Message',
                    default: 'Search across clients, cases, and documents.'
                }
            ],
            events: ['onSearch'],
            permissions: ['admin', 'customer_service', 'sales'],
            style: { theme: 'record', spacing: 'medium' }
        }
    }
];

const seedKodiComponents = async ({ createdByUserId = null } = {}) => {
    // Table might not exist yet in some environments.
    const table = await query(`SELECT to_regclass('public.kodi_components') as t`);
    if (!table.rows[0]?.t) {
        console.warn('kodi_components table not found; skipping Kodi components seed.');
        return { inserted: 0, skipped: defaultComponents.length };
    }

    let inserted = 0;
    for (const comp of defaultComponents) {
        const componentType = comp.component_type === 'page_block' ? 'custom_page' : 'custom_widget';
        const result = await query(
            `INSERT INTO kodi_components (component_name, component_type, code, version, created_by_user_id)
             VALUES ($1, $2, $3, 1, $4)
             ON CONFLICT (component_name) DO NOTHING`,
            [comp.component_name, componentType, comp.code, createdByUserId]
        );
        if (result.rowCount > 0) inserted += 1;
    }
    return { inserted, skipped: defaultComponents.length - inserted };
};

if (require.main === module) {
    seedKodiComponents()
        .then((out) => {
            console.log('Kodi components seed complete:', out);
            process.exit(0);
        })
        .catch((error) => {
            console.error('Kodi components seed failed:', error);
            process.exit(1);
        });
}

module.exports = { seedKodiComponents };

