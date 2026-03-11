
import React from 'react';
import { Link } from 'react-router-dom';
import { FaBriefcase, FaUsers, FaFileAlt, FaUserGraduate } from 'react-icons/fa';

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
                            <li><Link to="/pricing">Pricing</Link></li>
                            <li><Link to="/about">About Us</Link></li>
                            <li><Link to="/contact">Contact</Link></li>
                        </ul>
                    </div>

                    <div className="footer-section">
                        <h4>For Businesses</h4>
                        <ul className="footer-links">
                            <li><Link to="/search?unclaimed=true">Claim Your Company</Link></li>
                            <li><Link to="/business-guide">Business Guide</Link></li>
                            <li><Link to="/pricing?role=business">Business Pricing</Link></li>
                        </ul>
                    </div>

                    <div className="footer-section">
                        <h4>For Psychologists</h4>
                        <ul className="footer-links">
                            <li><Link to="/register/psychologist">Join as Psychologist</Link></li>
                            <li><Link to="/pricing?role=psychologist">Psychologist Pricing</Link></li>
                            <li><Link to="/resources">Resources</Link></li>
                        </ul>
                    </div>

                    <div className="footer-section">
                        <h4>For Employees</h4>
                        <ul className="footer-links">
                            <li><Link to="/pricing?role=employee">Employee Plans</Link></li>
                            <li><Link to="/resources">Mental Health Resources</Link></li>
                            <li><Link to="/faq">FAQ</Link></li>
                        </ul>
                    </div>

                    {}
                    <div className="footer-section">
                        <h4>Careers</h4>
                        <ul className="footer-links">
                            <li>
                                <Link to="/careers" className="career-link">
                                    <FaBriefcase /> Job Openings
                                </Link>
                            </li>
                            <li>
                                <Link to="/careers/apply" className="career-link">
                                    <FaFileAlt /> Submit Application
                                </Link>
                            </li>
                            <li>
                                <Link to="/careers/benefits" className="career-link">
                                    <FaUsers /> Benefits & Culture
                                </Link>
                            </li>
                            <li>
                                <Link to="/careers/internships" className="career-link">
                                    <FaUserGraduate /> Internships
                                </Link>
                            </li>
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

            <style>{`
                .career-link {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .career-link svg {
                    font-size: 0.9rem;
                }
            `}</style>
        </footer>
    );
};

export default Footer;
