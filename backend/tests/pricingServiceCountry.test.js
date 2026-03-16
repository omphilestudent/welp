const assert = require('assert');
const pricingService = require('../src/services/pricingService');
const database = require('../src/utils/database');

(async () => {
    const originalQuery = database.query;
    try {
        const mockRow = {
            country_code: 'ZA',
            country_name: 'South Africa',
            multiplier: 0.55,
            currency_code: 'ZAR',
            client_paid_monthly_zar: 150,
            psychologist_monthly_zar: 500,
            business_base_monthly_zar: 1000,
            business_enhanced_monthly_zar: 2000,
            business_premium_monthly_zar: 3000,
            currency_symbol: 'R'
        };
        let queryCount = 0;
        database.query = async (sql) => {
            queryCount += 1;
            if (sql.includes('subscription_pricing_by_country')) {
                return { rows: [mockRow] };
            }
            return { rows: [] };
        };

        const firstPass = await pricingService.listCountryPricing();
        assert.strictEqual(queryCount, 1, 'should query subscription pricing table once');
        assert.strictEqual(firstPass.length, 1);
        assert.strictEqual(firstPass[0].code, 'ZA');
        assert.strictEqual(firstPass[0].currency, 'ZAR');
        assert.strictEqual(firstPass[0].currencySymbol, 'R');
        assert.strictEqual(firstPass[0].source, 'subscription');
        assert.strictEqual(firstPass[0].prices.client, 150);

        const secondPass = await pricingService.listCountryPricing();
        assert.strictEqual(queryCount, 1, 'should use cache for subsequent requests');
        assert.strictEqual(secondPass.length, 1);

        console.log('Pricing service country catalog test passed');
    } catch (error) {
        console.error('Pricing service country catalog test failed:', error);
        process.exit(1);
    } finally {
        database.query = originalQuery;
    }
})();
