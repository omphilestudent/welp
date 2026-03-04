// frontend/src/pages/admin/AdminDashboard.jsx
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

            const recentUsersRows = usersRes.data?.users || [];
            setRecentUsers(recentUsersRows.map((user) => ({
                id: user.id,
                name: user.display_name || 'Unknown',
                email: user.email,
                role: user.role,
                date: user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'
            })));

            const reviewRows = reviewsRes.data?.reviews || [];
            setRecentReviews(reviewRows.map((review) => ({
                id: review.id,
                company: review.company_name || 'Unknown',
                rating: Number(review.rating || 0),
                content: review.content || '',
                date: review.created_at ? new Date(review.created_at).toLocaleDateString() : '-'
            })));

            const revenueRows = (revenueRes.data || []).slice().reverse();
            setRevenueData(revenueRows.map((row) => ({
                date: new Date(row.date).toLocaleDateString(),
                revenue: Number(row.revenue || 0),
                subscriptions: Number(row.subscriptions || 0)
            })));

            const userAnalyticsRows = (userAnalyticsRes.data || []).slice().reverse();
            setUserActivity(userAnalyticsRows.map((row) => ({
                name: new Date(row.date).toLocaleDateString(undefined, { weekday: 'short' }),
                users: Number(row.new_users || 0)
            })));

            const subscriptionRows = subscriptionAnalyticsRes.data || [];
            setSubscriptionData(subscriptionRows.map((row) => ({
                name: row.plan || 'unknown',
                value: Number(row.active || row.total || 0)
            })));
        } catch (error) {
            console.error('Failed to fetch dashboard data', error);
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
            value: `$${stats.monthlyRevenue.toLocaleString()}`,
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
                        <AreaChart data={revenueData}>
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
                        <BarChart data={userActivity}>
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
                                data={subscriptionData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {subscriptionData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
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
                        {recentUsers.map(user => (
                            <tr key={user.id}>
                                <td>{user.name}</td>
                                <td>{user.email}</td>
                                <td>
                                        <span className={`role-badge role-${user.role}`}>
                                            {user.role}
                                        </span>
                                </td>
                                <td>{user.date}</td>
                            </tr>
                        ))}
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
                        {recentReviews.map(review => (
                            <tr key={review.id}>
                                <td>{review.company}</td>
                                <td>
                                    <div className="rating-stars">
                                        {'★'.repeat(review.rating)}
                                        {'☆'.repeat(5 - review.rating)}
                                    </div>
                                </td>
                                <td>{review.content.substring(0, 30)}...</td>
                                <td>{review.date}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;