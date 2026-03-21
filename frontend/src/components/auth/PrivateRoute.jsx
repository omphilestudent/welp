
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Loading from '../common/Loading';

const PrivateRoute = ({ children }) => {
    const { user, loading, pinStatus } = useAuth();

    if (loading) {
        return <Loading />;
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    if (pinStatus?.setupRequired) {
        return <Navigate to="/remote-pin/setup" />;
    }

    if (pinStatus?.required && !pinStatus?.verified) {
        return <Navigate to="/remote-pin/verify" />;
    }

    return children;
};

export default PrivateRoute;
