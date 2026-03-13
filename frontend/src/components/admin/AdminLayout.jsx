
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
    FaSignOutAlt,
    FaBell,
    FaSearch,
    FaUserCircle,
    FaRobot,
    FaUserCheck,
    FaEnvelope,
    FaBullhorn
} from 'react-icons/fa';
import toast from 'react-hot-toast';

const AdminLayout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [adminInfo, setAdminInfo] = useState({
        role_name: 'admin',
        department: 'Administration'
    });

    const userRole = String(user?.role || adminInfo?.role_name || '').toLowerCase().trim();
    const isSuperAdmin = ['super_admin', 'superadmin', 'system_admin'].includes(userRole);
    const isHrAdmin = userRole === 'hr_admin';

    useEffect(() => {
        fetchAdminInfo();
        fetchNotifications();
    }, []);

    const fetchAdminInfo = async () => {
        try {
            const { data } = await api.get('/admin/profile');
            const profile = data?.data || data || {};

            setAdminInfo((prev) => ({
                ...prev,
                ...profile,
                role_name: profile?.role_name || profile?.role || prev.role_name,
                department: profile?.department || prev.department
            }));
        } catch (error) {
            console.log('Using default admin info');
        }
    };

    const fetchNotifications = async () => {
        try {
            const { data } = await api.get('/admin/notifications');
            const rows = Array.isArray(data?.notifications) ? data.notifications : [];
            setNotifications(rows.map((n) => ({
                id: n.id,
                text: n.message,
                time: new Date(n.created_at).toLocaleString(),
                read: !!n.read_at
            })));
        } catch (error) {
            setNotifications([]);
        }
    };

    const handleLogout = async () => {
        await logout();
        toast.success('Logged out successfully');
        navigate('/login');
    };

    const markAsRead = async (id) => {
        try {
            await api.patch(`/admin/notifications/${id}/read`);
        } catch {
            // ignore
        } finally {
            setNotifications(notifications.map(n =>
                n.id === id ? { ...n, read: true } : n
            ));
        }
    };

    const navItems = [
        {
            path: '/admin/dashboard',
            icon: <FaTachometerAlt />,
            label: 'Dashboard',
            color: '#4299e1'
        },
        {
            path: '/admin/users',
            icon: <FaUsers />,
            label: 'User Management',
            color: '#48bb78'
        },
        {
            path: '/admin/pricing',
            icon: <FaDollarSign />,
            label: 'Pricing Management',
            color: '#ed8936'
        },
        {
            path: '/admin/companies',
            icon: <FaBuilding />,
            label: 'Companies',
            color: '#9f7aea'
        },
        {
            path: '/admin/reviews',
            icon: <FaStar />,
            label: 'Review Moderation',
            color: '#f687b3'
        },
        {
            path: '/admin/applications',
            icon: <FaClipboardList />,
            label: 'Registration Applications',
            color: '#63b3ed'
        },
        {
            path: '/admin/claims',
            icon: <FaUserCheck />,
            label: 'Claim Requests',
            color: '#0ea5e9'
        },
        {
            path: '/admin/marketing',
            icon: <FaEnvelope />,
            label: 'Email Marketing',
            color: '#f59e0b'
        },
        {
            path: '/admin/subscriptions',
            icon: <FaClipboardList />,
            label: 'Subscriptions',
            color: '#fc8181'
        },
        {
            path: '/admin/ads',
            icon: <FaBullhorn />,
            label: 'Ad Approvals',
            color: '#dd6b20'
        },
        {
            path: '/admin/calendar',
            icon: <FaCalendarAlt />,
            label: 'Calendar Troubleshoot',
            color: '#38b2ac'
        },
        {
            path: '/admin/settings',
            icon: <FaCog />,
            label: 'Settings',
            color: '#a0aec0'
        }
    ];

    const superAdminNavItems = [
        {
            path: '/admin/ml-interactions',
            icon: <FaRobot />,
            label: 'ML Interactions',
            color: '#38b2ac'
        }
    ];

    const hrNavItems = [
        {
            path: '/hr/dashboard',
            icon: <FaChartLine />,
            label: 'HR Dashboard',
            color: '#4299e1'
        },
        {
            path: '/hr/jobs',
            icon: <FaBriefcase />,
            label: 'Job Postings',
            color: '#48bb78'
        },
        {
            path: '/hr/applications',
            icon: <FaFileAlt />,
            label: 'Applications',
            color: '#ed8936'
        },
        {
            path: '/hr/interviews',
            icon: <FaCalendarAlt />,
            label: 'Interviews',
            color: '#9f7aea'
        },
        {
            path: '/hr/employees',
            icon: <FaUsers />,
            label: 'Employee Relations',
            color: '#f687b3'
        },
        {
            path: '/hr/departments',
            icon: <FaBuilding />,
            label: 'Departments',
            color: '#fc8181'
        }
    ];

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className={`admin-layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
            {}
            <aside className="admin-sidebar">
                <div className="sidebar-header">
                    <div className="logo-area">
                        <FaShieldAlt className="logo-icon" />
                        <h2>Welp Admin</h2>
                    </div>
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
                                <FaUserCircle />
                            </div>
                        )}
                    </div>
                    <div className="admin-info">
                        <h4>{user?.display_name || 'Admin User'}</h4>
                        <p className="admin-role">{String(adminInfo?.role_name || user?.role || 'admin').replace(/_/g, ' ').toUpperCase()}</p>
                        <p className="admin-dept">{adminInfo.department}</p>
                    </div>
                </div>

                <div className="sidebar-search">
                    <FaSearch className="search-icon" />
                    <input type="text" placeholder="Search..." />
                </div>

                <nav className="sidebar-nav">
                    {!isHrAdmin && (
                        <div className="nav-section">
                            <h3>Administration</h3>
                            {navItems.map(item => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={({ isActive }) =>
                                        `nav-link ${isActive ? 'active' : ''}`
                                    }
                                    style={{ '--item-color': item.color }}
                                >
                                    <span className="nav-icon">{item.icon}</span>
                                    {sidebarOpen && <span className="nav-label">{item.label}</span>}
                                </NavLink>
                            ))}
                        </div>
                    )}

                    {isSuperAdmin && !isHrAdmin && (
                        <div className="nav-section">
                            <h3>Super Admin</h3>
                            {superAdminNavItems.map(item => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={({ isActive }) =>
                                        `nav-link ${isActive ? 'active' : ''}`
                                    }
                                    style={{ '--item-color': item.color }}
                                >
                                    <span className="nav-icon">{item.icon}</span>
                                    {sidebarOpen && <span className="nav-label">{item.label}</span>}
                                </NavLink>
                            ))}
                        </div>
                    )}

                    {isHrAdmin && (
                        <div className="nav-section">
                            <h3>Human Resources</h3>
                            {hrNavItems.map(item => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={({ isActive }) =>
                                        `nav-link ${isActive ? 'active' : ''}`
                                    }
                                    style={{ '--item-color': item.color }}
                                >
                                    <span className="nav-icon">{item.icon}</span>
                                    {sidebarOpen && <span className="nav-label">{item.label}</span>}
                                </NavLink>
                            ))}
                        </div>
                    )}
                </nav>

                <div className="sidebar-footer">
                    <button onClick={handleLogout} className="logout-btn">
                        <FaSignOutAlt />
                        {sidebarOpen && <span>Logout</span>}
                    </button>
                </div>
            </aside>

            {}
            <main className="admin-main">
                {}
                <div className="admin-topbar">
                    <div className="topbar-left">
                        <h1>Welcome back, {user?.display_name || 'Admin'}!</h1>
                    </div>
                    <div className="topbar-right">
                        <div className="notification-dropdown">
                            <button
                                className="notification-btn"
                                onClick={() => setShowNotifications(!showNotifications)}
                            >
                                <FaBell />
                                {unreadCount > 0 && (
                                    <span className="notification-badge">{unreadCount}</span>
                                )}
                            </button>
                            {showNotifications && (
                                <div className="notification-menu">
                                    <h4>Notifications</h4>
                                    {notifications.length === 0 ? (
                                        <div className="notification-empty">No notifications yet.</div>
                                    ) : (
                                        notifications.map(n => (
                                            <div
                                                key={n.id}
                                                className={`notification-item ${n.read ? 'read' : 'unread'}`}
                                                onClick={() => markAsRead(n.id)}
                                            >
                                                <p>{n.text}</p>
                                                <small>{n.time}</small>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="admin-date">
                            {new Date().toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </div>
                    </div>
                </div>

                {}
                <div className="admin-content">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
