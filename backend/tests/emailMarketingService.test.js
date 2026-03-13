const assert = require('assert');
const emailMarketingService = require('../src/services/emailMarketingService');

const {
    convertSastToUtc,
    computeDefaultSchedule,
    normalizeCampaignPayload,
    renderPricingGrid,
    buildTextVersion
} = emailMarketingService.__testables;

(async () => {
    try {
        const converted = convertSastToUtc('2026-03-16T14:00:00');
        assert.strictEqual(
            converted.toISOString(),
            '2026-03-16T12:00:00.000Z',
            '14:00 SAST should equal 12:00 UTC'
        );

        const defaultSchedule = computeDefaultSchedule();
        assert.strictEqual(defaultSchedule.getUTCHours(), 12, 'Default schedule should anchor at 12:00 UTC');
        const hoursAhead = (defaultSchedule - new Date()) / (1000 * 60 * 60);
        assert.ok(hoursAhead >= 48, 'Default schedule should be at least 48 hours ahead');

        const normalized = normalizeCampaignPayload({
            name: '  Launch Plan ',
            subject: 'New Pricing',
            audience: 'USER',
            payload: {
                ctaUrl: '/pricing'
            }
        });
        assert.strictEqual(normalized.name, 'Launch Plan');
        assert.strictEqual(normalized.audience, 'user');
        assert.ok(normalized.payload.ctaUrl.startsWith('http'), 'CTA URL should resolve to absolute form');

        const html = renderPricingGrid([
            { planCode: 'premium', planTier: 'Premium', priceFormatted: '$99', features: ['Sessions', 'Priority'] }
        ]);
        assert.ok(html.includes('premium'), 'Pricing grid should contain plan code');
        assert.ok(html.includes('$99'), 'Pricing grid should include price');

        const textVersion = buildTextVersion(
            { subject: 'Hello', payload: { intro: 'Hi team', ctaUrl: 'https://welp.com/pricing' } },
            { display_name: 'Preview' },
            { plans: [{ displayName: 'Premium', priceFormatted: '$99' }] }
        );
        assert.ok(textVersion.includes('Premium'), 'Text version should echo plan name');
        assert.ok(textVersion.includes('https://welp.com/pricing'), 'Text version should include CTA URL');

        console.log('✅ Email marketing service tests passed');
    } catch (error) {
        console.error('❌ Email marketing service tests failed:', error);
        process.exit(1);
    }
})();
