const ROLE_FLAGS = {
    psychologist: {
        dashboard: true,
        leads: true,
        schedule: true,
        favorites: true,
        employee_search: true,
        message_request: true,
        review_private_message: true,
        conversation_approval: true,
        voice_video_calls: true,
        encrypted_messages: true,
        plan: 'free',
        call_minutes_per_client: 120
    },
    employee: {
        conversation_approval: true
    },
    business: {},
    admin: {},
    super_admin: {},
    hr_admin: {}
};

const getRoleFlags = (role) => ROLE_FLAGS[role] || {};

const checkRoleFlag = (flag) => (req, res, next) => {
    const flags = req.user?.role_flags || {};
    if (!flags[flag]) {
        return res.status(403).json({ error: 'Permission denied' });
    }
    return next();
};

module.exports = {
    ROLE_FLAGS,
    getRoleFlags,
    checkRoleFlag
};
