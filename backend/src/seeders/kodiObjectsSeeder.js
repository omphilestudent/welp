const { query } = require('../utils/database');

const DEFINITIONS = [
    {
        name: 'contact',
        label: 'Contact',
        description: 'Individuals who interact with Kodi apps',
        fields: [
            { fieldName: 'first_name', fieldType: 'string', isRequired: true },
            { fieldName: 'last_name', fieldType: 'string', isRequired: true },
            { fieldName: 'email', fieldType: 'string', isRequired: true },
            { fieldName: 'phone', fieldType: 'string' },
            { fieldName: 'company', fieldType: 'string' }
        ]
    },
    {
        name: 'employee',
        label: 'Employee',
        description: 'Internal staff members',
        fields: [
            { fieldName: 'full_name', fieldType: 'string', isRequired: true },
            { fieldName: 'role', fieldType: 'string' },
            { fieldName: 'department', fieldType: 'string' },
            { fieldName: 'manager', fieldType: 'string' }
        ]
    },
    {
        name: 'psychologist',
        label: 'Psychologist',
        description: 'Verified psychologists available for sessions',
        fields: [
            { fieldName: 'specialty', fieldType: 'string' },
            { fieldName: 'availability', fieldType: 'string' },
            { fieldName: 'license_number', fieldType: 'string' },
            { fieldName: 'rating', fieldType: 'number' }
        ]
    },
    {
        name: 'business',
        label: 'Business User',
        description: 'Business accounts managing Kodi apps',
        fields: [
            { fieldName: 'business_name', fieldType: 'string', isRequired: true },
            { fieldName: 'industry', fieldType: 'string' },
            { fieldName: 'subscription_status', fieldType: 'string' },
            { fieldName: 'linked_contacts', fieldType: 'string' }
        ]
    },
    {
        name: 'subscription',
        label: 'Subscription',
        description: 'Plan and renewal information',
        fields: [
            { fieldName: 'plan', fieldType: 'string' },
            { fieldName: 'status', fieldType: 'string' },
            { fieldName: 'starts_at', fieldType: 'date' },
            { fieldName: 'ends_at', fieldType: 'date' }
        ]
    }
];

const upsertObjects = async () => {
    const objects = [];
    for (const definition of DEFINITIONS) {
        const result = await query(
            `INSERT INTO kodi_objects (name, label, description)
             VALUES ($1, $2, $3)
             ON CONFLICT (name) DO UPDATE
                 SET label = EXCLUDED.label,
                     description = COALESCE(EXCLUDED.description, kodi_objects.description)
             RETURNING *`,
            [definition.name, definition.label, definition.description]
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
