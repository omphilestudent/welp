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
        Promise.resolve(checkAuth?.())
            .then(async () => {
                try {
                    const { data } = await api.get('/auth/me');
                    if (data?.pinSetupRequired) {
                        sessionStorage.setItem('welp_pin_redirect', redirect);
                        navigate('/remote-pin/setup', { replace: true });
                        return;
                    }
                    if (data?.pinRequired && !data?.pinVerified) {
                        sessionStorage.setItem('welp_pin_redirect', redirect);
                        navigate('/remote-pin/verify', { replace: true });
                        return;
                    }
                } catch (error) {
                    // fall back to redirect
                }
                navigate(redirect, { replace: true });
            })
            .catch(() => {
                navigate(redirect, { replace: true });
            });
    }, [params, navigate, checkAuth]);

    return <Loading />;
};

export default OAuthCallback;
