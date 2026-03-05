import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const ROLE_PROFILE_ENDPOINTS = {
    admin: '/admin/profile',
    hr: '/hr/profile',
    user: '/user/profile' // Added for completeness
};

const CLIENT_ROLE_ACCESS = {
    admin: ['admin', 'super_admin', 'administrator', 'superadmin'], // Added more variations
    hr: ['hr', 'hr_admin', 'hr-manager', 'admin', 'super_admin'],
    user: ['user', 'customer', 'member'] // For regular users
};

const AdminRoute = ({ children, requiredRole = 'admin' }) => {
    const { user, loading: authLoading } = useAuth();
    const [hasAccess, setHasAccess] = useState(null);
    const [loading, setLoading] = useState(false);
    const [debug, setDebug] = useState({});

    useEffect(() => {
        const checkAccess = async () => {
            // Debug logging
            console.log('=== AdminRoute Debug ===');
            console.log('User object:', user);
            console.log('User role:', user?.role);
            console.log('Required role:', requiredRole);
            console.log('Auth loading:', authLoading);

            setDebug({
                userRole: user?.role,
                requiredRole,
                timestamp: new Date().toISOString()
            });

            if (authLoading) {
                console.log('Auth still loading...');
                return;
            }

            if (!user) {
                console.log('No user found, redirecting to login');
                setHasAccess(false);
                setLoading(false);
                return;
            }

            // Normalize the user role
            const normalizedUserRole = String(user.role || '').toLowerCase().trim();
            const allowedClientRoles = CLIENT_ROLE_ACCESS[requiredRole] || [];

            console.log('Normalized user role:', normalizedUserRole);
            console.log('Allowed client roles:', allowedClientRoles);

            // Check if user role matches allowed roles
            if (allowedClientRoles.includes(normalizedUserRole)) {
                console.log('User role matches allowed roles - granting access');
                setHasAccess(true);
                setLoading(false);
                return;
            }

            // If role doesn't match, try API verification
            const profileEndpoint = ROLE_PROFILE_ENDPOINTS[requiredRole] || ROLE_PROFILE_ENDPOINTS.admin;
            console.log('Trying API verification at:', profileEndpoint);
            setLoading(true);

            try {
                const response = await api.get(profileEndpoint, { skipAuthRedirect: true });
                console.log('API verification successful:', response.data);
                setHasAccess(true);
            } catch (error) {
                console.error('API verification failed:', error);
                console.log('Error response:', error.response?.data);
                console.log('Error status:', error.response?.status);
                setHasAccess(false);
            } finally {
                setLoading(false);
            }
        };

        checkAccess();
    }, [user, authLoading, requiredRole]);

    // Render debug info in development
    if (process.env.NODE_ENV === 'development') {
        console.log('Current access state:', hasAccess);
        console.log('Loading state:', loading);
    }

    if (authLoading || loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Checking permissions...</p>
                {process.env.NODE_ENV === 'development' && (
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                        <pre>Debug: {JSON.stringify(debug, null, 2)}</pre>
                    </div>
                )}
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