// frontend/src/pages/admin/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Link } from 'react-router-dom';
import { FaUsers, FaBuilding, FaStar, FaDollarSign, FaClipboardList, FaShieldAlt } from 'react-icons/fa';

const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const { data } = await api.get('/admin/dashboard/stats');
            setStats(data);
        } catch (error) {
            console.error('Failed to fetch stats');
        } finally {
            setLoading(false);
        }
    };

    const statCards = [
        { title: 'Total Users', value: stats?.totalUsers || 0, icon: <FaUsers />, color: '#4299e1', link: '/admin/users' },
        { title: 'Companies', value: stats?.totalCompanies || 0, icon: <FaBuilding />, color: '#48bb78', link: '/admin/companies' },
        { title: 'Reviews', value: stats?.totalReviews || 0, icon: <FaStar />, color: '#ed8936', link: '/admin/reviews' },
        { title: 'Revenue', value: `$${stats?.revenue || 0}`, icon: <FaDollarSign />, color: '#9f7aea', link: '/admin/subscriptions' },
        { title: 'Subscriptions', value: stats?.activeSubscriptions || 0, icon: <FaClipboardList />, color: '#f687b3', link: '/admin/subscriptions' },
        { title: 'Pending Reviews', value: stats?.pendingReviews || 0, icon: <FaShieldAlt />, color: '#fc8181', link: '/admin/reviews?pending=true' }
    ];

    return (
        <div className="admin-dashboard">
            <h1>Admin Dashboard</h1>

            <div className="stats-grid">
                {statCards.map((stat, index) => (
                    <Link to={stat.link} key={index} className="stat-card" style={{ borderTopColor: stat.color }}>
                        <div className="stat-icon" style={{ color: stat.color }}>{stat.icon}</div>
                        <div className="stat-content">
                            <h3>{stat.title}</h3>
                            <p className="stat-value">{stat.value}</p>
                        </div>
                    </Link>
                ))}
            </div>

            <div className="dashboard-sections">
                <div className="recent-section">
                    <h2>Recent Users</h2>
                    {/* Add recent users list */}
                </div>

                <div className="recent-section">
                    <h2>Recent Reviews</h2>
                    {/* Add recent reviews list */}
                </div>

                <div className="recent-section">
                    <h2>Pending Actions</h2>
                    {/* Add pending actions list */}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;