
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const AUTH_REDIRECT_EXCLUDED_ROUTES = ['/auth/me', '/auth/login', '/auth/register', '/auth/logout'];

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});


api.interceptors.request.use(
    (config) => {
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);


api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const requestUrl = error.config?.url || '';
            const isAuthFlowRoute = AUTH_REDIRECT_EXCLUDED_ROUTES.some((route) => requestUrl.includes(route));


            if (!isAuthFlowRoute) {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
