import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Loading from '../components/common/Loading';

const GoogleOAuthRedirect = () => {
    const location = useLocation();

    useEffect(() => {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const backendBase = apiBase.replace(/\/api\/?$/, '');
        const target = `${backendBase}/auth/google/callback${location.search || ''}`;
        window.location.replace(target);
    }, [location.search]);

    return <Loading />;
};

export default GoogleOAuthRedirect;