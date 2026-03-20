import api from './api';

const unwrap = (response) => {
    if (response?.success && response.data !== undefined) return response.data;
    return response;
};

export const listPortalApps = async () => unwrap((await api.get('/kodi/portal/apps')).data);
export const getPortalApp = async (appId) => unwrap((await api.get(`/kodi/portal/apps/${appId}`)).data);
export const createPortalApp = async (payload) => unwrap((await api.post('/kodi/portal/apps', payload)).data);
export const updatePortalApp = async (appId, payload) => unwrap((await api.patch(`/kodi/portal/apps/${appId}`, payload)).data);
export const activatePortalApp = async (appId) => unwrap((await api.post(`/kodi/portal/apps/${appId}/activate`)).data);
export const deactivatePortalApp = async (appId) => unwrap((await api.post(`/kodi/portal/apps/${appId}/deactivate`)).data);
export const getPortalSettings = async (appId) => unwrap((await api.get(`/kodi/portal/apps/${appId}/settings`)).data);
export const updatePortalSettings = async (appId, payload) =>
    unwrap((await api.patch(`/kodi/portal/apps/${appId}/settings`, payload)).data);
export const listPortalUtilities = async (appId) => unwrap((await api.get(`/kodi/portal/apps/${appId}/utilities`)).data);
export const updatePortalUtilities = async (appId, payload) =>
    unwrap((await api.put(`/kodi/portal/apps/${appId}/utilities`, payload)).data);

export const listPortalUsers = async (appId) => unwrap((await api.get(`/kodi/portal/apps/${appId}/users`)).data);
export const assignPortalUser = async (appId, payload) => unwrap((await api.post(`/kodi/portal/apps/${appId}/users`, payload)).data);
export const updatePortalUser = async (appId, userId, payload) =>
    unwrap((await api.patch(`/kodi/portal/apps/${appId}/users/${userId}`, payload)).data);
export const updatePortalUserStatus = async (appId, userId, payload) =>
    unwrap((await api.patch(`/kodi/portal/apps/${appId}/users/${userId}/status`, payload)).data);
export const resendPortalInvite = async (appId, userId) =>
    unwrap((await api.post(`/kodi/portal/apps/${appId}/users/${userId}/resend-invite`)).data);
export const deletePortalUser = async (appId, userId) =>
    unwrap((await api.delete(`/kodi/portal/apps/${appId}/users/${userId}`)).data);

export const listPortalPages = async (appId) => unwrap((await api.get(`/kodi/portal/apps/${appId}/pages`)).data);
export const listActivatedPages = async () => unwrap((await api.get('/kodi/portal/pages/activated')).data);
export const linkPortalPage = async (appId, payload) => unwrap((await api.post(`/kodi/portal/apps/${appId}/pages`, payload)).data);
export const updatePortalPage = async (appId, mappingId, payload) =>
    unwrap((await api.patch(`/kodi/portal/apps/${appId}/pages/${mappingId}`, payload)).data);
export const deletePortalPage = async (appId, mappingId) =>
    unwrap((await api.delete(`/kodi/portal/apps/${appId}/pages/${mappingId}`)).data);
export const reorderPortalPages = async (appId, payload) =>
    unwrap((await api.post(`/kodi/portal/apps/${appId}/pages/reorder`, payload)).data);

export const getPortalNavigation = async (appId, role) =>
    unwrap((await api.get(`/kodi/portal/apps/${appId}/navigation`, { params: { role } })).data);

export const acceptPortalInvite = async (payload) => unwrap((await api.post('/kodi/portal/invitations/accept', payload)).data);
export const listUserApps = async () => unwrap((await api.get('/kodi/portal/user/apps')).data);
