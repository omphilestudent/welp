import api from './api';

export const fetchSubscription = () => {
    return api.get('/subscription/status');
};

export const upgradeSubscription = ({ planCode = 'user_premium', currency = 'USD', durationDays } = {}) => {
    return api.post('/subscription/upgrade', { planCode, currency, durationDays });
};

export const cancelSubscription = () => {
    return api.post('/subscription/cancel');
};
