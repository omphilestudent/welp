require('dotenv').config();
const { query } = require('../src/utils/database');
const ticketController = require('../src/controllers/ticketController');

const makeRes = (label) => {
    return {
        statusCode: 200,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            console.log(`\n[${label}] status=${this.statusCode}`, JSON.stringify(payload, null, 2));
            return payload;
        }
    };
};

const getUserByRole = async (roles) => {
    const result = await query(
        `SELECT id, email, display_name, role
         FROM users
         WHERE role = ANY($1::text[])
         LIMIT 1`,
        [roles]
    );
    return result.rows[0] || null;
};

const run = async () => {
    const admin = await getUserByRole(['admin', 'super_admin']);
    if (!admin) {
        console.error('No admin user found. Create an admin user first.');
        process.exit(1);
    }

    const regular = await getUserByRole(['employee', 'user', 'customer_service', 'sales', 'hr']);
    if (!regular) {
        console.error('No regular user found. Create a non-admin user first.');
        process.exit(1);
    }

    console.log('Using admin:', admin.email, 'and user:', regular.email);

    const createReq = {
        user: regular,
        body: {
            title: 'Ticketing System Test',
            description: 'Automated test ticket from script.',
            priority: 'high',
            category: 'test'
        }
    };
    const created = await ticketController.createTicket(createReq, makeRes('create-ticket'));
    const ticketId = created?.data?.id || created?.data?.ticket_id || created?.data?.id;

    if (!ticketId) {
        console.error('Ticket creation failed. Aborting.');
        process.exit(1);
    }

    await ticketController.assignTicket({
        user: admin,
        params: { id: ticketId },
        body: { assignedToUserId: admin.id }
    }, makeRes('assign-ticket'));

    await ticketController.updateTicket({
        user: admin,
        params: { id: ticketId },
        body: { status: 'in_progress' }
    }, makeRes('update-status'));

    await ticketController.addTicketHistory({
        user: regular,
        params: { id: ticketId },
        body: { notes: 'User added a test note.' }
    }, makeRes('add-history'));

    await ticketController.getTicketHistory({
        user: regular,
        params: { id: ticketId }
    }, makeRes('get-history'));

    await ticketController.listTickets({
        user: regular,
        query: {}
    }, makeRes('list-user-tickets'));

    await ticketController.listTickets({
        user: admin,
        query: {}
    }, makeRes('list-admin-tickets'));

    await ticketController.updateTicket({
        user: admin,
        params: { id: ticketId },
        body: { status: 'resolved' }
    }, makeRes('resolve-ticket'));

    console.log('\nTicketing test flow completed.');
};

run().then(() => process.exit(0)).catch((error) => {
    console.error('Ticketing test failed:', error);
    process.exit(1);
});
