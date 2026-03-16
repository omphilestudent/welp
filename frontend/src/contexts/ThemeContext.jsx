
import React, { createContext, useState, useEffect } from 'react';

export const ThemeContext = createContext();

const resolveInitialTheme = () => {
    if (typeof window === 'undefined') {
        return false;
    }

    try {
        const saved = window.localStorage.getItem('theme');
        if (saved === 'dark') return true;
        if (saved === 'light') return false;
    } catch {
        // ignore access errors and fall through to default
    }

    return false; // default to light mode
};

export const ThemeProvider = ({ children }) => {
    const [isDarkMode, setIsDarkMode] = useState(resolveInitialTheme);

    useEffect(() => {
        const mode = isDarkMode ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', mode);
        try {
            window.localStorage.setItem('theme', mode);
        } catch {
            // localStorage might be unavailable (private mode); safely ignore
        }
    }, [isDarkMode]);

    const toggleTheme = () => {
        setIsDarkMode(prev => !prev);
    };

    return (
        <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
