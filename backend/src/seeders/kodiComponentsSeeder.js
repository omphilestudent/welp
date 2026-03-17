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
    }
];

const seedKodiComponents = async ({ createdByUserId = null } = {}) => {
    // Table might not exist yet in some environments.
    const table = await query(`SELECT to_regclass('public.kc_kodi_components') as t`);
    if (!table.rows[0]?.t) {
        console.warn('kc_kodi_components table not found; skipping Kodi components seed.');
        return { inserted: 0, skipped: defaultComponents.length };
    }

    let inserted = 0;
    for (const comp of defaultComponents) {
        const result = await query(
            `INSERT INTO kc_kodi_components (component_name, component_type, code, config, version, created_by_user_id)
             VALUES ($1, $2, $3, $4, 1, $5)
             ON CONFLICT (component_name) DO NOTHING`,
            [comp.component_name, comp.component_type, comp.code, comp.config || {}, createdByUserId]
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

