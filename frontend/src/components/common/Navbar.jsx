// src/components/common/Navbar.jsx (Updated)
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaComment } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import ChatRequestModal from '../messages/ChatRequestModal'; // Add this import

const Navbar = () => {
    const { user, logout } = useAuth();
    const { isDarkMode, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [showChatModal, setShowChatModal] = useState(false);

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
                                <Link to="/search" className="navbar-link">
                                    For Businesses
                                </Link>
                            </>
                        )}

                        {user ? (
                            <>
                                {user.role === 'employee' && (
                                    <Link to="/dashboard" className="navbar-link">
                                        Dashboard
                                    </Link>
                                )}

                                {user.role === 'psychologist' && (
                                    <Link to="/messages" className="navbar-link">
                                        Messages
                                    </Link>
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

                                <Link to="/settings" className="navbar-link">
                                    Settings
                                </Link>

                                {user.role === 'employee' && (
                                    <button
                                        onClick={() => setShowChatModal(true)}
                                        className="btn btn-primary"
                                    >
                                        <FaComment style={{ marginRight: '6px' }} />
                                        Chat with Psychologist
                                    </button>
                                )}

                                <button onClick={toggleTheme} className="btn btn-secondary">
                                    {isDarkMode ? '☀️' : '🌙'}
                                </button>

                                <button onClick={handleLogout} className="btn btn-primary">
                                    Logout
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={toggleTheme} className="btn btn-secondary">
                                    {isDarkMode ? '☀️' : '🌙'}
                                </button>
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

            {/* Chat Request Modal */}
            <ChatRequestModal
                isOpen={showChatModal}
                onClose={() => setShowChatModal(false)}
                onSuccess={() => {
                    // Optionally refresh data or show success message
                    console.log('Chat request sent successfully');
                }}
            />
        </>
    );
};

export default Navbar;