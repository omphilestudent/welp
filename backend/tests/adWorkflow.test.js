const assert = require('assert');
const { hasPremiumException } = require('../src/utils/premiumAccess');
const { formatAnalyticsForTier } = require('../src/services/adsService');

(async () => {
    try {
        assert.strictEqual(hasPremiumException('omphilemohlala@welp.com'), true, 'Premium email should bypass limits');
        assert.strictEqual(hasPremiumException('OMPHILEMOHLALA@WELP.COM'), true, 'Premium email case-insensitive');
        assert.strictEqual(hasPremiumException('biz@example.com'), false, 'Other emails do not bypass');

        const sampleCampaign = {
            id: '123',
            name: 'Test',
            status: 'active',
            review_status: 'approved',
            impressions: 1000,
            clicks: 50,
            spend_minor: 12345,
            placements: []
        };

        const limited = formatAnalyticsForTier(sampleCampaign, 'limited');
        assert.strictEqual(limited.impressions, 1000, 'Limited analytics keeps counts');
        assert.ok(!limited.hasOwnProperty('daily_budget_minor'), 'Limited analytics hides spend data');

        const advanced = formatAnalyticsForTier(sampleCampaign, 'advanced');
        assert.strictEqual(advanced.spend_minor, 12345, 'Advanced analytics exposes spend');

        console.log('✅ Ad workflow tests passed');
    } catch (error) {
        console.error('❌ Ad workflow tests failed:', error);
        process.exit(1);
    }
})();
