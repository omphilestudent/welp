import api from './api';

export const listCampaigns = (params = {}) => {
    return api.get('/ads', { params });
};

export const getMyCampaigns = () => {
    return api.get('/ads/me');
};

export const createCampaign = (formData) => {
    return api.post('/ads', formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
};

export const updateCampaign = (campaignId, formData) => {
    return api.put(`/ads/${campaignId}`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    });
};

export const deleteCampaign = (campaignId) => {
    return api.delete(`/ads/${campaignId}`);
};

export const fetchPlacementAds = ({ placement, location, industry, behaviors } = {}) => {
    const params = {
        placement,
        location,
        industry,
        behaviors: Array.isArray(behaviors) ? behaviors.join(',') : behaviors
    };
    return api.get('/ads/placement', { params });
};

export const recordImpression = (campaignId) => {
    return api.post(`/ads/${campaignId}/impression`);
};

export const recordClick = (campaignId) => {
    return api.post(`/ads/${campaignId}/click`);
};

export const adminListAds = (params = {}) => {
    return api.get('/admin/ads', { params });
};

export const adminApproveAd = (payload) => {
    return api.post('/admin/ads/approve', payload);
};

export const adminRejectAd = (payload) => {
    return api.post('/admin/ads/reject', payload);
};
