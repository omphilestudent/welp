// src/hooks/useApi.js
import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';

export const useApi = (url, method = 'get') => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const execute = async (body = null, params = null, showToast = false) => {
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
            if (showToast) {
                toast.success('Operation completed successfully!');
            }
            return { success: true, data: response.data };
        } catch (err) {
            const errorMessage = err.response?.data?.error || 'An error occurred';
            setError(errorMessage);
            if (showToast) {
                toast.error(errorMessage);
            }
            return { success: false, error: errorMessage };
        } finally {
            setLoading(false);
        }
    };

    return { data, loading, error, execute };
};