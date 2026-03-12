// context/AuthContext.jsx
import React, { createContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";

export const AuthContext = createContext();

const getStoredToken = () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token") || sessionStorage.getItem("token");
};

const setRequestToken = (token) => {
    if (token) {
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
        delete api.defaults.headers.common["Authorization"];
    }
};

const initialToken = getStoredToken();
if (initialToken) {
    setRequestToken(initialToken);
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isBackendAvailable, setIsBackendAvailable] = useState(true);
    const [rateLimitInfo, setRateLimitInfo] = useState(null);

    // Derived state
    const isAuthenticated = !!user;

    const checkBackendHealth = useCallback(async () => {
        try {
            await api.get("/health");
            console.log("Backend is healthy");
            setIsBackendAvailable(true);
            setRateLimitInfo(null);
        } catch (error) {
            console.error("Backend health check failed:", error.message);
            setIsBackendAvailable(false);

            if (error.response?.status === 429) {
                setRateLimitInfo({
                    type: 'health',
                    retryAfter: error.response.headers?.['retry-after'],
                    message: error.response.data?.error || 'Too many health check requests'
                });
            }
        }
    }, []);

    const checkAuth = useCallback(async () => {
        setLoading(true);
        try {
            const token = getStoredToken();
            if (!token) {
                setLoading(false);
                return;
            }

            setRequestToken(token);
            const { data } = await api.get("/auth/me");

            console.log("Auth restored:", data);
            setUser(data.user);
            setRateLimitInfo(null);
        } catch (error) {
            console.error("Auth check failed:", error.message);

            if (error.response?.status === 429) {
                setRateLimitInfo({
                    type: 'auth',
                    retryAfter: error.response.headers?.['retry-after'],
                    message: error.response.data?.error || 'Too many authentication attempts'
                });
            }

            if (error.response?.status === 401) {
                localStorage.removeItem("token");
                sessionStorage.removeItem("token");
                setRequestToken(null);
                setUser(null);
            } else if (!error.response || error.response?.status >= 500) {
                setIsBackendAvailable(false);
                // Keep existing user on transient backend/network errors.
            } else {
                setUser(null);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    const initializeAuth = useCallback(async () => {
        await checkBackendHealth();
        await checkAuth();
    }, [checkBackendHealth, checkAuth]);

    useEffect(() => {
        initializeAuth();
    }, [initializeAuth]);

    useEffect(() => {
        const handleStorage = (event) => {
            if (event.key !== "token") return;
            if (event.newValue) {
                setRequestToken(event.newValue);
                checkAuth();
            } else {
                setRequestToken(null);
                setUser(null);
            }
        };

        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, [checkAuth]);

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
            const normalizedRole = String(data.user?.role || '').toLowerCase().trim();
            const adminRoles = new Set(['admin', 'super_admin', 'superadmin', 'system_admin', 'hr_admin']);
            const storePersistently = rememberMe || adminRoles.has(normalizedRole);
            if (storePersistently) {
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
