import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import Loading from '../components/common/Loading';

const OAuthCallback = () => {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const { checkAuth } = useAuth();

    useEffect(() => {
        const token = params.get('token');
        const redirect = params.get('redirect') || sessionStorage.getItem('oauth_redirect') || '/';
        if (!token) {
            navigate('/login', { replace: true, state: { message: 'Social login failed. Please try again.' } });
            return;
        }
        sessionStorage.removeItem('oauth_redirect');
        localStorage.setItem('token', token);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        Promise.resolve(checkAuth?.()).finally(() => {
            navigate(redirect, { replace: true });
        });
    }, [params, navigate, checkAuth]);

    return <Loading />;
};

export default OAuthCallback;
