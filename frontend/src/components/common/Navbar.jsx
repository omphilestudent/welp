
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaComment, FaShieldAlt, FaBriefcase, FaBell } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import socketService from '../../services/socket';
import { resolveMediaUrl } from '../../utils/media';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isAdmin, setIsAdmin] = useState(false);
    const [isHR, setIsHR] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const userId = user?.id || null;
    const userRole = String(user?.role || '').toLowerCase();

    useEffect(() => {
        checkAdminStatus(userRole);
        if (userId) {
            fetchNotifications();
            connectNotificationSocket();
        } else {
            setNotifications([]);
            socketService.offNotification();
        }

        return () => {
            socketService.offNotification();
        };
    }, [userId, userRole]);

    useEffect(() => {
        setIsMobileMenuOpen(false);
        setShowNotifications(false);
    }, [location.pathname]);

    const checkAdminStatus = async (roleValue) => {
        if (!roleValue) {
            setIsAdmin(false);
            setIsHR(false);
            return;
        }

        const normalizedRole = String(roleValue || '').toLowerCase();
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
        closeMobileMenu();
        await logout();
        navigate('/');
    };

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen((prev) => !prev);
    };

    const closeMobileMenu = () => {
        setIsMobileMenuOpen(false);
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
                    <Link to="/" className="navbar-logo" onClick={closeMobileMenu}>
                        <img src="/logo-1.png" alt="Welp" className="navbar-logo-image" />
                        <span>Welp</span>
                    </Link>

                    <button
                        type="button"
                        className="navbar-toggle"
                        onClick={toggleMobileMenu}
                        aria-expanded={isMobileMenuOpen}
                        aria-label="Toggle navigation menu"
                    >
                        <span />
                        <span />
                        <span />
                    </button>

                    <div className={`navbar-menu ${isMobileMenuOpen ? 'navbar-menu--open' : ''}`}>
                        <Link to="/search" className="navbar-link" onClick={closeMobileMenu}>
                            Companies
                        </Link>
                        {!user && (
                            <Link to="/pricing" className="navbar-link" onClick={closeMobileMenu}>
                                Pricing
                            </Link>
                        )}

                        {!user && (
                            <>
                                <Link to="/register/psychologist" className="navbar-link" onClick={closeMobileMenu}>
                                    Join as Psychologist
                                </Link>
                            </>
                        )}

                        {user ? (
                            <>
                                {user.role === 'employee' && (
                                    <>
                                        <Link to="/dashboard" className="btn btn-primary navbar-dashboard-btn" onClick={closeMobileMenu}>
                                            Dashboard
                                        </Link>
                                    </>
                                )}

                                {user.role === 'psychologist' && (
                                    <>
                                        <Link to="/dashboard" className="btn btn-secondary" onClick={closeMobileMenu}>
                                            Dashboard
                                        </Link>
                                        <Link to="/messages" className="navbar-link" onClick={closeMobileMenu}>
                                            Messages
                                        </Link>
                                    </>
                                )}

                                {user.role === 'business' && (
                                    <>
                                        <Link to="/search" className="navbar-link" onClick={closeMobileMenu}>
                                            Search Companies
                                        </Link>
                                        <Link to="/dashboard" className="navbar-link" onClick={closeMobileMenu}>
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
                                            <Link to="/admin/dashboard" onClick={closeMobileMenu}>Dashboard</Link>
                                            <Link to="/admin/users" onClick={closeMobileMenu}>Users</Link>
                                            <Link to="/admin/pricing" onClick={closeMobileMenu}>Pricing</Link>
                                            <Link to="/admin/companies" onClick={closeMobileMenu}>Companies</Link>
                                            <Link to="/admin/reviews" onClick={closeMobileMenu}>Reviews</Link>
                                            <Link to="/admin/subscriptions" onClick={closeMobileMenu}>Subscriptions</Link>
                                            {user.role === 'super_admin' && (
                                                <Link to="/admin/settings" onClick={closeMobileMenu}>Settings</Link>
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
                                            <Link to="/hr/dashboard" onClick={closeMobileMenu}>Dashboard</Link>
                                            <Link to="/hr/jobs" onClick={closeMobileMenu}>Job Postings</Link>
                                            <Link to="/hr/applications" onClick={closeMobileMenu}>Applications</Link>
                                            <Link to="/hr/interviews" onClick={closeMobileMenu}>Interviews</Link>
                                            <Link to="/hr/employees" onClick={closeMobileMenu}>Employee Relations</Link>
                                            <Link to="/hr/departments" onClick={closeMobileMenu}>Departments</Link>
                                        </div>
                                    </div>
                                )}

                                <Link to="/settings" className="navbar-link" onClick={closeMobileMenu}>
                                    Settings
                                </Link>

                                {user.role === 'employee' && (
                                    <Link to="/messages" className="btn btn-primary" onClick={closeMobileMenu}>
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

                                <Link to="/settings" className="navbar-avatar" aria-label="Profile" onClick={closeMobileMenu}>
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
                                <Link to="/login" className="btn btn-primary" onClick={closeMobileMenu}>
                                    Login
                                </Link>
                                <Link to="/register" className="btn btn-secondary" onClick={closeMobileMenu}>
                                    Sign Up
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {isMobileMenuOpen && (
                <div className="navbar-mobile-overlay" onClick={closeMobileMenu} aria-hidden="true" />
            )}

        </>
    );
};

export default Navbar;
