import api from './api';

export const fetchSubscription = () => {
    return api.get('/subscriptions/me');
};

export const upgradeSubscription = ({ planCode = 'user_premium', currency = 'USD', durationDays } = {}) => {
    return api.post('/subscriptions/plan', { planCode, currency, durationDays });
};

export const cancelSubscription = () => {
    return api.post('/subscriptions/cancel');
};
