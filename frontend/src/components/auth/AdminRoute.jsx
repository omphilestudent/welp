import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const AdminRoute = ({ children, requiredRole = 'admin' }) => {
    const { user, loading: authLoading } = useAuth();
    const [isAuthorized, setIsAuthorized] = useState(null);
    const [checking, setChecking] = useState(true);
    const userId = user?.id ?? null;
    const normalizedRole = useMemo(
        () => (user ? String(user.role || '').toLowerCase().trim() : ''),
        [user?.role]
    );

    useEffect(() => {
        let isMounted = true;

        const checkAuthorization = async () => {
            if (authLoading) {
                return;
            }

            if (!userId) {
                if (isMounted) {
                    setIsAuthorized(false);
                    setChecking(false);
                }
                return;
            }

            const userRole = normalizedRole;
            const adminRoles = ['admin', 'super_admin', 'administrator', 'superadmin', 'system_admin'];
            const hrRoles = ['hr_admin'];

            const roleAllowed = requiredRole === 'hr'
                ? hrRoles.includes(userRole)
                : adminRoles.includes(userRole);

            if (roleAllowed) {
                if (isMounted) {
                    setIsAuthorized(true);
                    setChecking(false);
                }
                return;
            }

            // If not admin by role, try API verification
            try {
                const profileEndpoint = requiredRole === 'hr' ? '/hr/profile' : '/admin/profile';
                await api.get(profileEndpoint, {
                    skipAuthRedirect: true  // This is key!
                });
                if (isMounted) {
                    setIsAuthorized(true);
                }
            } catch (error) {
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
    }, [userId, normalizedRole, authLoading, requiredRole]);

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
        return <Navigate to="/" replace />;
    }
    return children;
};

export default AdminRoute;
