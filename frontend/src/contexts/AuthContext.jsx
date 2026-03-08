// context/AuthContext.jsx

import React, { createContext, useState, useEffect } from "react";
import api from "../services/api";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isBackendAvailable, setIsBackendAvailable] = useState(true);

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

            // IMPORTANT: use correct endpoint
            await api.get("/health");

            console.log("✅ Backend is healthy");
            setIsBackendAvailable(true);

        } catch (error) {

            console.error("❌ Backend health check failed:", error.message);

            setIsBackendAvailable(false);
        }
    };

    /*
    ---------------------------------------
    CHECK AUTH SESSION
    ---------------------------------------
    */

    const checkAuth = async () => {

        try {

            const token = localStorage.getItem("token");

            if (!token) {
                setLoading(false);
                return;
            }

            // Attach token to API
            api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

            const { data } = await api.get("/auth/me");

            console.log("✅ Auth restored:", data);

            setUser(data.user);

        } catch (error) {

            console.error("❌ Auth check failed:", error.message);

            localStorage.removeItem("token");

            delete api.defaults.headers.common["Authorization"];

            setUser(null);

        } finally {

            setLoading(false);

        }
    };

    /*
    ---------------------------------------
    LOGIN
    ---------------------------------------
    */

    const login = async (email, password) => {

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
                password
            });

            if (!data.token || !data.user) {
                throw new Error("Invalid login response");
            }

            // Save token
            localStorage.setItem("token", data.token);

            api.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;

            setUser(data.user);

            console.log("✅ Login successful:", data.user);

            return {
                success: true,
                user: data.user
            };

        } catch (error) {

            console.error("❌ Login error:", error);

            let errorMessage = "Login failed";

            if (!error.response) {
                errorMessage = "Cannot connect to server";
                setIsBackendAvailable(false);
            }
            else if (error.response.status === 401) {
                errorMessage = "Invalid email or password";
            }
            else if (error.response.status === 403) {
                errorMessage = "Account disabled";
            }
            else if (error.response.status >= 500) {
                errorMessage = "Server error";
            }

            localStorage.removeItem("token");

            delete api.defaults.headers.common["Authorization"];

            return {
                success: false,
                error: errorMessage
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

            return {
                success: true,
                user: data.user
            };

        } catch (error) {

            console.error("❌ Registration error:", error);

            let errorMessage = "Registration failed";

            if (!error.response) {
                errorMessage = "Cannot connect to server";
                setIsBackendAvailable(false);
            }
            else if (error.response.status === 409) {
                errorMessage = "Email already exists";
            }

            return {
                success: false,
                error: errorMessage
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

            delete api.defaults.headers.common["Authorization"];

            setUser(null);

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

        isBackendAvailable

    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};