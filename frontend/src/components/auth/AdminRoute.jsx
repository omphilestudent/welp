// frontend/src/components/auth/AdminRoute.jsx
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
        try {
            // Check if user has admin access
            await api.get('/admin/profile');
            setIsAdmin(true);
        } catch (error) {
            console.log('Not an admin user');
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
        return <Navigate to="/login" />;
    }

    if (!isAdmin) {
        return <Navigate to="/" />;
    }

    return children;
};

export default AdminRoute;