
import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    FaHeart,
    FaLaptop,
    FaClock,
    FaGraduationCap,
    FaMedal,
    FaCoffee,
    FaUsers,
    FaGlobe,
    FaHome,
    FaBaby,
    FaPiggyBank,
    FaPlane,
    FaDumbbell,
    FaBriefcase,
    FaMoneyBillWave,
    FaShieldAlt,
    FaUmbrellaBeach
} from 'react-icons/fa';

const Benefits = () => {
    const benefits = [
        {
            icon: <FaHeart />,
            title: 'Health & Wellness',
            description: 'Comprehensive medical, dental, and vision insurance for you and your family',
            details: [
                '100% coverage for employees',
                '80% coverage for dependents',
                'Mental health support',
                'Wellness stipend'
            ]
        },
        {
            icon: <FaLaptop />,
            title: 'Remote First',
            description: 'Work from anywhere with our remote-first culture',
            details: [
                '$2000 home office setup stipend',
                'Monthly internet allowance',
                'Coworking space membership',
                'Flexible hours'
            ]
        },
        {
            icon: <FaClock />,
            title: 'Flexible PTO',
            description: 'Take time off when you need it',
            details: [
                'Unlimited PTO policy',
                '15 company holidays',
                'Winter break closure',
                'Sick leave'
            ]
        },
        {
            icon: <FaGraduationCap />,
            title: 'Learning & Development',
            description: 'Grow your skills with our learning budget',
            details: [
                '$2000 annual learning stipend',
                'Conference attendance',
                'Course subscriptions',
                'Internal mentorship'
            ]
        },
        {
            icon: <FaMedal />,
            title: '401k & Equity',
            description: 'Invest in your future',
            details: [
                '4% 401k matching',
                'Equity grants',
                'Financial planning resources',
                'ESOP participation'
            ]
        },
        {
            icon: <FaCoffee />,
            title: 'Daily Perks',
            description: 'Little things that make a difference',
            details: [
                'Lunch stipend',
                'Coffee & snacks',
                'Virtual team events',
                'Swag packages'
            ]
        },
        {
            icon: <FaUsers />,
            title: 'Family Support',
            description: 'Support for you and your loved ones',
            details: [
                '16 weeks parental leave',
                'Fertility benefits',
                'Childcare assistance',
                'Family planning resources'
            ]
        },
        {
            icon: <FaGlobe />,
            title: 'Global Team',
            description: 'Work with colleagues worldwide',
            details: [
                'Annual team retreats',
                'Cultural celebrations',
                'Language classes',
                'Travel opportunities'
            ]
        },
        {
            icon: <FaHome />,
            title: 'Work-Life Balance',
            description: 'We respect your time outside work',
            details: [
                'No meeting Fridays',
                'Flexible schedules',
                'Mental health days',
                'Boundaries respected'
            ]
        },
        {
            icon: <FaBaby />,
            title: 'Parental Leave',
            description: 'Support for growing families',
            details: [
                '16 weeks paid leave',
                'Flexible return options',
                'Lactation support',
                'Parenting resources'
            ]
        },
        {
            icon: <FaPiggyBank />,
            title: 'Financial Wellness',
            description: 'Resources for financial health',
            details: [
                'Student loan assistance',
                'Financial advisors',
                'Budgeting tools',
                'Retirement planning'
            ]
        },
        {
            icon: <FaPlane />,
            title: 'Travel Benefits',
            description: 'Explore the world',
            details: [
                'Travel stipend',
                'Work from anywhere',
                'Team retreats',
                'Conference travel'
            ]
        }
    ];

    const stats = [
        { value: '100%', label: 'Health Coverage' },
        { value: '16', label: 'Weeks Parental Leave' },
        { value: '$2k', label: 'Learning Stipend' },
        { value: '4%', label: '401k Match' },
        { value: 'Unlimited', label: 'PTO' },
        { value: '20+', label: 'Countries' }
    ];

    return (
        <div className="benefits-page">
            {}
            <section className="benefits-hero">
                <div className="container">
                    <motion.div
                        className="hero-content"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <h1>
                            Benefits & Perks
                            <span className="gradient-text"> ❤️</span>
                        </h1>
                        <p className="hero-description">
                            We take care of our team so they can focus on what matters most -
                            building amazing products and helping our users.
                        </p>
                    </motion.div>

                    <div className="stats-grid">
                        {stats.map((stat, index) => (
                            <motion.div
                                key={index}
                                className="stat-card"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                <div className="stat-value">{stat.value}</div>
                                <div className="stat-label">{stat.label}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {}
            <section className="benefits-grid-section">
                <div className="container">
                    <motion.div
                        className="section-header"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <h2>Comprehensive Benefits Package</h2>
                        <p>We're committed to supporting you in every aspect of your life</p>
                    </motion.div>

                    <div className="benefits-grid">
                        {benefits.map((benefit, index) => (
                            <motion.div
                                key={index}
                                className="benefit-card"
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.05 }}
                                whileHover={{ y: -10 }}
                            >
                                <div className="benefit-icon">{benefit.icon}</div>
                                <h3>{benefit.title}</h3>
                                <p className="benefit-description">{benefit.description}</p>
                                <ul className="benefit-details">
                                    {benefit.details.map((detail, i) => (
                                        <li key={i}>✓ {detail}</li>
                                    ))}
                                </ul>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            
            <section className="testimonials-section">
                <div className="container">
                    <motion.div
                        className="section-header"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <h2>What Our Team Says</h2>
                        <p>Real stories from real people</p>
                    </motion.div>

                    <div className="testimonials-grid">
                        <motion.div
                            className="testimonial-card"
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                        >
                            <p className="testimonial-text">
                                "The benefits at Welp are incredible. The parental leave policy allowed me to
                                spend quality time with my newborn without worrying about work."
                            </p>
                            <div className="testimonial-author">
                                <div className="author-avatar">SJ</div>
                                <div className="author-info">
                                    <h4>Sarah Johnson</h4>
                                    <p>Senior Developer, 3 years</p>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            className="testimonial-card"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                        >
                            <p className="testimonial-text">
                                "I've used my learning stipend to attend conferences and take courses that
                                have accelerated my career growth. The support is amazing!"
                            </p>
                            <div className="testimonial-author">
                                <div className="author-avatar">MC</div>
                                <div className="author-info">
                                    <h4>Mike Chen</h4>
                                    <p>Product Manager, 2 years</p>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            className="testimonial-card"
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                        >
                            <p className="testimonial-text">
                                "The remote-first culture and flexible hours have completely transformed my
                                work-life balance. I'm more productive and happier than ever."
                            </p>
                            <div className="testimonial-author">
                                <div className="author-avatar">AR</div>
                                <div className="author-info">
                                    <h4>Alex Rivera</h4>
                                    <p>UX Designer, 4 years</p>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            
            <section className="benefits-cta">
                <div className="container">
                    <motion.div
                        className="cta-content"
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <h2>Ready to experience these benefits?</h2>
                        <p>Join our team and start enjoying a career that supports your whole life.</p>
                        <div className="cta-buttons">
                            <Link to="/careers" className="btn btn-primary btn-large">
                                View Open Positions
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>

            <style>{`
                .benefits-page {
                    overflow-x: hidden;
                }

                
                .benefits-hero {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 5rem 0;
                    text-align: center;
                }

                .hero-content {
                    max-width: 800px;
                    margin: 0 auto 3rem;
                }

                .hero-content h1 {
                    font-size: 3rem;
                    margin-bottom: 1rem;
                }

                .gradient-text {
                    background: linear-gradient(135deg, #fff 0%, #ffeaa7 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .hero-description {
                    font-size: 1.2rem;
                    opacity: 0.95;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 2rem;
                    max-width: 800px;
                    margin: 0 auto;
                }

                .stat-card {
                    text-align: center;
                }

                .stat-value {
                    font-size: 2.5rem;
                    font-weight: 800;
                    margin-bottom: 0.5rem;
                }

                .stat-label {
                    font-size: 1rem;
                    opacity: 0.9;
                }

                
                .benefits-grid-section {
                    padding: 5rem 0;
                }

                .section-header {
                    text-align: center;
                    margin-bottom: 3rem;
                }

                .section-header h2 {
                    font-size: 2.5rem;
                    color: #2d3748;
                    margin-bottom: 1rem;
                }

                .section-header p {
                    color: #718096;
                    font-size: 1.2rem;
                }

                .benefits-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                    gap: 2rem;
                }

                .benefit-card {
                    background: white;
                    padding: 2rem;
                    border-radius: 16px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                    transition: all 0.3s;
                }

                .benefit-card:hover {
                    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
                }

                .benefit-icon {
                    font-size: 2.5rem;
                    color: #667eea;
                    margin-bottom: 1rem;
                }

                .benefit-card h3 {
                    color: #2d3748;
                    font-size: 1.3rem;
                    margin-bottom: 0.5rem;
                }

                .benefit-description {
                    color: #718096;
                    margin-bottom: 1rem;
                    line-height: 1.6;
                }

                .benefit-details {
                    list-style: none;
                    padding: 0;
                }

                .benefit-details li {
                    color: #4a5568;
                    padding: 0.25rem 0;
                    font-size: 0.95rem;
                }

                
                .testimonials-section {
                    padding: 5rem 0;
                    background: #f7fafc;
                }

                .testimonials-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 2rem;
                }

                .testimonial-card {
                    background: white;
                    padding: 2rem;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                }

                .testimonial-text {
                    color: #4a5568;
                    font-style: italic;
                    line-height: 1.8;
                    margin-bottom: 1.5rem;
                }

                .testimonial-author {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .author-avatar {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                }

                .author-info h4 {
                    color: #2d3748;
                    margin-bottom: 0.25rem;
                }

                .author-info p {
                    color: #718096;
                    font-size: 0.9rem;
                }

                
                .benefits-cta {
                    padding: 5rem 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }

                .cta-content {
                    text-align: center;
                    max-width: 700px;
                    margin: 0 auto;
                }

                .cta-content h2 {
                    font-size: 2.5rem;
                    margin-bottom: 1rem;
                }

                .cta-content p {
                    font-size: 1.2rem;
                    margin-bottom: 2rem;
                    opacity: 0.95;
                }

                .cta-buttons {
                    display: flex;
                    gap: 1rem;
                    justify-content: center;
                }

                .btn-primary,
                .btn-secondary {
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 600;
                    text-decoration: none;
                    transition: all 0.3s;
                    display: inline-block;
                }

                .btn-primary {
                    background: white;
                    color: #667eea;
                }

                .btn-primary:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);
                }

                .btn-secondary {
                    background: rgba(255,255,255,0.2);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.3);
                }

                .btn-secondary:hover {
                    background: rgba(255,255,255,0.3);
                }

                .btn-large {
                    padding: 1rem 2rem;
                    font-size: 1.1rem;
                }

                @media (max-width: 768px) {
                    .hero-content h1 {
                        font-size: 2rem;
                    }

                    .stats-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }

                    .benefits-grid {
                        grid-template-columns: 1fr;
                    }

                    .testimonials-grid {
                        grid-template-columns: 1fr;
                    }

                    .cta-buttons {
                        flex-direction: column;
                    }
                }
            `}</style>
        </div>
    );
};

export default Benefits;