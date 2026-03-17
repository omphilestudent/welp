require('dotenv').config();
const { query } = require('../src/utils/database');
const { adminListAds } = require('../src/services/adsService');

const run = async () => {
    console.log('Running admin ads list smoke test (DB-level)...');

    const table = await query(`SELECT to_regclass('public.advertising_campaigns') as t`);
    if (!table.rows[0]?.t) {
        console.error('advertising_campaigns table not found.');
        process.exit(1);
    }

    const pending = await adminListAds({ reviewStatus: 'pending' });
    console.log('✅ adminListAds(pending) returned:', pending.length);

    const any = await adminListAds({});
    console.log('✅ adminListAds(all) returned:', any.length);

    process.exit(0);
};

run().catch((error) => {
    console.error('Smoke test failed:', error);
    process.exit(1);
});

