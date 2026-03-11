
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaComment, FaShieldAlt, FaBriefcase } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import ChatRequestModal from '../messages/ChatRequestModal';
import toast from 'react-hot-toast';

const resolveMediaUrl = (url) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showChatModal, setShowChatModal] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isHR, setIsHR] = useState(false);

    useEffect(() => {
        checkAdminStatus();
    }, [user]);

    const checkAdminStatus = async () => {
        if (!user) return;

        try {
            await api.get('/admin/profile', { skipAuthRedirect: true });
            setIsAdmin(true);
        } catch (error) {
            setIsAdmin(false);
        }

        try {
            await api.get('/hr/profile', { skipAuthRedirect: true });
            setIsHR(true);
        } catch (error) {
            setIsHR(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/');
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

                        {!user && (
                            <>
                                <Link to="/psychologist/join" className="navbar-link">
                                    Join as Psychologist
                                </Link>
                                <Link to="/pricing" className="navbar-link">
                                    Pricing
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
                                        <Link to="/pricing" className="navbar-link">
                                            Pricing
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
                                        <Link to="/pricing" className="navbar-link">
                                            Pricing
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
                                        <Link to="/pricing" className="navbar-link">
                                            Pricing
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
                                    <button
                                        onClick={() => setShowChatModal(true)}
                                        className="btn btn-primary"
                                    >
                                        <FaComment /> Chat
                                    </button>
                                )}

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
                                <Link to="/pricing" className="navbar-link">
                                    Pricing
                                </Link>
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

            {}
            <ChatRequestModal
                isOpen={showChatModal}
                onClose={() => setShowChatModal(false)}
                onSuccess={() => {
                    toast.success('Chat request sent successfully');
                }}
            />
        </>
    );
};

export default Navbar;
