require('dotenv').config();
const { query } = require('../src/utils/database');
const kodiPagesService = require('../src/modules/kodi/kodiPages.service');

const run = async () => {
    console.log('Running Kodi Record Page end-to-end smoke test...');

    // Pick an admin platform user (for page/component creation).
    const adminRes = await query(
        `SELECT id, email, role
         FROM users
         WHERE LOWER(role) IN ('admin','super_admin','superadmin')
         LIMIT 1`
    );
    const admin = adminRes.rows[0];
    if (!admin) {
        console.error('No admin user found in users table.');
        process.exit(1);
    }

    const page = await kodiPagesService.createPage({
        name: `Kodi Page Smoke Test ${Date.now()}`,
        slug: `kodi-smoke-${Date.now()}`,
        description: 'Automated smoke test page.',
        layout: {
            rows: [{ columns: [{ components: [] }] }]
        },
        createdByUserId: admin.id
    });
    console.log('✅ Created page:', page.slug);

    const component = await kodiPagesService.createComponent({
        componentName: `SmokeWidget-${Date.now()}`,
        componentType: 'widget',
        code: '/* placeholder */',
        config: { kind: 'placeholder' },
        createdByUserId: admin.id
    });
    console.log('✅ Created KC component:', component.component_name);

    const mapping = await kodiPagesService.attachComponentToPage({
        pageId: page.id,
        componentId: component.id,
        position: { row: 0, col: 0 },
        props: { title: 'Hello Kodi' },
        createdByUserId: admin.id
    });
    console.log('✅ Attached component mapping:', mapping.id);

    // Create per-page credentials (page access user).
    const username = `smoke_${Math.random().toString(16).slice(2, 8)}`;
    const password = 'smokePass123!';
    const access = await kodiPagesService.createPageAccess({
        pageId: page.id,
        username,
        password,
        role: 'customer_service',
        createdByUserId: admin.id
    });
    console.log('✅ Created page access:', access.username);

    // Authenticate + fetch bundle
    const login = await kodiPagesService.authenticatePageAccess({
        pageSlug: page.slug,
        username,
        password,
        ipAddress: '127.0.0.1'
    });
    if (!login.ok || !login.token) {
        console.error('Login failed:', login);
        process.exit(1);
    }
    console.log('✅ Page access login OK');

    const bundle = await kodiPagesService.getPageBundleBySlug(page.slug);
    if (!bundle?.page?.id || (bundle.components || []).length < 1) {
        console.error('Bundle invalid:', bundle);
        process.exit(1);
    }
    console.log('✅ Bundle loaded with components:', bundle.components.length);

    console.log('Kodi Record Page smoke test completed.');
};

run().then(() => process.exit(0)).catch((error) => {
    console.error('Smoke test failed:', error);
    process.exit(1);
});

