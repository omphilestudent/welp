const { query } = require('../utils/database');
const {
    createEvent,
    listEventsForPsychologist,
    getInviteByToken,
    acceptInvite,
    sendEventInvites
} = require('../services/psychologistEventService');

const createPsychologistEvent = async (req, res) => {
    try {
        const { psychologistId } = req.params;
        const {
            title,
            description,
            location,
            startsAt,
            endsAt,
            timezone,
            eventType,
            isVideoCall,
            invitees
        } = req.body || {};
        const eventPayload = await createEvent({
            psychologistId,
            createdBy: req.user.id,
            title,
            description,
            location,
            startsAt,
            endsAt,
            timezone,
            eventType,
            isVideoCall,
            invitees
        });

        const hostResult = await query(
            'SELECT display_name, email FROM users WHERE id = $1',
            [psychologistId]
        );
        await sendEventInvites({
            event: eventPayload.event,
            invitees: eventPayload.invitees,
            host: hostResult.rows[0]
        });

        return res.status(201).json({
            success: true,
            event: eventPayload.event,
            invitees: eventPayload.invitees
        });
    } catch (error) {
        console.error('Create psychologist event error:', error);
        return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to create event' });
    }
};

const listPsychologistEvents = async (req, res) => {
    try {
        const { psychologistId } = req.params;
        const events = await listEventsForPsychologist(psychologistId);
        return res.json({ events });
    } catch (error) {
        console.error('List psychologist events error:', error);
        return res.status(500).json({ error: 'Failed to load events' });
    }
};

const getInviteDetails = async (req, res) => {
    try {
        const { token } = req.params;
        const invite = await getInviteByToken(token);
        if (!invite) {
            return res.status(404).json({ error: 'Invite not found' });
        }
        return res.json({ invite });
    } catch (error) {
        console.error('Get invite error:', error);
        return res.status(500).json({ error: 'Failed to load invite' });
    }
};

const acceptInviteToken = async (req, res) => {
    try {
        const { token } = req.params;
        const invite = await acceptInvite({ token, userId: req.user?.id });
        return res.json({ success: true, invite });
    } catch (error) {
        console.error('Accept invite error:', error);
        return res.status(error.statusCode || 500).json({ error: error.message || 'Failed to accept invite' });
    }
};

module.exports = {
    createPsychologistEvent,
    listPsychologistEvents,
    getInviteDetails,
    acceptInviteToken
};
