require('dotenv').config();
const { query } = require('../src/utils/database');

const run = async () => {
    console.log('Running conversation visibility smoke test...');

    // Find a recent accepted conversation with both participants present.
    const convoRes = await query(
        `SELECT id, employee_id, psychologist_id, status, updated_at, created_at
         FROM conversations
         WHERE status IN ('accepted','pending')
           AND employee_id IS NOT NULL
           AND psychologist_id IS NOT NULL
         ORDER BY updated_at DESC NULLS LAST, created_at DESC
         LIMIT 1`
    );

    const convo = convoRes.rows[0];
    if (!convo) {
        console.error('No accepted/pending conversations found to test.');
        process.exit(1);
    }

    console.log('Using conversation:', convo.id, 'status=', convo.status);

    // Employee-side list query (mirrors getConversations join assumptions).
    const employeeList = await query(
        `SELECT c.id
         FROM conversations c
         JOIN users employee ON c.employee_id = employee.id
         JOIN users psychologist ON c.psychologist_id = psychologist.id
         WHERE c.employee_id = $1
           AND c.status::text = ANY($2::text[])
         ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC`,
        [convo.employee_id, ['pending', 'accepted', 'rejected', 'blocked', 'ended']]
    );

    // Psychologist-side list query.
    const psychologistList = await query(
        `SELECT c.id
         FROM conversations c
         JOIN users employee ON c.employee_id = employee.id
         JOIN users psychologist ON c.psychologist_id = psychologist.id
         WHERE c.psychologist_id = $1
           AND c.status::text = ANY($2::text[])
         ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC`,
        [convo.psychologist_id, ['pending', 'accepted', 'rejected', 'blocked', 'ended']]
    );

    const employeeHas = employeeList.rows.some((r) => r.id === convo.id);
    const psychologistHas = psychologistList.rows.some((r) => r.id === convo.id);

    if (!employeeHas || !psychologistHas) {
        console.error('❌ Visibility failed', { employeeHas, psychologistHas });
        process.exit(1);
    }

    console.log('✅ Visibility OK for both sides');
    process.exit(0);
};

run().catch((error) => {
    console.error('Smoke test failed:', error);
    process.exit(1);
});

