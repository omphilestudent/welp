import api from './api';

const KODI_PAGE_TOKEN_KEY = 'kodi_page_token';

export const setKodiPageToken = (token) => {
    if (!token) {
        localStorage.removeItem(KODI_PAGE_TOKEN_KEY);
        return;
    }
    localStorage.setItem(KODI_PAGE_TOKEN_KEY, token);
};

export const getKodiPageToken = () => localStorage.getItem(KODI_PAGE_TOKEN_KEY);

export const kodiPageLogin = async ({ pageSlug, username, password }) => {
    const { data } = await api.post('/kodi/access/login', { pageSlug, username, password });
    return data;
};

export const fetchKodiPageBundle = async (pageSlug) => {
    const token = getKodiPageToken();
    const { data } = await api.get(`/kodi/access/${encodeURIComponent(pageSlug)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return data;
};

// Admin endpoints (platform JWT required)
export const listKodiPages = async () => (await api.get('/kodi/pages')).data;
export const createKodiPage = async (payload) => (await api.post('/kodi/pages', payload)).data;
export const updateKodiPage = async (id, payload) => (await api.put(`/kodi/pages/${id}`, payload)).data;
export const deactivateKodiPage = async (id) => (await api.delete(`/kodi/pages/${id}`)).data;

export const listKCComponents = async () => (await api.get('/kodi/kc-components')).data;
export const createKCComponent = async (payload) => (await api.post('/kodi/kc-components', payload)).data;

const unwrap = (response) => {
    if (response?.success && response.data !== undefined) return response.data;
    return response;
};

export const listPlatformPages = async () => unwrap((await api.get('/kodi/platform/pages')).data);
export const createPlatformPage = async (payload) => unwrap((await api.post('/kodi/platform/pages', payload)).data);
export const updatePlatformLayout = async (pageId, layout) =>
    unwrap((await api.put(`/kodi/platform/pages/${pageId}/layout`, { layout })).data);
export const activatePlatformPage = async (pageId) =>
    unwrap((await api.post(`/kodi/platform/pages/${pageId}/activate`)).data);
export const linkPlatformPage = async (pageId, appId) =>
    unwrap((await api.post(`/kodi/platform/pages/${pageId}/link`, { appId })).data);
export const listPlatformApps = async () => unwrap((await api.get('/kodi/platform/apps')).data);
export const createPlatformApp = async (payload) => unwrap((await api.post('/kodi/platform/apps', payload)).data);
export const updatePlatformApp = async (appId, payload) =>
    unwrap((await api.put(`/kodi/platform/apps/${appId}`, payload)).data);
export const listPagePermissions = async (pageId) =>
    unwrap((await api.get(`/kodi/platform/pages/${pageId}/permissions`)).data);
export const updatePagePermissions = async (pageId, payload) =>
    unwrap((await api.post(`/kodi/platform/pages/${pageId}/permissions`, payload)).data);
export const fetchRuntimePage = async (pageId) =>
    unwrap((await api.get(`/kodi/platform/runtime/${pageId}`)).data);
export const listAppUsers = async (appId) =>
    unwrap((await api.get(`/kodi/platform/apps/${appId}/users`)).data);
export const assignAppUser = async (appId, payload) =>
    unwrap((await api.post(`/kodi/platform/apps/${appId}/users`, payload)).data);
export const listPageUsers = async (pageId) =>
    unwrap((await api.get(`/kodi/platform/pages/${pageId}/users`)).data);
export const assignPageUser = async (pageId, payload) =>
    unwrap((await api.post(`/kodi/platform/pages/${pageId}/users`, payload)).data);
export const listPlatformObjects = async () => unwrap((await api.get('/kodi/platform/objects')).data);
export const createPlatformObject = async (payload) => unwrap((await api.post('/kodi/platform/objects', payload)).data);
export const listPlatformObjectFields = async (objectId) =>
    unwrap((await api.get(`/kodi/platform/objects/${objectId}/fields`)).data);
export const createPlatformField = async (objectId, payload) =>
    unwrap((await api.post(`/kodi/platform/objects/${objectId}/fields`, payload)).data);
export const listLeads = async () => unwrap((await api.get('/kodi/platform/leads')).data);
export const createLead = async (payload) => unwrap((await api.post('/kodi/platform/leads', payload)).data);
export const convertLead = async (leadId, payload) =>
    unwrap((await api.post(`/kodi/platform/leads/${leadId}/convert`, payload)).data);
export const listLeadOpportunities = async (leadId) =>
    unwrap((await api.get(`/kodi/platform/leads/${leadId}/opportunities`)).data);
export const listPlatformComponents = async () => unwrap((await api.get('/kodi/platform/components')).data);
