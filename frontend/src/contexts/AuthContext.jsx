// context/AuthContext.jsx
import React, { createContext, useState, useEffect, useCallback, useRef } from "react";
import api from "../services/api";

export const AuthContext = createContext();

const isObjectLike = (value) => value !== null && typeof value === 'object';

const deepEqual = (a, b) => {
    if (a === b) return true;
    if (!isObjectLike(a) || !isObjectLike(b)) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i += 1) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
        if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
};

const mergeUserState = (prev, updates = {}) => {
    if (!updates || Object.keys(updates).length === 0) return prev;
    if (!prev) {
        return { ...updates };
    }
    let changed = false;
    const next = { ...prev };
    for (const [key, value] of Object.entries(updates)) {
        const current = prev[key];
        if (isObjectLike(value) && isObjectLike(current)) {
            if (!deepEqual(current, value)) {
                next[key] = value;
                changed = true;
            }
        } else if (current !== value) {
            next[key] = value;
            changed = true;
        }
    }
    return changed ? next : prev;
};

const normalizeUserPayload = (user = null) => {
    if (!user || typeof user !== 'object') {
        return user;
    }
    const normalized = { ...user };
    if (user.displayName && !user.display_name) {
        normalized.display_name = user.displayName;
    }
    if (user.display_name && !user.displayName) {
        normalized.displayName = user.display_name;
    }
    if (user.avatarUrl && !user.avatar_url) {
        normalized.avatar_url = user.avatarUrl;
    }
    if (user.avatar_url && !user.avatarUrl) {
        normalized.avatarUrl = user.avatar_url;
    }
    if (user.applicationStatus && !user.application_status) {
        normalized.application_status = user.applicationStatus;
    }
    if (user.application_status && !user.applicationStatus) {
        normalized.applicationStatus = user.application_status;
    }
    return normalized;
};

const getStoredToken = () => {
    if (typeof window === "undefined") return null;
    const candidateKeys = ["token", "admin_access", "hr_access", "access_token"];
    for (const key of candidateKeys) {
        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (value) return value;
    }
    return null;
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
    const initializedRef = useRef(false);

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
            setUser(normalizeUserPayload(data.user));
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
                const adminToken = localStorage.getItem("admin_access") || sessionStorage.getItem("admin_access");
                const hrToken = localStorage.getItem("hr_access") || sessionStorage.getItem("hr_access");
                if (adminToken || hrToken) {
                    try {
                        const { data } = await api.get("/admin/profile");
                        const profile = data?.data || {};
                        const fallbackUser = {
                            id: profile.user_id || profile.id,
                            email: profile.email,
                            display_name: profile.display_name,
                            role: profile.role_name || "admin",
                            avatar_url: profile.avatar_url
                        };
                        setUser(normalizeUserPayload(fallbackUser));
                        setRateLimitInfo(null);
                        return;
                    } catch (adminError) {
                        // fall through to clear auth
                    }
                }
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

    const refreshUser = useCallback(async () => {
        try {
            const { data } = await api.get("/auth/me");
            setUser(normalizeUserPayload(data.user));
            setRateLimitInfo(null);
            return data.user;
        } catch (error) {
            console.error("Refresh user failed:", error);
            if (error.response?.status === 401) {
                localStorage.removeItem("token");
                sessionStorage.removeItem("token");
                setRequestToken(null);
                setUser(null);
            }
            throw error;
        }
    }, []);

    const initializeAuth = useCallback(async () => {
        await checkBackendHealth();
        await checkAuth();
    }, [checkBackendHealth, checkAuth]);

    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;
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
            setUser(normalizeUserPayload(data.user));
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

            setUser(normalizeUserPayload(data.user));
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

    const updateUser = useCallback((updatedUserData = {}) => {
        const normalized = normalizeUserPayload(updatedUserData);
        setUser((prev) => mergeUserState(prev, normalized));
    }, []);

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
        refreshUser,
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
