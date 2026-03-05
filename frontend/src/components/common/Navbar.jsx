
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaComment, FaShieldAlt, FaBriefcase } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import ChatRequestModal from '../messages/ChatRequestModal';

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
            await api.get('/admin/profile');
            setIsAdmin(true);
        } catch (error) {
            setIsAdmin(false);
        }

        try {
            await api.get('/hr/profile');
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
                                        <Link to="/dashboard" className="navbar-link">
                                            Dashboard
                                        </Link>
                                        <Link to="/pricing" className="navbar-link">
                                            Pricing
                                        </Link>
                                    </>
                                )}

                                {user.role === 'psychologist' && (
                                    <>
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
                                            <Link to="/hr/Departments">Departments</Link>
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
