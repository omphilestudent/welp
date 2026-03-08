// context/AuthContext.jsx
import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isBackendAvailable, setIsBackendAvailable] = useState(true);

    // Check backend health on mount
    useEffect(() => {
        checkBackendHealth();
        checkAuth();
    }, []);

    const checkBackendHealth = async () => {
        try {
            await api.get('/health');
            console.log('✅ Backend is healthy');
            setIsBackendAvailable(true);
        } catch (error) {
            console.error('❌ Backend health check failed:', error.message);
            setIsBackendAvailable(false);
        }
    };

    const checkAuth = async () => {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                const { data } = await api.get('/auth/me');
                console.log('✅ Auth check successful:', data);
                setUser(data.user);
            }
        } catch (error) {
            console.error('❌ Auth check error:', error.message);
            localStorage.removeItem('token');
            delete api.defaults.headers.common['Authorization'];
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            console.log('📤 Attempting login for:', email);

            // Validate inputs
            if (!email || !password) {
                return {
                    success: false,
                    error: 'Email and password are required'
                };
            }

            const { data } = await api.post('/auth/login', {
                email,
                password
            });

            console.log('✅ Login successful:', data);

            if (data.token) {
                localStorage.setItem('token', data.token);
                api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
            }

            setUser(data.user);

            return {
                success: true,
                user: data.user
            };
        } catch (error) {
            console.error('❌ Login error details:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                message: error.message
            });

            // Handle different error scenarios
            let errorMessage = 'Login failed';

            if (!error.response) {
                // Network error - backend might be down
                errorMessage = 'Cannot connect to server. Please check if the backend is running.';
                setIsBackendAvailable(false);
            } else if (error.response.status === 401) {
                errorMessage = 'Invalid email or password';
            } else if (error.response.status === 403) {
                errorMessage = 'Account is locked or disabled';
            } else if (error.response.status === 429) {
                errorMessage = 'Too many login attempts. Please try again later.';
            } else if (error.response.status >= 500) {
                errorMessage = 'Server error. Please try again later.';
            } else {
                errorMessage = error.response?.data?.error ||
                    error.response?.data?.message ||
                    'Login failed';
            }

            // Clear any existing token on login failure
            localStorage.removeItem('token');
            delete api.defaults.headers.common['Authorization'];

            return {
                success: false,
                error: errorMessage
            };
        }
    };

    const socialLogin = async (provider) => {
        try {
            // Check backend availability first
            if (!isBackendAvailable) {
                return {
                    success: false,
                    error: 'Backend server is not available'
                };
            }

            // Store the current location to redirect back after OAuth
            sessionStorage.setItem('oauth_redirect', window.location.pathname);

            // Redirect to OAuth provider
            window.location.href = `${api.defaults.baseURL}/auth/${provider}`;
        } catch (error) {
            console.error('❌ Social login error:', error);
            return {
                success: false,
                error: `Failed to login with ${provider}`
            };
        }
    };

    const register = async (userData) => {
        try {
            console.log('📤 Attempting registration for:', userData.email);

            const { data } = await api.post('/auth/register', userData);
            console.log('✅ Registration successful:', data);

            if (data.token) {
                localStorage.setItem('token', data.token);
                api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
            }

            setUser(data.user);
            return { success: true, user: data.user };
        } catch (error) {
            console.error('❌ Registration error:', error.response?.data || error);

            let errorMessage = 'Registration failed';

            if (!error.response) {
                errorMessage = 'Cannot connect to server. Please check if the backend is running.';
                setIsBackendAvailable(false);
            } else if (error.response.status === 400) {
                errorMessage = error.response.data?.error || 'Invalid registration data';
            } else if (error.response.status === 409) {
                errorMessage = 'Email already exists';
            }

            return {
                success: false,
                error: errorMessage
            };
        }
    };

    const logout = async () => {
        try {
            if (isBackendAvailable) {
                await api.post('/auth/logout');
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem('token');
            delete api.defaults.headers.common['Authorization'];
            setUser(null);
        }
    };

    const updateUser = (updatedUserData) => {
        setUser(prev => ({
            ...prev,
            ...updatedUserData
        }));
    };

    const value = {
        user,
        loading,
        login,
        socialLogin,
        register,
        logout,
        checkAuth,
        updateUser,
        isBackendAvailable
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};