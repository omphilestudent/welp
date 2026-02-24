// src/components/common/Navbar.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

const Navbar = () => {
    const { user, logout } = useAuth();
    const { isDarkMode, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    return (
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
    );
};

export default Navbar;