// frontend/src/components/common/Footer.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="footer">
            <div className="container">
                <div className="footer-content">
                    <div className="footer-section">
                        <h3 className="footer-logo">Welp</h3>
                        <p className="footer-description">
                            Making workplaces better through honest employee reviews and wellbeing support.
                        </p>
                    </div>

                    <div className="footer-section">
                        <h4>Quick Links</h4>
                        <ul className="footer-links">
                            <li><Link to="/">Home</Link></li>
                            <li><Link to="/search">Search Companies</Link></li>
                            <li><Link to="/about">About Us</Link></li>
                            <li><Link to="/contact">Contact</Link></li>
                        </ul>
                    </div>

                    <div className="footer-section">
                        <h4>For Businesses</h4>
                        <ul className="footer-links">
                            <li><Link to="/search?unclaimed=true">Claim Your Company</Link></li>
                            <li><Link to="/business-guide">Business Guide</Link></li>
                            <li><Link to="/pricing">Pricing</Link></li>
                        </ul>
                    </div>

                    <div className="footer-section">
                        <h4>For Psychologists</h4>
                        <ul className="footer-links">
                            <li><Link to="/psychologist/join">Join as Psychologist</Link></li>
                            <li><Link to="/resources">Resources</Link></li>
                        </ul>
                    </div>

                    <div className="footer-section">
                        <h4>Legal</h4>
                        <ul className="footer-links">
                            <li><Link to="/privacy">Privacy Policy</Link></li>
                            <li><Link to="/terms">Terms of Service</Link></li>
                            <li><Link to="/guidelines">Review Guidelines</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="footer-bottom">
                    <p>&copy; {currentYear} Welp. All rights reserved.</p>
                    <div className="social-links">
                        <a href="#" aria-label="Twitter">𝕏</a>
                        <a href="#" aria-label="LinkedIn">in</a>
                        <a href="#" aria-label="Facebook">f</a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;