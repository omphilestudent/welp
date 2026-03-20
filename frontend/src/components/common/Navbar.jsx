import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaComment, FaShieldAlt, FaBriefcase, FaBell, FaChevronDown } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import socketService from '../../services/socket';
import { resolveMediaUrl } from '../../utils/media';
import { presentNotificationFromPayload } from '../../utils/systemNotifications';
import AvatarImage from './AvatarImage';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isAdmin, setIsAdmin] = useState(false);
    const [isHR, setIsHR] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [openDropdown, setOpenDropdown] = useState(null);

    const userId = user?.id || null;
    const userRole = String(user?.role || '').toLowerCase();

    // Lock body scroll when mobile menu is open
    useEffect(() => {
        if (isMobileMenuOpen) {
            document.body.style.overflow = 'hidden';
            document.body.classList.add('menu-open');
        } else {
            document.body.style.overflow = '';
            document.body.classList.remove('menu-open');
        }

        return () => {
            document.body.style.overflow = '';
            document.body.classList.remove('menu-open');
        };
    }, [isMobileMenuOpen]);

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
        setOpenDropdown(null);
    }, [location.pathname]);

    // Close mobile menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isMobileMenuOpen &&
                !event.target.closest('.navbar-menu-mobile') &&
                !event.target.closest('.navbar-toggle')) {
                setIsMobileMenuOpen(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [isMobileMenuOpen]);

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
        setIsMobileMenuOpen(false);
        setOpenDropdown(null);
        await logout();
        navigate('/');
    };

    const toggleMobileMenu = () => {
        setIsMobileMenuOpen(!isMobileMenuOpen);
        if (!isMobileMenuOpen) {
            setShowNotifications(false);
            setOpenDropdown(null);
        }
    };

    const toggleDropdown = (dropdownName) => {
        setOpenDropdown(openDropdown === dropdownName ? null : dropdownName);
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

    const closeMobileMenu = () => {
        setIsMobileMenuOpen(false);
    };

    const renderLink = (to, label, extraClass = '') => (
        <Link
            to={to}
            className={`navbar-link ${extraClass}`.trim()}
            onClick={closeMobileMenu}
        >
            {label}
        </Link>
    );

    return (
        <nav className="navbar">
            <div className="navbar-container">
                <Link to="/" className="navbar-logo" onClick={closeMobileMenu}>
                    <img src="/logo-1.png" alt="Welp" className="navbar-logo-image" />
                    <span>Welp</span>
                </Link>

                {/* Desktop Menu */}
                <div className="navbar-menu-desktop">
                    {renderLink('/', 'Home')}
                    {renderLink('/search', 'Companies')}
                    {!user && renderLink('/pricing', 'Pricing')}
                    {!user && renderLink('/register/psychologist', 'Join as Psychologist')}

                    {user && user.role === 'psychologist' && (
                        renderLink('/messages', 'Messages')
                    )}

                    {user && user.role === 'business' && (
                        renderLink('/search', 'Search Companies')
                    )}
                </div>

                {/* Desktop Controls */}
                <div className="navbar-controls">
                    {!user && (
                        <div className="navbar-auth-desktop">
                            <Link to="/login" className="btn-primary navbar-auth-btn">
                                Login
                            </Link>
                            <Link to="/register" className="btn-secondary navbar-auth-btn">
                                Sign Up
                            </Link>
                        </div>
                    )}

                    {user && (
                        <>
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

                            {/* Desktop Dropdowns */}
                            {isAdmin && (
                                <div className="nav-dropdown">
                                    <button
                                        className="nav-dropdown-btn"
                                        onClick={() => toggleDropdown('admin')}
                                    >
                                        <FaShieldAlt /> Admin <FaChevronDown />
                                    </button>
                                    {openDropdown === 'admin' && (
                                        <div className="nav-dropdown-content">
                                            <Link to="/admin/dashboard" onClick={() => setOpenDropdown(null)}>Dashboard</Link>
                                            <Link to="/admin/users" onClick={() => setOpenDropdown(null)}>Users</Link>
                                            <Link to="/admin/pricing" onClick={() => setOpenDropdown(null)}>Pricing</Link>
                                            <Link to="/admin/companies" onClick={() => setOpenDropdown(null)}>Companies</Link>
                                            <Link to="/admin/reviews" onClick={() => setOpenDropdown(null)}>Reviews</Link>
                                            <Link to="/admin/subscriptions" onClick={() => setOpenDropdown(null)}>Subscriptions</Link>
                                            {user.role === 'super_admin' && (
                                                <Link to="/admin/settings" onClick={() => setOpenDropdown(null)}>Settings</Link>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {isHR && (
                                <div className="nav-dropdown">
                                    <button
                                        className="nav-dropdown-btn"
                                        onClick={() => toggleDropdown('hr')}
                                    >
                                        <FaBriefcase /> HR <FaChevronDown />
                                    </button>
                                    {openDropdown === 'hr' && (
                                        <div className="nav-dropdown-content">
                                            <Link to="/hr/dashboard" onClick={() => setOpenDropdown(null)}>Dashboard</Link>
                                            <Link to="/hr/jobs" onClick={() => setOpenDropdown(null)}>Job Postings</Link>
                                            <Link to="/hr/applications" onClick={() => setOpenDropdown(null)}>Applications</Link>
                                            <Link to="/hr/interviews" onClick={() => setOpenDropdown(null)}>Interviews</Link>
                                            <Link to="/hr/employees" onClick={() => setOpenDropdown(null)}>Employee Relations</Link>
                                            <Link to="/hr/departments" onClick={() => setOpenDropdown(null)}>Departments</Link>
                                        </div>
                                    )}
                                </div>
                            )}

                            <Link to="/settings" className="navbar-avatar" aria-label="Profile">
                                {user?.avatar_url ? (
                                    <AvatarImage src={user.avatar_url} alt={user.display_name || 'Profile'} />
                                ) : (
                                    <span className="navbar-avatar-placeholder">
                                        {(user?.display_name || user?.email || 'U').charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </Link>

                            <button onClick={handleLogout} className="btn-primary navbar-logout-btn">
                                Logout
                            </button>
                        </>
                    )}

                    <button
                        type="button"
                        className={`navbar-toggle ${isMobileMenuOpen ? 'active' : ''}`}
                        onClick={toggleMobileMenu}
                        aria-expanded={isMobileMenuOpen}
                        aria-label="Toggle navigation menu"
                    >
                        <span />
                        <span />
                        <span />
                    </button>
                </div>

                {/* Mobile Menu - No Overlay */}
                <div className={`navbar-menu-mobile ${isMobileMenuOpen ? 'open' : ''}`}>
                    <div className="mobile-menu-header">
                        {user ? (
                            <div className="mobile-user-info">
                                <div className="mobile-avatar">
                                    {user?.avatar_url ? (
                                        <AvatarImage src={user.avatar_url} alt={user.display_name || 'Profile'} />
                                    ) : (
                                        <span className="mobile-avatar-placeholder">
                                            {(user?.display_name || user?.email || 'U').charAt(0).toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                <div className="mobile-user-details">
                                    <div className="mobile-user-name">{user?.display_name || user?.email}</div>
                                    <div className="mobile-user-role">{user?.role || 'User'}</div>
                                </div>
                            </div>
                        ) : (
                            <div className="mobile-auth-buttons">
                                <Link to="/login" className="mobile-auth-btn primary" onClick={closeMobileMenu}>
                                    Login
                                </Link>
                                <Link to="/register" className="mobile-auth-btn secondary" onClick={closeMobileMenu}>
                                    Sign Up
                                </Link>
                            </div>
                        )}
                    </div>

                    <div className="mobile-menu-links">
                        {renderLink('/', 'Home')}
                        {renderLink('/search', 'Companies')}

                        {!user && (
                            <>
                                {renderLink('/pricing', 'Pricing')}
                                {renderLink('/register/psychologist', 'Join as Psychologist')}
                            </>
                        )}

                        {user && (
                            <>
                                {user.role === 'employee' && (
                                    <>
                                        {renderLink('/dashboard', 'Dashboard')}
                                        {renderLink('/messages', 'Messages')}
                                    </>
                                )}

                                {user.role === 'psychologist' && (
                                    <>
                                        {renderLink('/dashboard', 'Dashboard')}
                                        {renderLink('/messages', 'Messages')}
                                    </>
                                )}

                                {user.role === 'business' && (
                                    <>
                                        {renderLink('/search', 'Search Companies')}
                                        {renderLink('/dashboard', 'Business Dashboard')}
                                    </>
                                )}

                                {isAdmin && (
                                    <div className="mobile-dropdown">
                                        <button
                                            className="mobile-dropdown-btn"
                                            onClick={() => toggleDropdown('admin-mobile')}
                                        >
                                            <FaShieldAlt /> Admin <FaChevronDown />
                                        </button>
                                        {openDropdown === 'admin-mobile' && (
                                            <div className="mobile-dropdown-content">
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
                                        )}
                                    </div>
                                )}

                                {isHR && (
                                    <div className="mobile-dropdown">
                                        <button
                                            className="mobile-dropdown-btn"
                                            onClick={() => toggleDropdown('hr-mobile')}
                                        >
                                            <FaBriefcase /> HR <FaChevronDown />
                                        </button>
                                        {openDropdown === 'hr-mobile' && (
                                            <div className="mobile-dropdown-content">
                                                <Link to="/hr/dashboard" onClick={closeMobileMenu}>Dashboard</Link>
                                                <Link to="/hr/jobs" onClick={closeMobileMenu}>Job Postings</Link>
                                                <Link to="/hr/applications" onClick={closeMobileMenu}>Applications</Link>
                                                <Link to="/hr/interviews" onClick={closeMobileMenu}>Interviews</Link>
                                                <Link to="/hr/employees" onClick={closeMobileMenu}>Employee Relations</Link>
                                                <Link to="/hr/departments" onClick={closeMobileMenu}>Departments</Link>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {user && (
                        <div className="mobile-notifications">
                            <button
                                type="button"
                                className="notification-btn mobile-notification-btn"
                                onClick={() => setShowNotifications((prev) => !prev)}
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
                                <div className="notification-menu mobile-notification-menu">
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
                    )}

                    {user && (
                        <div className="mobile-menu-footer">
                            <button onClick={handleLogout} className="mobile-logout-btn">
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
