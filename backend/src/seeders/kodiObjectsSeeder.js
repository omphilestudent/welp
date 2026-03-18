const { query } = require('../utils/database');

const DEFINITIONS = [
    {
        name: 'contact',
        label: 'Contact',
        description: 'Individuals who interact with Kodi apps',
        fields: [
            { fieldName: 'first_name', fieldType: 'string', isRequired: true },
            { fieldName: 'surname', fieldType: 'string', isRequired: true },
            { fieldName: 'email', fieldType: 'string', isRequired: true },
            { fieldName: 'phone_number', fieldType: 'string' }
        ],
        metadata: {
            relationships: [{ target: 'subscription', type: 'one_to_many', sourceField: 'contact_id' }]
        }
    },
    {
        name: 'employee',
        label: 'Employee',
        description: 'Internal staff members',
        fields: [
            { fieldName: 'contact_id', fieldType: 'uuid', isRequired: true },
            { fieldName: 'role', fieldType: 'string' },
            { fieldName: 'department', fieldType: 'string' },
            { fieldName: 'status', fieldType: 'string' }
        ],
        metadata: {
            relationships: [{ target: 'contact', type: 'one_to_one', sourceField: 'contact_id' }]
        }
    },
    {
        name: 'psychologist',
        label: 'Psychologist',
        description: 'Verified psychologists available for sessions',
        fields: [
            { fieldName: 'contact_id', fieldType: 'uuid', isRequired: true },
            { fieldName: 'specialty', fieldType: 'string' },
            { fieldName: 'availability', fieldType: 'string' },
            { fieldName: 'kyc_status', fieldType: 'string' }
        ],
        metadata: {
            relationships: [{ target: 'contact', type: 'one_to_one', sourceField: 'contact_id' }]
        }
    },
    {
        name: 'business',
        label: 'Business User',
        description: 'Business accounts managing Kodi apps',
        fields: [
            { fieldName: 'contact_id', fieldType: 'uuid', isRequired: true },
            { fieldName: 'business_name', fieldType: 'string', isRequired: true },
            { fieldName: 'industry', fieldType: 'string' },
            { fieldName: 'approval_status', fieldType: 'string' }
        ],
        metadata: {
            relationships: [{ target: 'contact', type: 'one_to_one', sourceField: 'contact_id' }]
        }
    },
    {
        name: 'subscription',
        label: 'Subscription',
        description: 'Plan and renewal information',
        fields: [
            { fieldName: 'contact_id', fieldType: 'uuid', isRequired: true },
            { fieldName: 'plan_type', fieldType: 'string' },
            { fieldName: 'status', fieldType: 'string' },
            { fieldName: 'start_date', fieldType: 'date' },
            { fieldName: 'end_date', fieldType: 'date' }
        ],
        metadata: {
            relationships: [{ target: 'contact', type: 'many_to_one', sourceField: 'contact_id' }]
        }
    }
];

const upsertObjects = async () => {
    try {
        await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    } catch {}
    try {
        await query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    } catch {}

    const createTablesWithDefault = async (defaultExpr) => {
        await query(`
            CREATE TABLE IF NOT EXISTS kodi_objects (
                id UUID PRIMARY KEY DEFAULT ${defaultExpr},
                name VARCHAR(100) UNIQUE NOT NULL,
                label VARCHAR(100) NOT NULL,
                description TEXT,
                metadata JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS kodi_fields (
                id UUID PRIMARY KEY DEFAULT ${defaultExpr},
                object_id UUID REFERENCES kodi_objects(id) ON DELETE CASCADE,
                field_name VARCHAR(100) NOT NULL,
                field_type VARCHAR(50) NOT NULL,
                is_required BOOLEAN DEFAULT false,
                is_readonly BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (object_id, field_name)
            );
        `);
    };

    try {
        await createTablesWithDefault('gen_random_uuid()');
    } catch (error) {
        if (String(error?.message || '').includes('gen_random_uuid')) {
            await createTablesWithDefault('uuid_generate_v4()');
        } else {
            throw error;
        }
    }

    const objects = [];
    for (const definition of DEFINITIONS) {
        const result = await query(
            `INSERT INTO kodi_objects (name, label, description, metadata)
             VALUES ($1, $2, $3, $4::jsonb)
             ON CONFLICT (name) DO UPDATE
                 SET label = EXCLUDED.label,
                     description = COALESCE(EXCLUDED.description, kodi_objects.description),
                     metadata = COALESCE(EXCLUDED.metadata, kodi_objects.metadata)
             RETURNING *`,
            [definition.name, definition.label, definition.description, JSON.stringify(definition.metadata || {})]
        );
        objects.push({ ...definition, id: result.rows[0].id });
    }
    return objects;
};

const upsertFields = async (objects) => {
    for (const object of objects) {
        for (const field of object.fields) {
            await query(
                `INSERT INTO kodi_fields (object_id, field_name, field_type, is_required, is_readonly)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (object_id, field_name) DO UPDATE
                     SET field_type = EXCLUDED.field_type,
                         is_required = EXCLUDED.is_required,
                         is_readonly = EXCLUDED.is_readonly`,
                [object.id, field.fieldName, field.fieldType, field.isRequired || false, field.isReadonly || false]
            );
        }
    }
};

const seedKodiObjects = async () => {
    try {
        const objects = await upsertObjects();
        await upsertFields(objects);
        console.log('✅ Kodi CRM objects seeded');
    } catch (error) {
        console.error('❌ Failed to seed Kodi objects:', error.message);
        process.exit(1);
    }
};

if (require.main === module) {
    seedKodiObjects();
}

module.exports = {
    seedKodiObjects
};
