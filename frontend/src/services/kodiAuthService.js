import api from './api';

export const kodiAuthSignIn = async (payload) => (await api.post('/kodi-auth/sign-in', payload)).data;
export const kodiAuthFirstLogin = async (payload) => (await api.post('/kodi-auth/first-login', payload)).data;
