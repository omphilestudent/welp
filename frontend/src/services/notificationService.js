import api from './api';

export const updateNotificationPreference = async (state) => {
    if (!state || state === 'unsupported') {
        return false;
    }
    try {
        await api.post('/notifications/permission', { state });
        return true;
    } catch (error) {
        console.warn('Failed to sync notification preference:', error?.message || error);
        return false;
    }
};
