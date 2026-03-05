
import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const AdminRoute = ({ children }) => {
    const { user, loading: authLoading } = useAuth();
    const [isAdmin, setIsAdmin] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const checkAdminStatus = async () => {
            if (authLoading) {
                return;
            }

            if (!user) {
                setIsAdmin(false);
                setLoading(false);
                return;
            }

            setLoading(true);

            try {
                await api.get('/admin/profile', { skipAuthRedirect: true });
                setIsAdmin(true);
            } catch (error) {
                setIsAdmin(false);
            } finally {
                setLoading(false);
            }
        };

        checkAdminStatus();
    }, [user, authLoading]);

    if (authLoading || loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Checking permissions...</p>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    if (!isAdmin) {
        console.log('User is not admin, redirecting to home');
        return <Navigate to="UserManagement" />;
    }

    return children;
};

export default AdminRoute;
