import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const INACTIVITY_LOGOUT_FLAG = 'welp_inactivity_logout';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true
});

const AUTH_FREE_PATHS = [
    '/auth/login',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/verify-email',
    '/auth/resend-verification',
    '/health'
];

const shouldSkipAuthHeader = (url = '') => AUTH_FREE_PATHS.some((path) => url.startsWith(path));

// Request interceptor to add token
api.interceptors.request.use(
    (config) => {
        const candidateKeys = ['token', 'admin_access', 'hr_access', 'access_token'];
        const rawToken = candidateKeys.map((key) => localStorage.getItem(key) || sessionStorage.getItem(key)).find(Boolean);
        const isJwt = typeof rawToken === 'string' && rawToken.split('.').length === 3;
        if (rawToken && !isJwt) {
            candidateKeys.forEach((key) => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            });
        }
        const token = isJwt ? rawToken : null;
        if (token && !shouldSkipAuthHeader(config.url || '')) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        console.log(`🚀 ${config.method.toUpperCase()} ${config.url}`, {
            data: config.data,
            params: config.params,
            headers: config.headers
        });

        return config;
    },
    (error) => {
        console.error('❌ Request error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor
api.interceptors.response.use(
    (response) => {
        console.log('✅ Response received:', {
            status: response.status,
            data: response.data,
            url: response.config.url
        });
        return response;
    },
    (error) => {
        console.error('❌ Response error:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            url: error.config?.url
        });

        // Handle 401 errors
        if (error.response?.status === 401) {
            const message = String(error.response?.data?.message || error.response?.data?.error || '');
            if (message.toLowerCase().includes('inactivity')) {
                localStorage.setItem(INACTIVITY_LOGOUT_FLAG, JSON.stringify({ reason: 'timeout', at: Date.now() }));
            }
            ['token', 'admin_access', 'hr_access', 'access_token'].forEach((key) => {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            });
            const path = window.location.pathname;
            const isKodiAuth = path.startsWith('/kodi-auth');
            const isLogin = path === '/login' || isKodiAuth;
            if (!isLogin) {
                if (path.startsWith('/kodi')) {
                    window.location.href = '/kodi-auth/sign-in';
                } else {
                    window.location.href = '/login';
                }
            }
        }

        return Promise.reject(error);
    }
);

export default api;
