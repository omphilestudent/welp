import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const ROLE_PROFILE_ENDPOINTS = {
    admin: '/admin/profile',
    hr: '/hr/profile'
};

const LOCAL_ROLE_ACCESS = {
    admin: ['admin', 'super_admin'],
    hr: ['hr', 'hr_admin', 'admin', 'super_admin']
};

const AdminRoute = ({ children, requiredRole = 'admin' }) => {
    const { user, loading: authLoading } = useAuth();
    const [hasAccess, setHasAccess] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const checkAccess = async () => {
            if (authLoading) {
                return;
            }

            if (!user) {
                setHasAccess(false);
                setLoading(false);
                return;
            }

            const normalizedRole = user.role?.toLowerCase();
            const allowedLocalRoles = LOCAL_ROLE_ACCESS[requiredRole] || [];

            if (normalizedRole && allowedLocalRoles.includes(normalizedRole)) {
                setHasAccess(true);
                setLoading(false);
                return;
            }

            const profileEndpoint = ROLE_PROFILE_ENDPOINTS[requiredRole] || ROLE_PROFILE_ENDPOINTS.admin;
            setLoading(true);

            try {
                await api.get(profileEndpoint, { skipAuthRedirect: true });
                setHasAccess(true);
            } catch (error) {
                setHasAccess(false);
            } finally {
                setLoading(false);
            }
        };

        checkAccess();
    }, [user, authLoading, requiredRole]);

    if (authLoading || loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Checking permissions...</p>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!hasAccess) {
        console.log(`User does not have ${requiredRole} access, redirecting to home`);
        return <Navigate to="/" replace />;
    }

    return children;
};

export default AdminRoute;
