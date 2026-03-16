const assert = require('assert');
const { __private } = require('../src/services/flowEngine');

(() => {
    try {
        const screenNode = {
            id: 'welcome',
            type: 'screen',
            title: 'Welcome',
            inputs: [
                { id: 'fullName', label: 'Name', type: 'text', required: true },
                { id: 'plan', label: 'Plan', type: 'select', options: ['free', 'premium'], required: true }
            ],
            next: {
                branches: [
                    { when: { plan: 'premium' }, next: 'premium-step' }
                ],
                default: 'summary'
            }
        };

        const serialized = __private.serializeScreenNode(screenNode, { fullName: 'Ada Lovelace' });
        assert.strictEqual(serialized.inputs.length, 2);
        assert.strictEqual(serialized.inputs[0].value, 'Ada Lovelace');
        assert.strictEqual(serialized.inputs[1].options.length, 2);

        const validationOk = __private.validateScreenInputs(screenNode, {
            fullName: 'Grace Hopper',
            plan: 'premium'
        });
        assert.strictEqual(validationOk.errors.length, 0);
        assert.strictEqual(validationOk.values.plan, 'premium');

        const validationError = __private.validateScreenInputs(screenNode, { plan: 'basic' });
        assert.strictEqual(validationError.errors.length > 0, true, 'should flag missing name or invalid option');

        const nextForPremium = __private.resolveNextFromNode(screenNode, { plan: 'premium' });
        assert.strictEqual(nextForPremium, 'premium-step');
        const nextDefault = __private.resolveNextFromNode(screenNode, { plan: 'free' });
        assert.strictEqual(nextDefault, 'summary');

        console.log('✅ Flow runtime engine tests passed');
    } catch (error) {
        console.error('❌ Flow runtime engine tests failed:', error);
        console.error(error);
        process.exit(1);
    }
})();
