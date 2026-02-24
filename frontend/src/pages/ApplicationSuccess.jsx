// frontend/src/pages/ApplicationSuccess.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaCheckCircle, FaEnvelope, FaClock, FaArrowRight } from 'react-icons/fa';

const ApplicationSuccess = () => {
    const navigate = useNavigate();
    const [daysLeft, setDaysLeft] = useState(5);

    useEffect(() => {
        const timer = setInterval(() => {
            setDaysLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 86400000); // Update every day

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="application-success-page">
            <div className="container">
                <motion.div
                    className="success-card"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5 }}
                >
                    <div className="success-icon-wrapper">
                        <FaCheckCircle className="success-icon" />
                    </div>

                    <h1>Application Submitted Successfully!</h1>

                    <p className="success-message">
                        Thank you for applying to join Welp as a psychologist. We've received your application
                        and will review it shortly.
                    </p>

                    <div className="info-grid">
                        <div className="info-item">
                            <FaEnvelope className="info-icon" />
                            <h3>Confirmation Email</h3>
                            <p>We've sent a confirmation email with your application details. Please check your inbox.</p>
                        </div>

                        <div className="info-item">
                            <FaClock className="info-icon" />
                            <h3>Review Timeline</h3>
                            <p>Our team will review your application within {daysLeft} business days.</p>
                        </div>
                    </div>

                    <div className="next-steps">
                        <h2>What happens next?</h2>
                        <ol>
                            <li>Our team reviews your credentials and license</li>
                            <li>We may contact you for additional information</li>
                            <li>You'll receive a verification email with next steps</li>
                            <li>Complete your profile and start helping employees</li>
                        </ol>
                    </div>

                    <div className="action-buttons">
                        <button
                            onClick={() => navigate('/')}
                            className="btn btn-secondary"
                        >
                            Go to Homepage
                        </button>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="btn btn-primary"
                        >
                            View Dashboard <FaArrowRight />
                        </button>
                    </div>

                    <p className="support-text">
                        Questions? Contact us at <a href="mailto:support@welp.com">support@welp.com</a>
                    </p>
                </motion.div>
            </div>
        </div>
    );
};

export default ApplicationSuccess;