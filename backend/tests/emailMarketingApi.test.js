const assert = require('assert');
const emailMarketingController = require('../src/controllers/emailMarketingController');
const emailMarketingService = require('../src/services/emailMarketingService');

const createMockRes = () => {
    return {
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
    };
};

(async () => {
    const originalCreate = emailMarketingService.createCampaign;
    const originalUpdate = emailMarketingService.updateCampaign;

    try {
        let createArgs = null;
        emailMarketingService.createCampaign = async (payload, userId) => {
            createArgs = { payload, userId };
            return { id: 'test-campaign', ...payload };
        };

        const createReq = {
            body: {
                name: 'Q2 Pricing Blast',
                subject: 'New Welp pricing goes live',
                audience: 'business'
            },
            user: { id: 'admin-user' }
        };
        const createRes = createMockRes();
        await emailMarketingController.createCampaign(createReq, createRes);
        assert.strictEqual(createRes.statusCode, 201, 'createCampaign should return 201 status');
        assert.ok(createArgs, 'service should receive payload');
        assert.strictEqual(createArgs.userId, 'admin-user', 'controller should forward admin id');
        assert.strictEqual(createRes.body.campaign.id, 'test-campaign', 'response should contain campaign data');

        let updateArgs = null;
        emailMarketingService.updateCampaign = async (id, updates, userId) => {
            updateArgs = { id, updates, userId };
            return { id, ...updates };
        };

        const updateReq = {
            params: { id: 'test-campaign' },
            body: { subject: 'Updated subject', recurrence: 'weekly' },
            user: { id: 'admin-editor' }
        };
        const updateRes = createMockRes();
        await emailMarketingController.updateCampaign(updateReq, updateRes);
        assert.strictEqual(updateRes.statusCode, 200, 'updateCampaign should default to 200 status');
        assert.strictEqual(updateRes.body.campaign.subject, 'Updated subject', 'response should propagate service payload');
        assert.deepStrictEqual(updateArgs, {
            id: 'test-campaign',
            updates: updateReq.body,
            userId: 'admin-editor'
        }, 'service should receive id, updates, and user id');

        console.log('✅ Email marketing API tests passed');
    } catch (error) {
        console.error('❌ Email marketing API tests failed:', error);
        process.exit(1);
    } finally {
        emailMarketingService.createCampaign = originalCreate;
        emailMarketingService.updateCampaign = originalUpdate;
    }
})();
