import React from 'react';
import './Header.css';
import logo from "../assets/logo.png";

const Header = () => {
    const businessOptions = [
        "Welp for Business",
        "Claim your business",
        "Login to your business"
    ];

    return (
        <header className="header">
            <div className="leftSide">
                <div className="logo">
                    <img src={logo} alt="Logo" />
                </div>
                <div className="searchBox">
                    <input
                        className="search"
                        placeholder="Search a review"
                    />
                </div>
            </div>

            <div className="rightSide">
                <ul>
                    <li className="buttons">
                        <select defaultValue={businessOptions[0]}>
                            {businessOptions.map((option, index) => (
                                <option key={index} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </li>
                    <li className="buttons">Sign Up</li>
                    <li className="buttons">Log In</li>
                </ul>
            </div>
        </header>
    );
};

export default Header;