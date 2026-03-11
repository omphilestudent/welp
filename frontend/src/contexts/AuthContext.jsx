// context/AuthContext.jsx
import React, { createContext, useState, useEffect } from "react";
import api from "../services/api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isBackendAvailable, setIsBackendAvailable] = useState(true);
    const [rateLimitInfo, setRateLimitInfo] = useState(null);

    // Derived state
    const isAuthenticated = !!user;

    // Initialize auth on app load
    useEffect(() => {
        initializeAuth();
    }, []);

    const initializeAuth = async () => {
        await checkBackendHealth();
        await checkAuth();
    };

    /*
    ---------------------------------------
    BACKEND HEALTH CHECK
    ---------------------------------------
    */

    const checkBackendHealth = async () => {
        try {
            await api.get("/health");
            console.log("✅ Backend is healthy");
            setIsBackendAvailable(true);
            setRateLimitInfo(null);
        } catch (error) {
            console.error("❌ Backend health check failed:", error.message);
            setIsBackendAvailable(false);

            // Check if it's a rate limit error
            if (error.response?.status === 429) {
                setRateLimitInfo({
                    type: 'health',
                    retryAfter: error.response.headers?.['retry-after'],
                    message: error.response.data?.error || 'Too many health check requests'
                });
            }
        }
    };

    /*
    ---------------------------------------
    CHECK AUTH SESSION
    ---------------------------------------
    */

    const checkAuth = async () => {
        try {
            const token = localStorage.getItem("token") || sessionStorage.getItem("token");

            if (!token) {
                setLoading(false);
                return;
            }

            // Attach token to API
            api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

            const { data } = await api.get("/auth/me");

            console.log("✅ Auth restored:", data);
            setUser(data.user);
            setRateLimitInfo(null);

        } catch (error) {
            console.error("❌ Auth check failed:", error.message);

            // Handle rate limiting specially
            if (error.response?.status === 429) {
                setRateLimitInfo({
                    type: 'auth',
                    retryAfter: error.response.headers?.['retry-after'],
                    message: error.response.data?.error || 'Too many authentication attempts'
                });
                // Don't remove token for rate limit errors
            } else {
                localStorage.removeItem("token");
                sessionStorage.removeItem("token");
                delete api.defaults.headers.common["Authorization"];
                setUser(null);
            }
        } finally {
            setLoading(false);
        }
    };

    /*
    ---------------------------------------
    LOGIN
    ---------------------------------------
    */

    const login = async (email, password, rememberMe = false) => {
        try {
            if (!email || !password) {
                return {
                    success: false,
                    error: "Email and password are required"
                };
            }

            console.log("📤 Attempting login:", email);

            const { data } = await api.post("/auth/login", {
                email,
                password,
                rememberMe
            });

            if (!data.token || !data.user) {
                throw new Error("Invalid login response");
            }

            // Save token
            sessionStorage.removeItem("token");
            localStorage.removeItem("token");
            if (rememberMe) {
                localStorage.setItem("token", data.token);
            } else {
                sessionStorage.setItem("token", data.token);
            }
            api.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
            setUser(data.user);
            setRateLimitInfo(null);

            console.log("✅ Login successful:", data.user);

            return {
                success: true,
                user: data.user
            };

        } catch (error) {
            console.error("❌ Login error:", error);

            let errorMessage = "Login failed";
            let retryAfter = null;
            let rateLimitCode = null;

            if (!error.response) {
                errorMessage = "Cannot connect to server";
                setIsBackendAvailable(false);
            }
            else if (error.response.status === 429) {
                // Handle rate limiting
                errorMessage = error.response.data?.error || "Too many login attempts. Please try again later.";
                retryAfter = error.response.headers?.['retry-after'];
                rateLimitCode = error.response.data?.code;

                // Set rate limit info in context
                setRateLimitInfo({
                    type: 'login',
                    retryAfter,
                    message: errorMessage,
                    code: rateLimitCode
                });

                // Don't remove token for rate limit errors (user might not have been logged in anyway)
                return {
                    success: false,
                    error: errorMessage,
                    retryAfter,
                    code: rateLimitCode,
                    isRateLimit: true
                };
            }
            else if (error.response.status === 401) {
                errorMessage = "Invalid email or password";
            }
            else if (error.response.status === 403) {
                errorMessage = "Account disabled";
            }
            else if (error.response.status >= 500) {
                errorMessage = "Server error. Please try again later.";
            }

            // Only clear token for non-rate-limit errors
            if (error.response?.status !== 429) {
                localStorage.removeItem("token");
                sessionStorage.removeItem("token");
                delete api.defaults.headers.common["Authorization"];
            }

            return {
                success: false,
                error: errorMessage,
                isRateLimit: error.response?.status === 429
            };
        }
    };

    /*
    ---------------------------------------
    REGISTER
    ---------------------------------------
    */

    const register = async (userData) => {
        try {
            const { data } = await api.post("/auth/register", userData);

            if (data.token) {
                localStorage.setItem("token", data.token);
                api.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
            }

            setUser(data.user);
            setRateLimitInfo(null);

            return {
                success: true,
                user: data.user
            };

        } catch (error) {
            console.error("❌ Registration error:", error);

            let errorMessage = "Registration failed";
            let retryAfter = null;

            if (!error.response) {
                errorMessage = "Cannot connect to server";
                setIsBackendAvailable(false);
            }
            else if (error.response.status === 429) {
                errorMessage = error.response.data?.error || "Too many registration attempts. Please try again later.";
                retryAfter = error.response.headers?.['retry-after'];

                setRateLimitInfo({
                    type: 'register',
                    retryAfter,
                    message: errorMessage,
                    code: error.response.data?.code
                });
            }
            else if (error.response.status === 409) {
                errorMessage = "Email already exists";
            }

            return {
                success: false,
                error: errorMessage,
                retryAfter,
                isRateLimit: error.response?.status === 429
            };
        }
    };

    /*
    ---------------------------------------
    SOCIAL LOGIN
    ---------------------------------------
    */

    const socialLogin = async (provider) => {
        try {
            if (!isBackendAvailable) {
                return {
                    success: false,
                    error: "Backend server unavailable"
                };
            }

            sessionStorage.setItem(
                "oauth_redirect",
                window.location.pathname
            );

            window.location.href = `${api.defaults.baseURL}/auth/${provider}`;

        } catch (error) {
            console.error("❌ Social login error:", error);

            return {
                success: false,
                error: `Failed to login with ${provider}`
            };
        }
    };

    /*
    ---------------------------------------
    LOGOUT
    ---------------------------------------
    */

    const logout = async () => {
        try {
            if (isBackendAvailable) {
                await api.post("/auth/logout");
            }
        } catch (error) {
            console.error("Logout error:", error);
        } finally {
            localStorage.removeItem("token");
            sessionStorage.removeItem("token");
            delete api.defaults.headers.common["Authorization"];
            setUser(null);
            setRateLimitInfo(null);
        }
    };

    /*
    ---------------------------------------
    UPDATE USER
    ---------------------------------------
    */

    const updateUser = (updatedUserData) => {
        setUser(prev => ({
            ...prev,
            ...updatedUserData
        }));
    };

    /*
    ---------------------------------------
    CLEAR RATE LIMIT
    ---------------------------------------
    */

    const clearRateLimit = () => {
        setRateLimitInfo(null);
    };

    /*
    ---------------------------------------
    CONTEXT VALUE
    ---------------------------------------
    */

    const value = {
        user,
        loading,
        isAuthenticated,
        login,
        register,
        logout,
        socialLogin,
        checkAuth,
        updateUser,
        isBackendAvailable,
        rateLimitInfo,
        clearRateLimit
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};