// frontend/src/hooks/useApi.js
import { useState } from 'react';
import api from '../services/api';

export const useApi = (url, method = 'get') => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const execute = async (body = null, params = null) => {
        setLoading(true);
        setError(null);

        try {
            const response = await api({
                method,
                url,
                data: body,
                params,
            });
            setData(response.data);
            return { success: true, data: response.data };
        } catch (err) {
            setError(err.response?.data?.error || 'An error occurred');
            return { success: false, error: err.response?.data?.error };
        } finally {
            setLoading(false);
        }
    };

    return { data, loading, error, execute };
};