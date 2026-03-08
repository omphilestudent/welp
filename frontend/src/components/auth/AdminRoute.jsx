import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const AdminRoute = ({ children, requiredRole = 'admin' }) => {
    const { user, loading: authLoading } = useAuth();
    const [isAuthorized, setIsAuthorized] = useState(null);
    const [checking, setChecking] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        let isMounted = true;

        const checkAuthorization = async () => {
            console.log('=== AdminRoute Check ===');
            console.log('User:', user);
            console.log('User role:', user?.role);

            if (authLoading) {
                console.log('Auth still loading...');
                return;
            }

            if (!user) {
                console.log('No user - redirect to login');
                if (isMounted) {
                    setIsAuthorized(false);
                    setChecking(false);
                }
                return;
            }

            // Check if user has admin role
            const adminRoles = ['admin', 'super_admin', 'administrator', 'superadmin'];
            const userRole = String(user.role || '').toLowerCase().trim();

            if (adminRoles.includes(userRole)) {
                console.log('User has admin role - authorized');
                if (isMounted) {
                    setIsAuthorized(true);
                    setChecking(false);
                }
                return;
            }

            // If not admin by role, try API verification
            try {
                console.log('Checking admin access via API...');
                // Use skipAuthRedirect to prevent automatic redirect
                await api.get('/admin/profile', {
                    skipAuthRedirect: true  // This is key!
                });
                console.log('API check passed - authorized');
                if (isMounted) {
                    setIsAuthorized(true);
                }
            } catch (error) {
                console.log('API check failed:', error.response?.status);
                console.log('Access denied - not authorized');
                if (isMounted) {
                    setIsAuthorized(false);
                }
            } finally {
                if (isMounted) {
                    setChecking(false);
                }
            }
        };

        checkAuthorization();

        return () => {
            isMounted = false;
        };
    }, [user, authLoading, navigate]);

    if (authLoading || checking) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh'
            }}>
                <div>
                    <div className="spinner"></div>
                    <p style={{ marginTop: '20px' }}>
                        {authLoading ? 'Loading user...' : 'Checking permissions...'}
                    </p>
                </div>
            </div>
        );
    }

    if (!user) {
        console.log('Redirecting to login - no user');
        return <Navigate to="/login" replace />;
    }

    if (!isAuthorized) {
        console.log('Redirecting to home - not authorized');
        return <Navigate to="/" replace />;
    }

    console.log('Access granted - rendering children');
    return children;
};

export default AdminRoute;