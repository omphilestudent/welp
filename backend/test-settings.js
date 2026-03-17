const { query } = require('./src/utils/database');

async function testSettingsTable() {
    console.log('Testing settings table...');

    try {
        const tableCheck = await query(
            `SELECT to_regclass('public.system_settings') IS NOT NULL AS exists`
        );

        console.log('system_settings table exists:', tableCheck.rows[0]?.exists);

        if (!tableCheck.rows[0]?.exists) {
            console.log('Creating system_settings table...');
            await query(`
                CREATE TABLE system_settings (
                    key VARCHAR(128) PRIMARY KEY,
                    value JSONB NOT NULL,
                    updated_by UUID,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('system_settings table created');
        }

        const testKey = 'test_setting';
        const testValue = JSON.stringify({ test: true });

        await query(
            `INSERT INTO system_settings (key, value, created_at, updated_at)
             VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
             ON CONFLICT (key) DO UPDATE
             SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [testKey, testValue]
        );

        console.log('Test insert successful');

        const result = await query('SELECT * FROM system_settings WHERE key = $1', [testKey]);
        console.log('Test read result:', result.rows[0]);

        await query('DELETE FROM system_settings WHERE key = $1', [testKey]);
        console.log('Test cleanup successful');

        console.log('All tests passed!');
    } catch (error) {
        console.error('Test failed:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
    } finally {
        process.exit();
    }
}

testSettingsTable();
