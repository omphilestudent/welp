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

export const fetchPricingForAudience = ({ audience = 'user', country, currency } = {}) => {
    const params = {};
    if (country) params.country = country;
    if (currency) params.currency = currency;
    return api.get(`/pricing/${audience}`, { params });
};
