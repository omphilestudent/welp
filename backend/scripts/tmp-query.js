const { query } = require('../src/utils/database');

const run = async () => {
    const userId = process.argv[2];
    const pageId = process.argv[3];
    if (!userId || !pageId) {
        console.log('Usage: node scripts/tmp-query.js <userId> <pageId>');
        process.exit(1);
    }
    const user = await query(
        'SELECT id, email, display_name, role FROM users WHERE id = $1',
        [userId]
    );
    console.log('User:', user.rows[0]);

    const page = await query(
        'SELECT id, label, page_type, status, linked_app_id FROM kodi_pages WHERE id = $1',
        [pageId]
    );
    console.log('Page:', page.rows[0]);

    const permissions = await query(
        'SELECT role, can_view, can_edit, can_use FROM kodi_page_permissions WHERE page_id = $1',
        [pageId]
    );
    console.log('Page permissions:', permissions.rows);

    const memberships = await query(
        'SELECT * FROM kodi_app_users WHERE user_id = $1',
        [userId]
    );
    console.log('App memberships:', memberships.rows);

    const appMappings = await query(
        'SELECT * FROM app_page_mapping WHERE page_id = $1',
        [pageId]
    );
    console.log('App mappings for page:', appMappings.rows);

    process.exit(0);
};

run().catch((error) => {
    console.error('Query failed:', error);
    process.exit(1);
});
