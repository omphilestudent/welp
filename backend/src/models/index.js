// models/index.js (partial)
async function testConnection(retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            await sequelize.authenticate();
            console.log('✅ Database connection established.');
            return true;
        } catch (error) {
            console.log(`⚠️ Connection attempt ${i + 1} failed: ${error.message}`);
            if (i < retries - 1) {
                console.log('⏳ Waiting 3 seconds before retry...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }
    console.error('❌ All database connection attempts failed.');
    return false;
}