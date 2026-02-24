// frontend/src/components/admin/AdminLayout.jsx
import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import {
    FaTachometerAlt,
    FaUsers,
    FaDollarSign,
    FaBuilding,
    FaStar,
    FaCog,
    FaClipboardList,
    FaBriefcase,
    FaFileAlt,
    FaCalendarAlt,
    FaChartLine,
    FaShieldAlt,
    FaBars,
    FaTimes,
    FaSignOutAlt
} from 'react-icons/fa';

const AdminLayout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [adminInfo, setAdminInfo] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAdminInfo();
    }, []);

    const fetchAdminInfo = async () => {
        try {
            const { data } = await api.get('/admin/profile');
            setAdminInfo(data);
        } catch (error) {
            console.error('Failed to fetch admin info:', error);
            navigate('/');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
            </div>
        );
    }

    const navItems = [
        {
            path: '/admin/dashboard',
            icon: <FaTachometerAlt />,
            label: 'Dashboard',
            roles: ['super_admin', 'pricing_admin', 'hr_admin', 'support_admin']
        },
        {
            path: '/admin/users',
            icon: <FaUsers />,
            label: 'User Management',
            roles: ['super_admin', 'support_admin']
        },
        {
            path: '/admin/pricing',
            icon: <FaDollarSign />,
            label: 'Pricing Management',
            roles: ['super_admin', 'pricing_admin']
        },
        {
            path: '/admin/companies',
            icon: <FaBuilding />,
            label: 'Companies',
            roles: ['super_admin', 'support_admin']
        },
        {
            path: '/admin/reviews',
            icon: <FaStar />,
            label: 'Review Moderation',
            roles: ['super_admin', 'support_admin']
        },
        {
            path: '/admin/subscriptions',
            icon: <FaClipboardList />,
            label: 'Subscriptions',
            roles: ['super_admin', 'pricing_admin']
        }
    ];

    const hrNavItems = [
        {
            path: '/hr/dashboard',
            icon: <FaChartLine />,
            label: 'HR Dashboard',
            roles: ['super_admin', 'hr_admin']
        },
        {
            path: '/hr/jobs',
            icon: <FaBriefcase />,
            label: 'Job Postings',
            roles: ['super_admin', 'hr_admin']
        },
        {
            path: '/hr/applications',
            icon: <FaFileAlt />,
            label: 'Applications',
            roles: ['super_admin', 'hr_admin']
        },
        {
            path: '/hr/interviews',
            icon: <FaCalendarAlt />,
            label: 'Interviews',
            roles: ['super_admin', 'hr_admin']
        },
        {
            path: '/hr/employees',
            icon: <FaUsers />,
            label: 'Employee Relations',
            roles: ['super_admin', 'hr_admin']
        },
        {
            path: '/hr/departments',
            icon: <FaBuilding />,
            label: 'Departments',
            roles: ['super_admin', 'hr_admin']
        }
    ];

    const userRole = adminInfo?.role_name;

    return (
        <div className={`admin-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            {/* Sidebar */}
            <aside className="admin-sidebar">
                <div className="sidebar-header">
                    <h2>Welp Admin</h2>
                    <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
                        {sidebarOpen ? <FaTimes /> : <FaBars />}
                    </button>
                </div>

                <div className="admin-profile">
                    <div className="admin-avatar">
                        {user?.avatar_url ? (
                            <img src={user.avatar_url} alt={user.display_name} />
                        ) : (
                            <div className="avatar-placeholder">
                                {user?.display_name?.charAt(0) || 'A'}
                            </div>
                        )}
                    </div>
                    <div className="admin-info">
                        <h4>{user?.display_name}</h4>
                        <p className="admin-role">{adminInfo?.role_name?.replace('_', ' ').toUpperCase()}</p>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-section">
                        <h3>Administration</h3>
                        {navItems.map(item =>
                                item.roles.includes(userRole) && (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        className={({ isActive }) =>
                                            `nav-link ${isActive ? 'active' : ''}`
                                        }
                                    >
                                        {item.icon}
                                        {sidebarOpen && <span>{item.label}</span>}
                                    </NavLink>
                                )
                        )}
                    </div>

                    {(userRole === 'super_admin' || userRole === 'hr_admin') && (
                        <div className="nav-section">
                            <h3>Human Resources</h3>
                            {hrNavItems.map(item =>
                                    item.roles.includes(userRole) && (
                                        <NavLink
                                            key={item.path}
                                            to={item.path}
                                            className={({ isActive }) =>
                                                `nav-link ${isActive ? 'active' : ''}`
                                            }
                                        >
                                            {item.icon}
                                            {sidebarOpen && <span>{item.label}</span>}
                                        </NavLink>
                                    )
                            )}
                        </div>
                    )}

                    <div className="nav-section">
                        <h3>System</h3>
                        {userRole === 'super_admin' && (
                            <NavLink to="/admin/settings" className="nav-link">
                                <FaCog />
                                {sidebarOpen && <span>Settings</span>}
                            </NavLink>
                        )}
                        <button onClick={handleLogout} className="nav-link logout-btn">
                            <FaSignOutAlt />
                            {sidebarOpen && <span>Logout</span>}
                        </button>
                    </div>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="admin-main">
                <div className="admin-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;