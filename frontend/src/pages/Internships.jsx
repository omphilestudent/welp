
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    FaGraduationCap,
    FaBriefcase,
    FaMapMarkerAlt,
    FaClock,
    FaDollarSign,
    FaUsers,
    FaChalkboardTeacher,
    FaRocket,
    FaHeart,
    FaLaptop,
    FaSearch,
    FaFilter,
    FaCalendarAlt
} from 'react-icons/fa';
import api from '../services/api';
import Loading from '../components/common/Loading';

const Internships = () => {
    const [internships, setInternships] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('all');

    const departments = [
        'Engineering',
        'Product',
        'Design',
        'Marketing',
        'HR',
        'Operations'
    ];

    useEffect(() => {
        fetchInternships();
    }, []);

    const fetchInternships = async () => {
        setLoading(true);
        try {

            const mockInternships = [
                {
                    id: 1,
                    title: 'Software Engineering Intern',
                    department: 'Engineering',
                    location: 'Remote',
                    duration: '3 months',
                    stipend: '$2,500/month',
                    description: 'Join our engineering team for a hands-on internship building real products.',
                    requirements: [
                        'Currently pursuing CS or related degree',
                        'Knowledge of JavaScript/Python',
                        'Eager to learn',
                        'Good communication skills'
                    ],
                    startDate: 'June 2024',
                    applications: 45,
                    spots: 5
                },
                {
                    id: 2,
                    title: 'Product Management Intern',
                    department: 'Product',
                    location: 'San Francisco, CA',
                    duration: '6 months',
                    stipend: '$2,000/month',
                    description: 'Learn product management from experienced PMs and work on real features.',
                    requirements: [
                        'Currently pursuing business or technical degree',
                        'Analytical mindset',
                        'Excellent communication',
                        'Passion for technology'
                    ],
                    startDate: 'May 2024',
                    applications: 32,
                    spots: 3
                },
                {
                    id: 3,
                    title: 'UX Design Intern',
                    department: 'Design',
                    location: 'Remote',
                    duration: '4 months',
                    stipend: '$2,200/month',
                    description: 'Work alongside senior designers and contribute to our design system.',
                    requirements: [
                        'Portfolio of design work',
                        'Figma proficiency',
                        'User-centered approach',
                        'Attention to detail'
                    ],
                    startDate: 'June 2024',
                    applications: 28,
                    spots: 4
                },
                {
                    id: 4,
                    title: 'Marketing Intern',
                    department: 'Marketing',
                    location: 'New York, NY',
                    duration: '3 months',
                    stipend: '$1,800/month',
                    description: 'Help grow our brand and reach through various marketing channels.',
                    requirements: [
                        'Marketing or communications major',
                        'Social media savvy',
                        'Creative thinker',
                        'Strong writing skills'
                    ],
                    startDate: 'July 2024',
                    applications: 19,
                    spots: 2
                },
                {
                    id: 5,
                    title: 'Data Science Intern',
                    department: 'Engineering',
                    location: 'Remote',
                    duration: '6 months',
                    stipend: '$2,500/month',
                    description: 'Work with big data and machine learning to derive insights.',
                    requirements: [
                        'Strong math/statistics background',
                        'Python and SQL skills',
                        'Experience with data visualization',
                        'Curiosity and analytical thinking'
                    ],
                    startDate: 'June 2024',
                    applications: 37,
                    spots: 3
                },
                {
                    id: 6,
                    title: 'HR Intern',
                    department: 'HR',
                    location: 'Austin, TX',
                    duration: '3 months',
                    stipend: '$1,600/month',
                    description: 'Learn about HR operations and employee relations.',
                    requirements: [
                        'HR or business major',
                        'Excellent interpersonal skills',
                        'Organized and detail-oriented',
                        'Discretion with sensitive information'
                    ],
                    startDate: 'May 2024',
                    applications: 15,
                    spots: 2
                }
            ];
            setInternships(mockInternships);
        } catch (error) {
            console.error('Failed to fetch internships:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredInternships = internships.filter(internship => {
        const matchesSearch = internship.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            internship.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDepartment = selectedDepartment === 'all' || internship.department === selectedDepartment;
        return matchesSearch && matchesDepartment;
    });

    if (loading) return <Loading />;

    return (
        <div className="internships-page">
            {}
            <section className="internships-hero">
                <div className="container">
                    <motion.div
                        className="hero-content"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <h1>
                            <FaGraduationCap className="hero-icon" />
                            Internships at Welp
                        </h1>
                        <p className="hero-description">
                            Kickstart your career with hands-on experience, mentorship, and real impact.
                            Join our internship program and work alongside industry experts.
                        </p>
                    </motion.div>
                </div>
            </section>

            {}
            <section className="highlights-section">
                <div className="container">
                    <div className="highlights-grid">
                        <motion.div
                            className="highlight-card"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5 }}
                        >
                            <FaChalkboardTeacher className="highlight-icon" />
                            <h3>Mentorship</h3>
                            <p>Work 1-on-1 with experienced mentors who guide your growth</p>
                        </motion.div>

                        <motion.div
                            className="highlight-card"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.1 }}
                        >
                            <FaRocket className="highlight-icon" />
                            <h3>Real Impact</h3>
                            <p>Work on real projects that ship to millions of users</p>
                        </motion.div>

                        <motion.div
                            className="highlight-card"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                        >
                            <FaUsers className="highlight-icon" />
                            <h3>Inclusive Culture</h3>
                            <p>Join a diverse and welcoming community of learners</p>
                        </motion.div>

                        <motion.div
                            className="highlight-card"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                        >
                            <FaLaptop className="highlight-icon" />
                            <h3>Remote Friendly</h3>
                            <p>Most internships offer remote or hybrid options</p>
                        </motion.div>
                    </div>
                </div>
            </section>

            {}
            <section className="listings-section">
                <div className="container">
                    <div className="listings-header">
                        <h2>Open Internships</h2>

                        {}
                        <div className="search-filter">
                            <div className="search-box">
                                <FaSearch className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search internships..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <select
                                value={selectedDepartment}
                                onChange={(e) => setSelectedDepartment(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">All Departments</option>
                                {departments.map(dept => (
                                    <option key={dept} value={dept}>{dept}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="internships-grid">
                        {filteredInternships.map((internship, index) => (
                            <motion.div
                                key={internship.id}
                                className="internship-card"
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                whileHover={{ y: -5 }}
                            >
                                <div className="card-header">
                                    <h3>{internship.title}</h3>
                                    <span className="department-tag">{internship.department}</span>
                                </div>

                                <div className="card-meta">
                                    <span><FaMapMarkerAlt /> {internship.location}</span>
                                    <span><FaClock /> {internship.duration}</span>
                                    <span><FaDollarSign /> {internship.stipend}</span>
                                    <span><FaCalendarAlt /> Starts {internship.startDate}</span>
                                </div>

                                <p className="card-description">{internship.description}</p>

                                <div className="requirements">
                                    <h4>Requirements:</h4>
                                    <ul>
                                        {internship.requirements.map((req, i) => (
                                            <li key={i}>✓ {req}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="card-footer">
                                    <div className="applications">
                                        <FaUsers />
                                        <span>{internship.applications} applicants • {internship.spots} spots</span>
                                    </div>
                                    <Link to={`/careers/apply/${internship.id}`} className="apply-btn">
                                        Apply Now
                                    </Link>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {filteredInternships.length === 0 && (
                        <div className="no-results">
                            <FaSearch size={48} />
                            <h3>No internships found</h3>
                            <p>Try adjusting your search or check back later</p>
                        </div>
                    )}
                </div>
            </section>

            {}
            <section className="faq-section">
                <div className="container">
                    <h2>Frequently Asked Questions</h2>

                    <div className="faq-grid">
                        <div className="faq-item">
                            <h3>Who can apply for internships?</h3>
                            <p>Current students and recent graduates (within 12 months) are eligible to apply for our internship programs.</p>
                        </div>

                        <div className="faq-item">
                            <h3>Are internships paid?</h3>
                            <p>Yes, all our internships are paid positions with competitive stipends based on location and role.</p>
                        </div>

                        <div className="faq-item">
                            <h3>Do you offer remote internships?</h3>
                            <p>Many of our internships offer remote or hybrid options. Check individual listings for details.</p>
                        </div>

                        <div className="faq-item">
                            <h3>What is the application process?</h3>
                            <p>Submit your application online, followed by interviews with the team. Selected candidates will be notified within 2-3 weeks.</p>
                        </div>

                        <div className="faq-item">
                            <h3>Can international students apply?</h3>
                            <p>Yes, we welcome applications from international students. We provide visa support where needed.</p>
                        </div>

                        <div className="faq-item">
                            <h3>What happens after the internship?</h3>
                            <p>High-performing interns often receive full-time offers to join our team permanently.</p>
                        </div>
                    </div>
                </div>
            </section>

            <style>{`
                .internships-page {
                    overflow-x: hidden;
                }

                
                .internships-hero {
                    background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
                    color: white;
                    padding: 5rem 0;
                    text-align: center;
                }

                .hero-content {
                    max-width: 800px;
                    margin: 0 auto;
                }

                .hero-content h1 {
                    font-size: 3rem;
                    margin-bottom: 1rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 1rem;
                }

                .hero-icon {
                    font-size: 3rem;
                }

                .hero-description {
                    font-size: 1.2rem;
                    opacity: 0.95;
                }

                
                .highlights-section {
                    padding: 4rem 0;
                }

                .highlights-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 2rem;
                }

                .highlight-card {
                    text-align: center;
                    padding: 2rem;
                }

                .highlight-icon {
                    font-size: 2.5rem;
                    color: #48bb78;
                    margin-bottom: 1rem;
                }

                .highlight-card h3 {
                    color: #2d3748;
                    margin-bottom: 0.5rem;
                }

                .highlight-card p {
                    color: #718096;
                }

                
                .listings-section {
                    padding: 4rem 0;
                    background: #f7fafc;
                }

                .listings-header {
                    margin-bottom: 2rem;
                }

                .listings-header h2 {
                    color: #2d3748;
                    margin-bottom: 1.5rem;
                }

                .search-filter {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 2rem;
                }

                .search-box {
                    flex: 1;
                    position: relative;
                }

                .search-icon {
                    position: absolute;
                    left: 1rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #a0aec0;
                }

                .search-box input {
                    width: 100%;
                    padding: 0.75rem 1rem 0.75rem 2.5rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                }

                .filter-select {
                    padding: 0.75rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    min-width: 200px;
                }

                .internships-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                    gap: 2rem;
                }

                .internship-card {
                    background: white;
                    border-radius: 12px;
                    padding: 1.5rem;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                }

                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .card-header h3 {
                    color: #2d3748;
                }

                .department-tag {
                    padding: 0.25rem 0.75rem;
                    background: #e6f7ff;
                    color: #3182ce;
                    border-radius: 30px;
                    font-size: 0.85rem;
                }

                .card-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .card-meta span {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    color: #718096;
                    font-size: 0.9rem;
                }

                .card-description {
                    color: #4a5568;
                    margin-bottom: 1rem;
                    line-height: 1.6;
                }

                .requirements {
                    margin-bottom: 1rem;
                }

                .requirements h4 {
                    color: #2d3748;
                    margin-bottom: 0.5rem;
                }

                .requirements ul {
                    list-style: none;
                    padding: 0;
                }

                .requirements li {
                    color: #4a5568;
                    padding: 0.25rem 0;
                    font-size: 0.95rem;
                }

                .card-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 1rem;
                    padding-top: 1rem;
                    border-top: 1px solid #e2e8f0;
                }

                .applications {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: #718096;
                }

                .apply-btn {
                    background: #48bb78;
                    color: white;
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    text-decoration: none;
                    transition: all 0.3s;
                }

                .apply-btn:hover {
                    background: #38a169;
                }

                .no-results {
                    text-align: center;
                    padding: 4rem 2rem;
                }

                .no-results svg {
                    color: #cbd5e0;
                    margin-bottom: 1rem;
                }

                .no-results h3 {
                    color: #2d3748;
                    margin-bottom: 0.5rem;
                }

                .no-results p {
                    color: #718096;
                }

                
                .faq-section {
                    padding: 4rem 0;
                }

                .faq-section h2 {
                    text-align: center;
                    color: #2d3748;
                    margin-bottom: 2rem;
                }

                .faq-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                    gap: 2rem;
                }

                .faq-item {
                    background: #f7fafc;
                    padding: 1.5rem;
                    border-radius: 8px;
                }

                .faq-item h3 {
                    color: #2d3748;
                    margin-bottom: 0.5rem;
                }

                .faq-item p {
                    color: #718096;
                    line-height: 1.6;
                }

                @media (max-width: 768px) {
                    .hero-content h1 {
                        font-size: 2rem;
                    }

                    .search-filter {
                        flex-direction: column;
                    }

                    .filter-select {
                        width: 100%;
                    }

                    .internships-grid {
                        grid-template-columns: 1fr;
                    }

                    .faq-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
};

export default Internships;