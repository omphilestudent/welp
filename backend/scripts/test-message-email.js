require('dotenv').config();
const { query } = require('../src/utils/database');
const messageController = require('../src/controllers/messageController');

const getConversation = async (conversationId) => {
    if (conversationId) {
        const result = await query(
            `SELECT * FROM conversations WHERE id = $1 LIMIT 1`,
            [conversationId]
        );
        return result.rows[0] || null;
    }

    const result = await query(
        `SELECT *
         FROM conversations
         WHERE status = 'accepted'
         ORDER BY updated_at DESC NULLS LAST, created_at DESC
         LIMIT 1`
    );
    return result.rows[0] || null;
};

const getUser = async (userId) => {
    const result = await query(
        `SELECT id, email, display_name, role, can_use_profile
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [userId]
    );
    return result.rows[0] || null;
};

const run = async () => {
    const conversationId = process.argv[2];
    const messageText = process.argv.slice(3).join(' ').trim()
        || 'Test message from Welp (email notification check).';

    const conversation = await getConversation(conversationId);
    if (!conversation) {
        console.error('No accepted conversation found. Provide a conversation id as the first argument.');
        process.exit(1);
    }

    const senderId = conversation.employee_id;
    const sender = await getUser(senderId);
    if (!sender) {
        console.error('Sender not found.');
        process.exit(1);
    }

    const req = {
        params: { conversationId: conversation.id },
        body: { content: messageText },
        user: sender,
        app: { get: () => null }
    };

    const res = {
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            console.log('Message API response:', {
                status: this.statusCode || 200,
                payload
            });
            return payload;
        }
    };

    await messageController.sendMessage(req, res);
    console.log('If SMTP is configured, an email should have been sent to the recipient.');
};

run().then(() => process.exit(0)).catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
});
