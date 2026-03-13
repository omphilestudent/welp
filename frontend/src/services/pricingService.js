import api from './api';

export const fetchCountries = async () => {
    const { data } = await api.get('/pricing/countries');
    return Array.isArray(data) ? data : [];
};

export const fetchPricingByAudience = async (audience = 'user', { currency, country } = {}) => {
    const params = {};
    if (currency) params.currency = currency;
    if (country) params.country = country;
    const { data } = await api.get(`/pricing/${audience}`, { params });
    return data;
};
