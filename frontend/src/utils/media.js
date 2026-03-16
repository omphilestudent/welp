import api from '../services/api';

const stripApiSuffix = (value = '') => value.replace(/\/api\/?$/, '').replace(/\/+$/, '');

const getMediaBase = () => {
    const mediaEnv = import.meta.env.VITE_MEDIA_URL;
    const apiEnv = import.meta.env.VITE_API_URL;
    const axiosBase = api?.defaults?.baseURL;
    const browserOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const fallback = 'http://localhost:5000/api';

    const candidate = mediaEnv || axiosBase || apiEnv || browserOrigin || fallback;
    return stripApiSuffix(candidate);
};

export const resolveMediaUrl = (url) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url) || url.startsWith('data:')) {
        return url;
    }
    const base = getMediaBase();
    if (!base) return url;
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};
