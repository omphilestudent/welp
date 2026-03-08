// services/api.js
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true // Important for cookies/sessions
});

// Add request interceptor for debugging
api.interceptors.request.use(
    (config) => {
        console.log(`🚀 ${config.method.toUpperCase()} request to: ${config.baseURL}${config.url}`);
        console.log('Request data:', config.data);
        return config;
    },
    (error) => {
        console.error('Request error:', error);
        return Promise.reject(error);
    }
);

// Add response interceptor for debugging
api.interceptors.response.use(
    (response) => {
        console.log('✅ Response received:', response.data);
        return response;
    },
    (error) => {
        if (error.code === 'ERR_NETWORK') {
            console.error('❌ Network error - Backend may be down or unreachable');
            console.error('Please check if backend is running on:', API_URL);
        } else if (error.response) {
            console.error('❌ Error response:', error.response.status, error.response.data);
        } else {
            console.error('❌ Error:', error.message);
        }
        return Promise.reject(error);
    }
);

export default api;