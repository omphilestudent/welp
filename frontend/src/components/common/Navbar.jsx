
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaComment, FaShieldAlt, FaBriefcase, FaBell } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import socketService from '../../services/socket';

const resolveMediaUrl = (url) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isAdmin, setIsAdmin] = useState(false);
    const [isHR, setIsHR] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);

    useEffect(() => {
        checkAdminStatus();
        if (user) {
            fetchNotifications();
            connectNotificationSocket();
        } else {
            setNotifications([]);
        }

        return () => {
            socketService.offNotification();
        };
    }, [user]);

    const checkAdminStatus = async () => {
        if (!user) return;

        const normalizedRole = String(user.role || '').toLowerCase();
        const adminRoles = new Set(['admin', 'super_admin', 'superadmin', 'system_admin']);
        if (adminRoles.has(normalizedRole)) {
            try {
                await api.get('/admin/profile', { skipAuthRedirect: true });
                setIsAdmin(true);
            } catch (error) {
                setIsAdmin(false);
            }
        } else {
            setIsAdmin(false);
        }

        if (normalizedRole === 'hr_admin') {
            try {
                await api.get('/hr/profile', { skipAuthRedirect: true });
                setIsHR(true);
            } catch (error) {
                setIsHR(false);
            }
        } else {
            setIsHR(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const fetchNotifications = async () => {
        try {
            const { data } = await api.get('/notifications?limit=20');
            const rows = Array.isArray(data?.notifications) ? data.notifications : [];
            setNotifications(rows);
        } catch (error) {
            setNotifications([]);
        }
    };

    const connectNotificationSocket = () => {
        const candidateKeys = ['token', 'admin_access', 'hr_access', 'access_token'];
        const token = candidateKeys.map((key) => localStorage.getItem(key) || sessionStorage.getItem(key)).find(Boolean);
        if (!token) return;
        socketService.connect(token);
        socketService.onNotification((notification) => {
            setNotifications((prev) => {
                const exists = prev.some((item) => item.id === notification.id);
                return exists ? prev : [notification, ...prev].slice(0, 20);
            });
        });
    };

    const handleNotificationClick = async (notification) => {
        try {
            if (!notification.is_read) {
                await api.patch(`/notifications/${notification.id}/read`);
                setNotifications((prev) => prev.map((item) => (
                    item.id === notification.id ? { ...item, is_read: true } : item
                )));
            }
        } catch (error) {
            // ignore
        } finally {
            if (notification.entity_type === 'conversation' && notification.entity_id) {
                navigate(`/messages?conversation=${notification.entity_id}`);
                setShowNotifications(false);
            }
        }
    };

    return (
        <>
            <nav className="navbar">
                <div className="navbar-container">
                    <Link to="/" className="navbar-logo">
                        Welp
                    </Link>

                    <div className="navbar-menu">
                        <Link to="/search" className="navbar-link">
                            Companies
                        </Link>
                        <Link to="/pricing" className="navbar-link">
                            Pricing
                        </Link>

                        {!user && (
                            <>
                                <Link to="/register/psychologist" className="navbar-link">
                                    Join as Psychologist
                                </Link>
                            </>
                        )}

                        {user ? (
                            <>
                                {user.role === 'employee' && (
                                    <>
                                        <Link to="/dashboard" className="btn btn-primary navbar-dashboard-btn">
                                            Dashboard
                                        </Link>
                                    </>
                                )}

                                {user.role === 'psychologist' && (
                                    <>
                                        <Link to="/dashboard" className="btn btn-secondary">
                                            Dashboard
                                        </Link>
                                        <Link to="/messages" className="navbar-link">
                                            Messages
                                        </Link>
                                    </>
                                )}

                                {user.role === 'business' && (
                                    <>
                                        <Link to="/search?unclaimed=true" className="navbar-link">
                                            Claim Business
                                        </Link>
                                        <Link to="/dashboard" className="navbar-link">
                                            Business Dashboard
                                        </Link>
                                    </>
                                )}

                                {}
                                {isAdmin && (
                                    <div className="nav-dropdown">
                                        <button className="nav-dropdown-btn">
                                            <FaShieldAlt /> Admin
                                        </button>
                                        <div className="nav-dropdown-content">
                                            <Link to="/admin/dashboard">Dashboard</Link>
                                            <Link to="/admin/users">Users</Link>
                                            <Link to="/admin/pricing">Pricing</Link>
                                            <Link to="/admin/companies">Companies</Link>
                                            <Link to="/admin/reviews">Reviews</Link>
                                            <Link to="/admin/subscriptions">Subscriptions</Link>
                                            {user.role === 'super_admin' && (
                                                <Link to="/admin/settings">Settings</Link>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {}
                                {isHR && (
                                    <div className="nav-dropdown">
                                        <button className="nav-dropdown-btn">
                                            <FaBriefcase /> HR
                                        </button>
                                        <div className="nav-dropdown-content">
                                            <Link to="/hr/dashboard">Dashboard</Link>
                                            <Link to="/hr/jobs">Job Postings</Link>
                                            <Link to="/hr/applications">Applications</Link>
                                            <Link to="/hr/interviews">Interviews</Link>
                                            <Link to="/hr/employees">Employee Relations</Link>
                                            <Link to="/hr/departments">Departments</Link>
                                        </div>
                                    </div>
                                )}

                                <Link to="/settings" className="navbar-link">
                                    Settings
                                </Link>

                                {user.role === 'employee' && (
                                    <Link to="/messages" className="btn btn-primary">
                                        <FaComment /> Messages
                                    </Link>
                                )}

                                <div className="nav-notification">
                                    <button
                                        className="notification-btn"
                                        onClick={() => setShowNotifications(!showNotifications)}
                                        aria-label="Notifications"
                                    >
                                        <FaBell />
                                        {notifications.filter((n) => !n.is_read).length > 0 && (
                                            <span className="notification-badge">
                                                {notifications.filter((n) => !n.is_read).length}
                                            </span>
                                        )}
                                    </button>
                                    {showNotifications && (
                                        <div className="notification-menu">
                                            <h4>Notifications</h4>
                                            {notifications.length === 0 ? (
                                                <div className="notification-empty">No notifications yet.</div>
                                            ) : (
                                                notifications.map((notification) => (
                                                    <div
                                                        key={notification.id}
                                                        className={`notification-item ${notification.is_read ? 'read' : 'unread'}`}
                                                        onClick={() => handleNotificationClick(notification)}
                                                    >
                                                        <p>{notification.message}</p>
                                                        <small>{new Date(notification.created_at).toLocaleString()}</small>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>

                                <Link to="/settings" className="navbar-avatar" aria-label="Profile">
                                    {user?.avatar_url ? (
                                        <img src={resolveMediaUrl(user.avatar_url)} alt={user.display_name || 'Profile'} />
                                    ) : (
                                        <span className="navbar-avatar-placeholder">
                                            {(user?.display_name || user?.email || 'U').charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </Link>

                                <button onClick={handleLogout} className="btn btn-primary">
                                    Logout
                                </button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="btn btn-primary">
                                    Login
                                </Link>
                                <Link to="/register" className="btn btn-secondary">
                                    Sign Up
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </nav>

        </>
    );
};

export default Navbar;
