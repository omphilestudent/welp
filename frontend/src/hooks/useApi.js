
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export const useApi = (baseUrl, method = 'get') => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const execute = async (body = null, params = null, showToast = false, id = null) => {
        setLoading(true);
        setError(null);

        try {

            let url = baseUrl;
            if (id) {
                url = `${baseUrl}/${id}`;
            }

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

            if (err.response?.status === 401) {
                toast.error('Session expired. Please login again.');
                navigate('/login');
                return { success: false, error: 'Unauthorized' };
            }

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