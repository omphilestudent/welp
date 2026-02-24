// src/pages/Register.jsx (updated)
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import RegisterForm from '../components/auth/RegisterForm';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';

const Register = () => {
    const navigate = useNavigate();
    const { register } = useAuth();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (formData) => {
        setError('');
        setLoading(true);

        const result = await register(formData);

        if (result.success) {
            toast.success('Account created successfully!');
            navigate('/');
        } else {
            setError(result.error);
            toast.error(result.error);
        }

        setLoading(false);
    };

    return (
        <div className="auth-page">
            <div className="container">
                <motion.div
                    className="auth-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <h1 className="auth-title">Create Account</h1>
                    <p className="auth-subtitle">Join Welp today</p>

                    {error && (
                        <motion.div
                            className="alert alert-error"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                        >
                            {error}
                        </motion.div>
                    )}

                    <RegisterForm onSubmit={handleSubmit} loading={loading} />

                    <div className="auth-footer">
                        <p>
                            Already have an account?{' '}
                            <Link to="/login" className="auth-link">
                                Log in
                            </Link>
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default Register;