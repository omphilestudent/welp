import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Link } from 'react-router-dom';
import {
    FaUsers,
    FaBuilding,
    FaStar,
    FaDollarSign,
    FaClipboardList,
    FaShieldAlt,
    FaArrowUp,
    FaArrowDown,
    FaCalendarAlt,
    FaChartLine,
    FaUserPlus,
    FaFileInvoice,
    FaExclamationTriangle
} from 'react-icons/fa';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

const AdminDashboard = () => {
    const [stats, setStats] = useState({
        totalUsers: 0,
        newUsersToday: 0,
        totalCompanies: 0,
        totalReviews: 0,
        pendingReviews: 0,
        activeSubscriptions: 0,
        monthlyRevenue: 0,
        revenueGrowth: 0,
        userGrowth: 0
    });
    const [recentUsers, setRecentUsers] = useState([]);
    const [recentReviews, setRecentReviews] = useState([]);
    const [revenueData, setRevenueData] = useState([]);
    const [userActivity, setUserActivity] = useState([]);
    const [subscriptionData, setSubscriptionData] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    // Helper function to safely format dates
    const safeFormatDate = (dateString, defaultValue = '-') => {
        if (!dateString) return defaultValue;
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return defaultValue;
            return date.toLocaleDateString();
        } catch (e) {
            return defaultValue;
        }
    };

    // Helper function to safely format currency
    const safeFormatCurrency = (value) => {
        if (value === undefined || value === null) return '$0';
        try {
            return `$${Number(value).toLocaleString()}`;
        } catch (e) {
            return '$0';
        }
    };

    // Helper function to safely truncate text
    const safeTruncate = (text, maxLength = 30) => {
        if (!text || typeof text !== 'string') return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const [dashboardRes, usersRes, reviewsRes, revenueRes, userAnalyticsRes, subscriptionAnalyticsRes] = await Promise.all([
                api.get('/admin/dashboard/stats'),
                api.get('/admin/users', { params: { page: 1, limit: 5 } }),
                api.get('/admin/reviews', { params: { page: 1, limit: 5 } }),
                api.get('/admin/analytics/revenue', { params: { period: 'day' } }),
                api.get('/admin/analytics/users'),
                api.get('/admin/analytics/subscriptions')
            ]);

            // Safely extract dashboard stats
            const dashboard = dashboardRes.data || {};
            setStats({
                totalUsers: Number(dashboard.users?.total_users || 0),
                newUsersToday: Number(dashboard.users?.new_users_today || 0),
                totalCompanies: Number(dashboard.companies?.total_companies || 0),
                totalReviews: Number(dashboard.reviews?.total_reviews || 0),
                pendingReviews: Number(dashboard.reviews?.pending_reviews || 0),
                activeSubscriptions: Number(dashboard.subscriptions?.active_subscriptions || 0),
                monthlyRevenue: Number(dashboard.subscriptions?.total_revenue || 0),
                revenueGrowth: Number(dashboard.revenueGrowth || 0),
                userGrowth: Number(dashboard.userGrowth || 0)
            });

            // Safely process recent users
            const recentUsersRows = usersRes.data?.users || [];
            setRecentUsers(recentUsersRows.map((user) => ({
                id: user?.id || Math.random(),
                name: user?.display_name || user?.name || 'Unknown',
                email: user?.email || '-',
                role: user?.role || 'employee',
                date: safeFormatDate(user?.created_at)
            })));

            // Safely process recent reviews - FIXES LINE 186 ISSUE
            const reviewRows = reviewsRes.data?.reviews || [];
            setRecentReviews(reviewRows.map((review) => ({
                id: review?.id || Math.random(),
                company: review?.company_name || review?.company?.name || 'Unknown',
                rating: Math.min(5, Math.max(0, Number(review?.rating || 0))),
                content: review?.content || '',
                date: safeFormatDate(review?.created_at)
            })));

            // Safely process revenue data
            const revenueRows = Array.isArray(revenueRes.data) ? revenueRes.data.slice().reverse() : [];
            setRevenueData(revenueRows.map((row) => ({
                date: safeFormatDate(row?.date, 'Unknown'),
                revenue: Number(row?.revenue || 0),
                subscriptions: Number(row?.subscriptions || 0)
            })));

            // Safely process user activity
            const userAnalyticsRows = Array.isArray(userAnalyticsRes.data) ? userAnalyticsRes.data.slice().reverse() : [];
            setUserActivity(userAnalyticsRows.map((row) => {
                let dayName = 'Unknown';
                try {
                    if (row?.date) {
                        dayName = new Date(row.date).toLocaleDateString(undefined, { weekday: 'short' });
                    }
                } catch (e) {
                    dayName = 'Unknown';
                }
                return {
                    name: dayName,
                    users: Number(row?.new_users || 0)
                };
            }));

            // Safely process subscription data
            const subscriptionRows = Array.isArray(subscriptionAnalyticsRes.data) ? subscriptionAnalyticsRes.data : [];
            setSubscriptionData(subscriptionRows.map((row) => ({
                name: row?.plan || 'unknown',
                value: Number(row?.active || row?.total || 0)
            })));
        } catch (error) {
            console.error('Failed to fetch dashboard data', error);
            // Set empty arrays on error
            setRecentUsers([]);
            setRecentReviews([]);
            setRevenueData([]);
            setUserActivity([]);
            setSubscriptionData([]);
        } finally {
            setLoading(false);
        }
    };

    const COLORS = ['#4299e1', '#48bb78', '#ed8936', '#9f7aea', '#f687b3', '#fc8181'];

    const statCards = [
        {
            title: 'Total Users',
            value: stats.totalUsers.toLocaleString(),
            change: stats.userGrowth,
            icon: <FaUsers />,
            color: '#4299e1',
            link: '/admin/users'
        },
        {
            title: 'Companies',
            value: stats.totalCompanies.toLocaleString(),
            change: 5.2,
            icon: <FaBuilding />,
            color: '#48bb78',
            link: '/admin/companies'
        },
        {
            title: 'Total Reviews',
            value: stats.totalReviews.toLocaleString(),
            change: 15.3,
            icon: <FaStar />,
            color: '#ed8936',
            link: '/admin/reviews'
        },
        {
            title: 'Active Subscriptions',
            value: stats.activeSubscriptions.toLocaleString(),
            change: 7.8,
            icon: <FaClipboardList />,
            color: '#9f7aea',
            link: '/admin/subscriptions'
        },
        {
            title: 'Monthly Revenue',
            value: safeFormatCurrency(stats.monthlyRevenue),
            change: stats.revenueGrowth,
            icon: <FaDollarSign />,
            color: '#f687b3',
            link: '/admin/subscriptions'
        },
        {
            title: 'Pending Reviews',
            value: stats.pendingReviews.toLocaleString(),
            change: -3.2,
            icon: <FaShieldAlt />,
            color: '#fc8181',
            link: '/admin/reviews?pending=true'
        }
    ];

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="spinner"></div>
                <p>Loading dashboard data...</p>
            </div>
        );
    }

    return (
        <div className="admin-dashboard">
            {/* Welcome Section */}
            <div className="welcome-section">
                <h1>Dashboard Overview</h1>
                <p>Welcome to your admin dashboard. Here's what's happening today.</p>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                {statCards.map((stat, index) => (
                    <Link to={stat.link} key={index} className="stat-card">
                        <div className="stat-icon" style={{ backgroundColor: `${stat.color}20`, color: stat.color }}>
                            {stat.icon}
                        </div>
                        <div className="stat-content">
                            <h3>{stat.title}</h3>
                            <div className="stat-value">{stat.value}</div>
                            <div className="stat-change" style={{ color: stat.change >= 0 ? '#48bb78' : '#f56565' }}>
                                {stat.change >= 0 ? <FaArrowUp /> : <FaArrowDown />}
                                {Math.abs(stat.change)}% from last month
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Charts Section */}
            <div className="charts-section">
                <div className="chart-card">
                    <h3>Revenue Overview</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={revenueData.length ? revenueData : [{ date: 'No data', revenue: 0 }]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Area type="monotone" dataKey="revenue" stroke="#4299e1" fill="#4299e180" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-card">
                    <h3>User Activity</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={userActivity.length ? userActivity : [{ name: 'No data', users: 0 }]}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="users" fill="#48bb78" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="charts-section">
                <div className="chart-card">
                    <h3>Subscription Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={subscriptionData.length ? subscriptionData : [{ name: 'No data', value: 1 }]}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => subscriptionData.length ? `${name} ${(percent * 100).toFixed(0)}%` : 'No data'}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {subscriptionData.length ? subscriptionData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                )) : <Cell fill="#cccccc" />}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-card">
                    <h3>Recent Activity</h3>
                    <div className="activity-list">
                        <div className="activity-item">
                            <FaUserPlus className="activity-icon" style={{ color: '#4299e1' }} />
                            <div className="activity-content">
                                <p>New user registered</p>
                                <small>5 minutes ago</small>
                            </div>
                        </div>
                        <div className="activity-item">
                            <FaStar className="activity-icon" style={{ color: '#ed8936' }} />
                            <div className="activity-content">
                                <p>New review posted on Google</p>
                                <small>15 minutes ago</small>
                            </div>
                        </div>
                        <div className="activity-item">
                            <FaFileInvoice className="activity-icon" style={{ color: '#48bb78' }} />
                            <div className="activity-content">
                                <p>New subscription activated</p>
                                <small>1 hour ago</small>
                            </div>
                        </div>
                        <div className="activity-item">
                            <FaExclamationTriangle className="activity-icon" style={{ color: '#f56565' }} />
                            <div className="activity-content">
                                <p>Review flagged for moderation</p>
                                <small>2 hours ago</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tables Section */}
            <div className="tables-section">
                <div className="table-card">
                    <div className="table-header">
                        <h3>Recent Users</h3>
                        <Link to="/admin/users" className="view-all">View All</Link>
                    </div>
                    <table className="data-table">
                        <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Joined</th>
                        </tr>
                        </thead>
                        <tbody>
                        {recentUsers.length > 0 ? recentUsers.map(user => (
                            <tr key={user.id}>
                                <td>{user.name || '-'}</td>
                                <td>{user.email || '-'}</td>
                                <td>
                                    <span className={`role-badge role-${user.role || 'employee'}`}>
                                        {user.role || 'employee'}
                                    </span>
                                </td>
                                <td>{user.date || '-'}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="4" className="no-data">No recent users</td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>

                <div className="table-card">
                    <div className="table-header">
                        <h3>Recent Reviews</h3>
                        <Link to="/admin/reviews" className="view-all">View All</Link>
                    </div>
                    <table className="data-table">
                        <thead>
                        <tr>
                            <th>Company</th>
                            <th>Rating</th>
                            <th>Content</th>
                            <th>Date</th>
                        </tr>
                        </thead>
                        <tbody>
                        {recentReviews.length > 0 ? recentReviews.map(review => (
                            <tr key={review.id}>
                                <td>{review.company}</td>
                                <td>
                                    <div className="rating-stars">
                                        {'★'.repeat(review.rating)}
                                        {'☆'.repeat(5 - review.rating)}
                                    </div>
                                </td>
                                <td>{safeTruncate(review.content, 30)}</td> {/* FIXED: Line 186 is here */}
                                <td>{review.date}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="4" className="no-data">No recent reviews</td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
