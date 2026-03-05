
import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import Loading from '../common/Loading';

const AdminRoute = ({ children }) => {
    const { user } = useAuth();
    const [isAdmin, setIsAdmin] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkAdminStatus();
    }, []);

    const checkAdminStatus = async () => {
        console.log('Checking admin status for user:', user);

        if (!user) {
            console.log('No user found, redirecting to login');
            setIsAdmin(false);
            setLoading(false);
            return;
        }

        try {

            await api.get('/admin/profile');
            console.log('Admin profile found - user is admin');
            setIsAdmin(true);
        } catch (error) {
            console.log('Not an admin user:', error.response?.data || error.message);
            setIsAdmin(false);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Checking permissions...</p>
            </div>
        );
    }

    if (!user) {
        console.log('No user, redirecting to login');
        return <Navigate to="/login" />;
    }

    if (!isAdmin) {
        console.log('User is not admin, redirecting to home');
        return <Navigate to="UserManagement" />;
    }

    console.log('Admin access granted');
    return children;
};

export default AdminRoute;