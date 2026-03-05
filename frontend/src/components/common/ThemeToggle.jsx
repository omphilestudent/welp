
import React from 'react';
import { useTheme } from '../../hooks/useTheme';

const ThemeToggle = () => {
    const { isDarkMode, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="theme-toggle"
            aria-label="Toggle theme"
        >
            {isDarkMode ? 'Light' : 'Dark'}
        </button>
    );
};

export default ThemeToggle;