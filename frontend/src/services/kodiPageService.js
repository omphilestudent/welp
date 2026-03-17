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

