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
        totalUsers: 15234,
        newUsersToday: 127,
        totalCompanies: 892,
        totalReviews: 45321,
        pendingReviews: 234,
        activeSubscriptions: 5678,
        monthlyRevenue: 45890,
        revenueGrowth: 12.5,
        userGrowth: 8.3
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
            // In production, fetch from API
            // const { data } = await api.get('/admin/dashboard/stats');
            // setStats(data);

            // Mock data for demonstration
            generateMockData();
        } catch (error) {
            console.error('Failed to fetch dashboard data');
            generateMockData();
        } finally {
            setLoading(false);
        }
    };

    const generateMockData = () => {
        // Generate revenue data for the last 30 days
        const revenue = [];
        for (let i = 0; i < 30; i++) {
            revenue.push({
                date: `Day ${i + 1}`,
                revenue: Math.floor(Math.random() * 5000) + 2000,
                subscriptions: Math.floor(Math.random() * 100) + 50
            });
        }
        setRevenueData(revenue);

        // User activity data
        setUserActivity([
            { name: 'Mon', users: 1200 },
            { name: 'Tue', users: 1350 },
            { name: 'Wed', users: 1500 },
            { name: 'Thu', users: 1420 },
            { name: 'Fri', users: 1680 },
            { name: 'Sat', users: 1100 },
            { name: 'Sun', users: 980 },
        ]);

        // Subscription distribution
        setSubscriptionData([
            { name: 'Employee Free', value: 3500 },
            { name: 'Employee Premium', value: 1200 },
            { name: 'Psychologist Free', value: 450 },
            { name: 'Psychologist Premium', value: 280 },
            { name: 'Business Free', value: 180 },
            { name: 'Business Premium', value: 68 },
        ]);

        // Recent users
        setRecentUsers([
            { id: 1, name: 'John Doe', email: 'john@example.com', role: 'employee', date: '2024-01-15' },
            { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'psychologist', date: '2024-01-14' },
            { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'business', date: '2024-01-14' },
            { id: 4, name: 'Alice Brown', email: 'alice@example.com', role: 'employee', date: '2024-01-13' },
            { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', role: 'employee', date: '2024-01-13' },
        ]);

        // Recent reviews
        setRecentReviews([
            { id: 1, company: 'Google', rating: 5, content: 'Great place to work!', date: '2024-01-15' },
            { id: 2, company: 'Meta', rating: 4, content: 'Good culture but long hours', date: '2024-01-14' },
            { id: 3, company: 'Microsoft', rating: 5, content: 'Excellent benefits', date: '2024-01-14' },
            { id: 4, company: 'Amazon', rating: 3, content: 'Fast-paced environment', date: '2024-01-13' },
            { id: 5, company: 'Apple', rating: 5, content: 'Innovative company', date: '2024-01-13' },
        ]);
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