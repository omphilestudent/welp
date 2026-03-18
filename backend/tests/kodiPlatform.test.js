const assert = require('assert');
const database = require('../src/utils/database');
const service = require('../src/modules/kodi/kodi.service');
const runtime = require('../src/modules/kodi/kodi.runtime');

(async () => {
    const originalQuery = database.query;
    const originalServiceFns = {
        getPageById: service.getPageById,
        listPermissions: service.listPermissions,
        listComponentRegistry: service.listComponentRegistry,
        listObjects: service.listObjects
    };

    try {
        // createLead stores extended fields
        let capturedParams = null;
        database.query = async (sql, params) => {
            if (sql.includes('INSERT INTO leads')) {
                capturedParams = params;
                return { rows: [{ id: 'lead-1', name: params[0] }] };
            }
            return { rows: [] };
        };

        await service.createLead({
            name: 'Test Lead',
            email: 'lead@example.com',
            status: 'incomplete',
            applicationStatus: 'incomplete',
            source: 'application_start'
        });
        assert.strictEqual(capturedParams[3], 'incomplete');
        assert.strictEqual(capturedParams[4], 'application_start');

        // component registry exposes required components
        const registry = await service.listComponentRegistry();
        assert.ok(registry.find((item) => item.name === 'GridLayout'));
        assert.ok(registry.find((item) => item.name === 'ActionButton'));

        // runtime payload includes layout and registry
        service.getPageById = async () => ({
            id: 'page-1',
            label: 'Runtime Page',
            page_type: 'record',
            status: 'activated',
            activated_at: new Date(),
            layout: { rows: [] }
        });
        service.listPermissions = async () => ([
            { role: 'admin', can_view: true, can_edit: true, can_use: true }
        ]);
        service.listComponentRegistry = async () => registry;
        service.listObjects = async () => ([{ id: 'obj-1', name: 'contact', fields: [] }]);

        const payload = await runtime.buildRuntimePayload({ pageId: 1, role: 'admin' });
        assert.ok(payload.registry.length > 0);
        assert.ok(Array.isArray(payload.objects));

        console.log('✅ Kodi platform smoke tests passed');
    } catch (error) {
        console.error('❌ Kodi platform tests failed:', error);
        process.exit(1);
    } finally {
        database.query = originalQuery;
        Object.assign(service, originalServiceFns);
        if (database.pool?.end) {
            await database.pool.end();
        }
        process.exit(0);
    }
})();
