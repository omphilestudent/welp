const assert = require('assert');
const pricingController = require('../src/controllers/pricingController');
const database = require('../src/utils/database');

const createMockRes = () => ({
    statusCode: 200,
    body: null,
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(payload) {
        this.body = payload;
        return this;
    }
});

const BASE_PRICE_ROWS = [
    { key: 'base_price_client', value: '150' },
    { key: 'base_price_psychologist', value: '500' },
    { key: 'base_price_business_base', value: '1000' },
    { key: 'base_price_business_enhanced', value: '2000' },
    { key: 'base_price_business_premium', value: '3000' }
];

(async () => {
    const originalQuery = database.query;

    try {
        // getCountryPricing
        const sampleCountries = [
            { country_code: 'ZA', country_name: 'South Africa', multiplier: 1 }
        ];
        database.query = async () => ({ rows: sampleCountries });
        const countryRes = createMockRes();
        await pricingController.getCountryPricing({}, countryRes);
        assert.strictEqual(countryRes.statusCode, 200);
        assert.deepStrictEqual(countryRes.body, sampleCountries, 'should return DB rows for country pricing');

        // updateBasePrices
        let basePriceParams = null;
        database.query = async (_sql, params) => {
            basePriceParams = params;
            return { rows: [] };
        };
        const baseReq = {
            body: {
                client: 175,
                psychologist: 525,
                business_base: 1200,
                business_enhanced: 2400,
                business_premium: 3600
            }
        };
        const baseRes = createMockRes();
        await pricingController.updateBasePrices(baseReq, baseRes);
        assert.deepStrictEqual(
            basePriceParams,
            [175, 525, 1200, 2400, 3600],
            'updateBasePrices should persist all five plan values'
        );
        assert.deepStrictEqual(baseRes.body, { success: true });

        // recalculateAllPrices
        let recalculationArgs = null;
        database.query = async (sql, params) => {
            if (sql.includes('FROM system_settings')) {
                return { rows: BASE_PRICE_ROWS };
            }
            recalculationArgs = params;
            return { rows: [] };
        };
        const recalcRes = createMockRes();
        await pricingController.recalculateAllPrices({}, recalcRes);
        assert.deepStrictEqual(
            recalculationArgs,
            [150, 500, 1000, 2000, 3000],
            'recalculateAllPrices should use base price defaults'
        );
        assert.deepStrictEqual(recalcRes.body, { success: true });

        // updateCountryPricing
        let updateCountryParams = null;
        database.query = async (_sql, params) => {
            updateCountryParams = params;
            return { rows: [] };
        };
        const countryReq = {
            params: { countryCode: 'ZA' },
            body: {
                multiplier: 1.1,
                clientPrice: 165,
                psychologistPrice: 550,
                businessBasePrice: 1100,
                businessEnhancedPrice: 2200,
                businessPremiumPrice: 3300,
                currencyCode: 'ZAR'
            }
        };
        const updateCountryRes = createMockRes();
        await pricingController.updateCountryPricing(countryReq, updateCountryRes);
        assert.strictEqual(updateCountryParams[7], 'ZA');
        assert.deepStrictEqual(updateCountryRes.body, { success: true });

        // addCountry
        let insertCountryParams = null;
        database.query = async (sql, params) => {
            if (sql.includes('FROM system_settings')) {
                return { rows: BASE_PRICE_ROWS };
            }
            insertCountryParams = params;
            return { rows: [] };
        };
        const addReq = {
            body: {
                countryCode: 'KE',
                countryName: 'Kenya',
                multiplier: 0.8,
                currencyCode: 'KES'
            }
        };
        const addRes = createMockRes();
        await pricingController.addCountry(addReq, addRes);
        assert.strictEqual(insertCountryParams[0], 'KE');
        assert.strictEqual(insertCountryParams[1], 'Kenya');
        assert.strictEqual(insertCountryParams[2], 0.8);
        assert.strictEqual(insertCountryParams[3], 150 * 0.8);
        assert.strictEqual(insertCountryParams[4], 500 * 0.8);
        assert.strictEqual(insertCountryParams[9 - 1], 'KES'); // currency code
        assert.deepStrictEqual(addRes.body, { success: true });

        // deleteCountry
        let deleteParams = null;
        database.query = async (_sql, params) => {
            deleteParams = params;
            return { rows: [] };
        };
        const deleteReq = { params: { countryCode: 'KE' } };
        const deleteRes = createMockRes();
        await pricingController.deleteCountry(deleteReq, deleteRes);
        assert.deepStrictEqual(deleteParams, ['KE']);
        assert.deepStrictEqual(deleteRes.body, { success: true });

        // bulkUpdatePricing
        let bulkUpdateParams = null;
        database.query = async (sql, params) => {
            if (sql.includes('FROM system_settings')) {
                return { rows: BASE_PRICE_ROWS };
            }
            bulkUpdateParams = params;
            return { rows: [] };
        };
        const bulkReq = {
            body: {
                countryCodes: ['ZA', 'NG'],
                multiplier: 1.2
            }
        };
        const bulkRes = createMockRes();
        await pricingController.bulkUpdatePricing(bulkReq, bulkRes);
        assert.strictEqual(bulkUpdateParams[0], 1.2);
        assert.deepStrictEqual(bulkUpdateParams[6], ['ZA', 'NG']);
        assert.deepStrictEqual(bulkRes.body, { success: true, updated: 2 });

        console.log('✅ Admin pricing API tests passed');
    } catch (error) {
        console.error('❌ Admin pricing API tests failed:', error);
        console.error(error);
        process.exit(1);
    } finally {
        database.query = originalQuery;
    }
})();
