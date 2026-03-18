import api from './api';

const unwrap = (payload) => (payload?.success ? payload.data : payload);

export const listTemplates = async () => unwrap((await api.get('/admin/marketing/templates')).data);
export const getTemplate = async (id) => unwrap((await api.get(`/admin/marketing/templates/${id}`)).data);
export const createTemplate = async (payload) => unwrap((await api.post('/admin/marketing/templates', payload)).data);
export const updateTemplate = async (id, payload) => unwrap((await api.put(`/admin/marketing/templates/${id}`, payload)).data);
export const previewTemplate = async (id, payload) =>
    unwrap((await api.post(`/admin/marketing/templates/${id}/preview`, payload)).data);

export const listCampaigns = async () => unwrap((await api.get('/admin/marketing/campaigns')).data);
export const createCampaign = async (payload) => unwrap((await api.post('/admin/marketing/campaigns', payload)).data);
export const updateCampaign = async (id, payload) => unwrap((await api.put(`/admin/marketing/campaigns/${id}`, payload)).data);
export const runCampaign = async (id) => unwrap((await api.post(`/admin/marketing/campaigns/${id}/run`)).data);

export const listTriggers = async () => unwrap((await api.get('/admin/marketing/triggers')).data);
export const updateTrigger = async (triggerKey, payload) =>
    unwrap((await api.put(`/admin/marketing/triggers/${triggerKey}`, payload)).data);

export const listLogs = async (params = {}) => unwrap((await api.get('/admin/marketing/logs', { params })).data);
export const getSettings = async () => unwrap((await api.get('/admin/marketing/settings')).data);
export const updateSettings = async (payload) => unwrap((await api.put('/admin/marketing/settings', payload)).data);
