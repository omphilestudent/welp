import api from './api';

const ADS_BASE = '/ads';
const ADMIN_BASE = `${ADS_BASE}/admin`;

export const listCampaigns = (params = {}) => api.get(ADS_BASE, { params });

export const getMyCampaigns = () => api.get(`${ADS_BASE}/me`);
export const getAdPricing = () => api.get(`${ADS_BASE}/pricing`);
export const getMyAdInvoices = () => api.get(`${ADS_BASE}/invoices`);
export const downloadAdInvoice = (invoiceId) => api.get(`${ADS_BASE}/invoices/${invoiceId}/download`, {
    responseType: 'blob'
});

export const createCampaign = (formData) =>
    api.post(ADS_BASE, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });

export const updateCampaign = (campaignId, formData) =>
    api.put(`${ADS_BASE}/${campaignId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });

export const deleteCampaign = (campaignId) => api.delete(`${ADS_BASE}/${campaignId}`);

export const fetchPlacementAds = ({ placement, location, industry, behaviors } = {}) => {
    const params = {
        placement,
        location,
        industry,
        behaviors: Array.isArray(behaviors) ? behaviors.join(',') : behaviors
    };
    return api.get(`${ADS_BASE}/placement`, { params });
};

export const recordImpression = (campaignId) => api.post(`${ADS_BASE}/${campaignId}/impression`);

export const recordClick = (campaignId) => api.post(`${ADS_BASE}/${campaignId}/click`);

// ==================== Admin APIs ====================

export const adminListAds = (params = {}) => api.get(`${ADMIN_BASE}/list`, { params });

export const adminGetStats = (params = {}) => api.get(`${ADMIN_BASE}/stats`, { params });

export const adminGetAdDetails = (campaignId) => api.get(`${ADMIN_BASE}/${campaignId}`);

export const adminGetAdAnalytics = (campaignId, params = {}) =>
    api.get(`${ADMIN_BASE}/${campaignId}/analytics`, { params });

export const adminApproveAd = (payload) => api.post(`${ADMIN_BASE}/approve`, payload);

export const adminRejectAd = (payload) => api.post(`${ADMIN_BASE}/reject`, payload);

export const adminBulkApproveAds = (payload) => api.post(`${ADMIN_BASE}/bulk-approve`, payload);

export const adminBulkRejectAds = (payload) => api.post(`${ADMIN_BASE}/bulk-reject`, payload);

export const adminListAdFailures = (params = {}) =>
    api.get(`${ADMIN_BASE}/failures`, { params });

export const adminPauseAd = (campaignId) => api.post(`${ADMIN_BASE}/${campaignId}/pause`);

export const adminResumeAd = (campaignId) => api.post(`${ADMIN_BASE}/${campaignId}/resume`);
export const adminRemoveAd = (campaignId, reason) => api.post(`${ADMIN_BASE}/${campaignId}/remove`, { reason });

export const adminFeatureAd = (campaignId, featured = true) =>
    api.post(`${ADMIN_BASE}/${campaignId}/feature`, { featured });

export const adminDeleteAd = (campaignId) => api.delete(`${ADMIN_BASE}/${campaignId}`);
