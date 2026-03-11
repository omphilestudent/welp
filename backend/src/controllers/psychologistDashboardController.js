const { query } = require('../utils/database');
const { getRoleFlags } = require('../middleware/roleFlags');

const scheduleStore = new Map();
const leadsStore = new Map();
const favoritesStore = new Map();

const buildDefaultSchedule = () => ([
    {
        id: 'sched-1',
        title: 'Follow-up check-in',
        scheduled_for: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        type: 'video',
        status: 'scheduled',
        location: 'Virtual room'
    },
    {
        id: 'sched-2',
        title: 'New client intake',
        scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        type: 'voice',
        status: 'scheduled',
        location: 'Phone call'
    }
]);

const buildDefaultLeads = () => ([
    {
        id: 'lead-1',
        display_name: 'Anonymous Employee',
        risk_level: 'high',
        summary: 'Self-reported burnout symptoms and low sleep quality.',
        company: 'Unspecified',
        status: 'new'
    },
    {
        id: 'lead-2',
        display_name: 'Team Member',
        risk_level: 'medium',
        summary: 'Mentions anxiety about workload and deadlines.',
        company: 'Product Team',
        status: 'review'
    }
]);

const buildDefaultFavorites = () => ([
    {
        id: 'fav-1',
        display_name: 'A. Client',
        notes: 'Prefers afternoon sessions',
        last_session: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    }
]);

const getDashboardPermissions = async (req, res) => {
    const roleFlags = req.user?.role_flags || getRoleFlags(req.user?.role);
    res.json({
        roleFlags,
        plan: roleFlags.plan || 'free',
        callLimits: {
            minutesPerClient: roleFlags.call_minutes_per_client || 120
        }
    });
};

const getSchedule = async (req, res) => {
    const existing = scheduleStore.get(req.user.id);
    if (!existing) {
        const defaults = buildDefaultSchedule();
        scheduleStore.set(req.user.id, defaults);
        return res.json(defaults);
    }
    return res.json(existing);
};

const addScheduleItem = async (req, res) => {
    const { title, scheduledFor, type = 'meeting', location = '' } = req.body || {};
    if (!title || !scheduledFor) {
        return res.status(400).json({ error: 'Title and scheduledFor are required' });
    }

    const existing = scheduleStore.get(req.user.id) || [];
    const newItem = {
        id: `sched-${Date.now()}`,
        title,
        scheduled_for: new Date(scheduledFor).toISOString(),
        type,
        status: 'scheduled',
        location
    };
    const updated = [newItem, ...existing];
    scheduleStore.set(req.user.id, updated);
    return res.status(201).json(newItem);
};

const getLeads = async (req, res) => {
    const existing = leadsStore.get(req.user.id);
    if (!existing) {
        const defaults = buildDefaultLeads();
        leadsStore.set(req.user.id, defaults);
        return res.json(defaults);
    }
    return res.json(existing);
};

const sendLeadMessage = async (req, res) => {
    const { leadId } = req.params;
    const { message } = req.body || {};
    const leads = leadsStore.get(req.user.id) || buildDefaultLeads();
    const lead = leads.find((item) => item.id === leadId);
    if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
    }
    return res.json({
        success: true,
        leadId,
        message: message || 'Message queued for delivery',
        status: 'queued'
    });
};

const getFavorites = async (req, res) => {
    const existing = favoritesStore.get(req.user.id);
    if (!existing) {
        const defaults = buildDefaultFavorites();
        favoritesStore.set(req.user.id, defaults);
        return res.json(defaults);
    }
    return res.json(existing);
};

const addFavorite = async (req, res) => {
    const { displayName, notes } = req.body || {};
    if (!displayName) {
        return res.status(400).json({ error: 'displayName is required' });
    }
    const existing = favoritesStore.get(req.user.id) || [];
    const newItem = {
        id: `fav-${Date.now()}`,
        display_name: displayName,
        notes: notes || '',
        last_session: null
    };
    const updated = [newItem, ...existing];
    favoritesStore.set(req.user.id, updated);
    return res.status(201).json(newItem);
};

const removeFavorite = async (req, res) => {
    const { favoriteId } = req.params;
    const existing = favoritesStore.get(req.user.id) || [];
    const updated = existing.filter((item) => item.id !== favoriteId);
    favoritesStore.set(req.user.id, updated);
    return res.json({ success: true });
};

const searchEmployees = async (req, res) => {
    try {
        const queryText = String(req.query.q || '').trim();
        if (!queryText) {
            return res.json([]);
        }

        const result = await query(
            `SELECT
                u.id,
                u.display_name,
                u.occupation,
                json_build_object(
                    'id', c.id,
                    'name', c.name
                ) as workplace
             FROM users u
             LEFT JOIN companies c ON u.workplace_id = c.id
             WHERE u.role = 'employee'
               AND u.display_name ILIKE $1
             ORDER BY u.display_name
             LIMIT 8`,
            [`%${queryText}%`]
        );

        return res.json(result.rows);
    } catch (error) {
        console.error('Employee search error:', error);
        return res.status(500).json({ error: 'Failed to search employees' });
    }
};

module.exports = {
    getDashboardPermissions,
    getSchedule,
    addScheduleItem,
    getLeads,
    sendLeadMessage,
    getFavorites,
    addFavorite,
    removeFavorite,
    searchEmployees
};
