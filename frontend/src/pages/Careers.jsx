// frontend/src/pages/Careers.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    FaBriefcase,
    FaMapMarkerAlt,
    FaClock,
    FaBuilding,
    FaUsers,
    FaHeart,
    FaCoffee,
    FaLaptop,
    FaMedal,
    FaSearch,
    FaFilter,
    FaGlobe,
    FaGraduationCap,
    FaChartLine,
    FaRocket,
    FaHandsHelping,
    FaCalendarAlt
} from 'react-icons/fa';
import api from '../services/api';
import Loading from '../components/common/Loading';

const Careers = () => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('all');
    const [selectedLocation, setSelectedLocation] = useState('all');
    const [selectedType, setSelectedType] = useState('all');

    const departments = [
        'Engineering',
        'Product',
        'Design',
        'Marketing',
        'Sales',
        'HR',
        'Operations',
        'Finance'
    ];

    const locations = [
        'Remote',
        'San Francisco, CA',
        'New York, NY',
        'Austin, TX',
        'Seattle, WA',
        'London, UK',
        'Berlin, Germany',
        'Singapore'
    ];

    const jobTypes = [
        'Full-time',
        'Part-time',
        'Contract',
        'Internship',
        'Remote'
    ];

    const benefits = [
        { icon: <FaHeart />, title: 'Health & Wellness', description: 'Comprehensive health, dental, and vision insurance' },
        { icon: <FaLaptop />, title: 'Remote First', description: 'Work from anywhere with home office stipend' },
        { icon: <FaClock />, title: 'Flexible Hours', description: 'Create your own schedule' },
        { icon: <FaGraduationCap />, title: 'Learning Budget', description: '$2000/year for professional development' },
        { icon: <FaMedal />, title: '401k Matching', description: '4% matching to secure your future' },
        { icon: <FaCoffee />, title: 'Wellness Days', description: '15 wellness days + unlimited PTO' },
        { icon: <FaUsers />, title: 'Team Events', description: 'Regular team building and retreats' },
        { icon: <FaGlobe />, title: 'Global Team', description: 'Work with colleagues from 20+ countries' }
    ];

    useEffect(() => {
        fetchJobs();
    }, []);

    const fetchJobs = async () => {
        setLoading(true);
        try {
            // Mock data - replace with API call
            const mockJobs = [
                {
                    id: 1,
                    title: 'Senior Frontend Developer',
                    department: 'Engineering',
                    location: 'Remote',
                    type: 'Full-time',
                    experience: '5+ years',
                    salary: '$120k - $150k',
                    description: 'We are looking for an experienced Frontend Developer to join our team...',
                    responsibilities: [
                        'Build responsive and performant web applications',
                        'Collaborate with designers and backend engineers',
                        'Mentor junior developers',
                        'Participate in code reviews'
                    ],
                    requirements: [
                        '5+ years of experience with React',
                        'Strong TypeScript skills',
                        'Experience with Next.js',
                        'Understanding of web performance optimization'
                    ],
                    postedDate: '2024-01-15',
                    featured: true
                },
                {
                    id: 2,
                    title: 'Product Manager',
                    department: 'Product',
                    location: 'San Francisco, CA',
                    type: 'Full-time',
                    experience: '3+ years',
                    salary: '$110k - $140k',
                    description: 'Seeking a Product Manager to lead our flagship product...',
                    responsibilities: [
                        'Define product strategy and roadmap',
                        'Work with engineering and design teams',
                        'Conduct user research',
                        'Analyze product metrics'
                    ],
                    requirements: [
                        '3+ years of product management experience',
                        'Strong analytical skills',
                        'Excellent communication skills',
                        'Experience with Agile methodologies'
                    ],
                    postedDate: '2024-01-14',
                    featured: true
                },
                {
                    id: 3,
                    title: 'UX Designer',
                    department: 'Design',
                    location: 'New York, NY',
                    type: 'Full-time',
                    experience: '3+ years',
                    salary: '$90k - $120k',
                    description: 'Join our design team to create beautiful and intuitive experiences...',
                    responsibilities: [
                        'Create user flows and wireframes',
                        'Design high-fidelity mockups',
                        'Conduct user testing',
                        'Maintain design system'
                    ],
                    requirements: [
                        '3+ years of UX design experience',
                        'Proficiency in Figma',
                        'Portfolio of work',
                        'User-centered design approach'
                    ],
                    postedDate: '2024-01-14',
                    featured: false
                },
                {
                    id: 4,
                    title: 'DevOps Engineer',
                    department: 'Engineering',
                    location: 'Austin, TX',
                    type: 'Full-time',
                    experience: '4+ years',
                    salary: '$130k - $160k',
                    description: 'Looking for a DevOps engineer to manage our cloud infrastructure...',
                    responsibilities: [
                        'Manage AWS infrastructure',
                        'Implement CI/CD pipelines',
                        'Monitor system performance',
                        'Ensure security best practices'
                    ],
                    requirements: [
                        '4+ years of DevOps experience',
                        'AWS certification',
                        'Experience with Kubernetes',
                        'Infrastructure as Code (Terraform)'
                    ],
                    postedDate: '2024-01-13',
                    featured: true
                },
                {
                    id: 5,
                    title: 'HR Business Partner',
                    department: 'HR',
                    location: 'Remote',
                    type: 'Full-time',
                    experience: '5+ years',
                    salary: '$95k - $120k',
                    description: 'We are seeking an HR Business Partner to support our growing team...',
                    responsibilities: [
                        'Manage employee relations',
                        'Lead recruitment efforts',
                        'Develop HR policies',
                        'Coordinate performance reviews'
                    ],
                    requirements: [
                        '5+ years of HR experience',
                        'Knowledge of employment law',
                        'Excellent interpersonal skills',
                        'HR certification preferred'
                    ],
                    postedDate: '2024-01-12',
                    featured: false
                },
                {
                    id: 6,
                    title: 'Backend Developer Intern',
                    department: 'Engineering',
                    location: 'Remote',
                    type: 'Internship',
                    experience: '0-1 years',
                    salary: '$25/hour',
                    description: 'Join our backend team as an intern to learn and grow...',
                    responsibilities: [
                        'Build APIs under guidance',
                        'Write unit tests',
                        'Participate in code reviews',
                        'Learn from senior engineers'
                    ],
                    requirements: [
                        'Currently pursuing CS degree',
                        'Knowledge of Node.js',
                        'Eager to learn',
                        'Good communication skills'
                    ],
                    postedDate: '2024-01-11',
                    featured: false
                }
            ];
            setJobs(mockJobs);
        } catch (error) {
            console.error('Failed to fetch jobs:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredJobs = jobs.filter(job => {
        const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.description.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesDepartment = selectedDepartment === 'all' || job.department === selectedDepartment;
        const matchesLocation = selectedLocation === 'all' || job.location === selectedLocation;
        const matchesType = selectedType === 'all' || job.type === selectedType;
        return matchesSearch && matchesDepartment && matchesLocation && matchesType;
    });

    const featuredJobs = filteredJobs.filter(job => job.featured);
    const regularJobs = filteredJobs.filter(job => !job.featured);

    if (loading) return <Loading />;

    return (
        <div className="careers-page">
            {/* Hero Section */}
            <section className="careers-hero">
                <div className="hero-particles"></div>
                <div className="container">
                    <motion.div
                        className="hero-content"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <h1>
                            Join Us in Building the Future of Work
                            <span className="gradient-text"> 🚀</span>
                        </h1>
                        <p className="hero-description">
                            We're on a mission to make workplaces better through honest reviews and wellbeing support.
                            Join our global team and help us create a positive impact on millions of employees worldwide.
                        </p>

                        <div className="hero-stats">
                            <div className="stat-item">
                                <span className="stat-number">20+</span>
                                <span className="stat-label">Countries</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-number">150+</span>
                                <span className="stat-label">Team Members</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-number">4.8</span>
                                <span className="stat-label">Glassdoor Rating</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-number">100%</span>
                                <span className="stat-label">Remote First</span>
                            </div>
                        </div>

                        <div className="hero-cta">
                            <Link to="#openings" className="btn btn-primary btn-large">
                                View Open Positions
                            </Link>
                            <Link to="#culture" className="btn btn-secondary btn-large">
                                Learn About Our Culture
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Benefits Section */}
            <section className="benefits-section" id="culture">
                <div className="container">
                    <motion.div
                        className="section-header"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <h2>Why Join Welp?</h2>
                        <p>We take care of our team so they can take care of our users</p>
                    </motion.div>

                    <div className="benefits-grid">
                        {benefits.map((benefit, index) => (
                            <motion.div
                                key={index}
                                className="benefit-card"
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                                whileHover={{ y: -10 }}
                            >
                                <div className="benefit-icon">{benefit.icon}</div>
                                <h3>{benefit.title}</h3>
                                <p>{benefit.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Culture Section */}
            <section className="culture-section">
                <div className="container">
                    <motion.div
                        className="section-header"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <h2>Our Culture & Values</h2>
                        <p>What makes Welp a great place to work</p>
                    </motion.div>

                    <div className="culture-grid">
                        <motion.div
                            className="culture-card"
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                        >
                            <FaRocket className="culture-icon" />
                            <h3>Innovation First</h3>
                            <p>We encourage creativity and give you the freedom to experiment and innovate.</p>
                        </motion.div>

                        <motion.div
                            className="culture-card"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                        >
                            <FaUsers className="culture-icon" />
                            <h3>Diverse & Inclusive</h3>
                            <p>We celebrate differences and create an environment where everyone belongs.</p>
                        </motion.div>

                        <motion.div
                            className="culture-card"
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                        >
                            <FaHandsHelping className="culture-icon" />
                            <h3>Supportive Team</h3>
                            <p>We help each other grow and succeed through mentorship and collaboration.</p>
                        </motion.div>

                        <motion.div
                            className="culture-card"
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                        >
                            <FaChartLine className="culture-icon" />
                            <h3>Growth Mindset</h3>
                            <p>We invest in your professional development with learning budgets and mentorship.</p>
                        </motion.div>

                        <motion.div
                            className="culture-card"
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.4 }}
                        >
                            <FaClock className="culture-icon" />
                            <h3>Work-Life Balance</h3>
                            <p>We trust you to manage your time and prioritize what matters most.</p>
                        </motion.div>

                        <motion.div
                            className="culture-card"
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: 0.5 }}
                        >
                            <FaGlobe className="culture-icon" />
                            <h3>Global Impact</h3>
                            <p>Your work will positively impact employees in over 20 countries.</p>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Job Openings Section */}
            <section className="jobs-section" id="openings">
                <div className="container">
                    <motion.div
                        className="section-header"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <h2>Open Positions</h2>
                        <p>Find your next role at Welp</p>
                    </motion.div>

                    {/* Search and Filters */}
                    <div className="job-filters">
                        <div className="search-box">
                            <FaSearch className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search jobs by title or description..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="filter-group">
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

                            <select
                                value={selectedLocation}
                                onChange={(e) => setSelectedLocation(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">All Locations</option>
                                {locations.map(loc => (
                                    <option key={loc} value={loc}>{loc}</option>
                                ))}
                            </select>

                            <select
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value)}
                                className="filter-select"
                            >
                                <option value="all">All Types</option>
                                {jobTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Featured Jobs */}
                    {featuredJobs.length > 0 && (
                        <div className="featured-jobs">
                            <h3>Featured Opportunities</h3>
                            <div className="jobs-grid">
                                {featuredJobs.map((job, index) => (
                                    <motion.div
                                        key={job.id}
                                        className="job-card featured"
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.5, delay: index * 0.1 }}
                                        whileHover={{ y: -5 }}
                                    >
                                        <div className="job-badge">Featured</div>
                                        <div className="job-header">
                                            <h3>{job.title}</h3>
                                            <span className="job-department">{job.department}</span>
                                        </div>
                                        <div className="job-meta">
                                            <span><FaMapMarkerAlt /> {job.location}</span>
                                            <span><FaBriefcase /> {job.type}</span>
                                            <span><FaClock /> {job.experience}</span>
                                        </div>
                                        <p className="job-description">{job.description}</p>
                                        <div className="job-footer">
                                            <span className="job-salary">{job.salary}</span>
                                            <Link to={`/careers/jobs/${job.id}`} className="btn btn-primary">
                                                View Details
                                            </Link>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* All Jobs */}
                    <div className="all-jobs">
                        <h3>All Openings</h3>
                        <div className="jobs-list">
                            {regularJobs.map((job, index) => (
                                <motion.div
                                    key={job.id}
                                    className="job-list-item"
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.3, delay: index * 0.05 }}
                                >
                                    <div className="job-item-content">
                                        <div className="job-item-header">
                                            <h4>{job.title}</h4>
                                            <span className="job-item-department">{job.department}</span>
                                        </div>
                                        <div className="job-item-meta">
                                            <span><FaMapMarkerAlt /> {job.location}</span>
                                            <span><FaBriefcase /> {job.type}</span>
                                            <span><FaClock /> {job.experience}</span>
                                            <span className="job-item-salary">{job.salary}</span>
                                        </div>
                                    </div>
                                    <Link to={`/careers/jobs/${job.id}`} className="btn btn-secondary">
                                        Apply Now
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {filteredJobs.length === 0 && (
                        <div className="no-jobs">
                            <FaSearch size={48} />
                            <h3>No jobs found</h3>
                            <p>Try adjusting your search or filter criteria</p>
                        </div>
                    )}
                </div>
            </section>

            {/* CTA Section */}
            <section className="careers-cta">
                <div className="container">
                    <motion.div
                        className="cta-content"
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                    >
                        <h2>Don't see the right role?</h2>
                        <p>We're always looking for talented people to join our team. Send us your resume and we'll keep you in mind for future opportunities.</p>
                        <div className="cta-buttons">
                            <Link to="/careers/apply/general" className="btn btn-primary btn-large">
                                Submit General Application
                            </Link>
                            <Link to="/contact" className="btn btn-secondary btn-large">
                                Contact Recruiting
                            </Link>
                        </div>
                    </motion.div>
                </div>
            </section>

            <style>{`
                .careers-page {
                    overflow-x: hidden;
                }

                /* Hero Section */
                .careers-hero {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 6rem 0;
                    position: relative;
                    overflow: hidden;
                }

                .hero-particles {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-image: 
                        radial-gradient(circle at 20% 30%, rgba(255,255,255,0.1) 0%, transparent 20%),
                        radial-gradient(circle at 80% 70%, rgba(255,255,255,0.1) 0%, transparent 20%),
                        radial-gradient(circle at 40% 80%, rgba(255,255,255,0.1) 0%, transparent 30%);
                    animation: float 20s ease-in-out infinite;
                }

                .hero-content {
                    position: relative;
                    z-index: 1;
                    text-align: center;
                    max-width: 800px;
                    margin: 0 auto;
                }

                .hero-content h1 {
                    font-size: 3rem;
                    margin-bottom: 1.5rem;
                    line-height: 1.2;
                }

                .gradient-text {
                    background: linear-gradient(135deg, #fff 0%, #ffeaa7 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .hero-description {
                    font-size: 1.2rem;
                    margin-bottom: 3rem;
                    opacity: 0.95;
                }

                .hero-stats {
                    display: flex;
                    justify-content: center;
                    gap: 3rem;
                    margin-bottom: 3rem;
                }

                .stat-item {
                    text-align: center;
                }

                .stat-number {
                    display: block;
                    font-size: 2rem;
                    font-weight: 800;
                    margin-bottom: 0.25rem;
                }

                .stat-label {
                    font-size: 0.9rem;
                    opacity: 0.9;
                }

                .hero-cta {
                    display: flex;
                    gap: 1rem;
                    justify-content: center;
                }

                /* Section Header */
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

                /* Benefits Section */
                .benefits-section {
                    padding: 5rem 0;
                    background: #f7fafc;
                }

                .benefits-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 2rem;
                }

                .benefit-card {
                    background: white;
                    padding: 2rem;
                    border-radius: 12px;
                    text-align: center;
                    transition: all 0.3s;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                }

                .benefit-icon {
                    font-size: 2.5rem;
                    color: #667eea;
                    margin-bottom: 1rem;
                }

                .benefit-card h3 {
                    color: #2d3748;
                    margin-bottom: 0.5rem;
                }

                .benefit-card p {
                    color: #718096;
                    line-height: 1.6;
                }

                /* Culture Section */
                .culture-section {
                    padding: 5rem 0;
                }

                .culture-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 2rem;
                }

                .culture-card {
                    padding: 2rem;
                    background: #f7fafc;
                    border-radius: 12px;
                    transition: all 0.3s;
                }

                .culture-card:hover {
                    transform: translateY(-5px);
                    background: white;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                }

                .culture-icon {
                    font-size: 2rem;
                    color: #667eea;
                    margin-bottom: 1rem;
                }

                .culture-card h3 {
                    color: #2d3748;
                    margin-bottom: 0.5rem;
                }

                .culture-card p {
                    color: #718096;
                    line-height: 1.6;
                }

                /* Jobs Section */
                .jobs-section {
                    padding: 5rem 0;
                    background: #f7fafc;
                }

                .job-filters {
                    margin-bottom: 3rem;
                }

                .search-box {
                    position: relative;
                    margin-bottom: 1rem;
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
                    padding: 1rem 1rem 1rem 3rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 1rem;
                }

                .filter-group {
                    display: flex;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .filter-select {
                    flex: 1;
                    min-width: 150px;
                    padding: 0.75rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    background: white;
                }

                .featured-jobs {
                    margin-bottom: 3rem;
                }

                .featured-jobs h3,
                .all-jobs h3 {
                    color: #2d3748;
                    margin-bottom: 1.5rem;
                }

                .jobs-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                    gap: 1.5rem;
                }

                .job-card {
                    background: white;
                    padding: 1.5rem;
                    border-radius: 12px;
                    position: relative;
                    transition: all 0.3s;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                }

                .job-card.featured {
                    border: 2px solid #667eea;
                }

                .job-badge {
                    position: absolute;
                    top: -10px;
                    right: 20px;
                    background: #667eea;
                    color: white;
                    padding: 0.25rem 1rem;
                    border-radius: 30px;
                    font-size: 0.8rem;
                    font-weight: 600;
                }

                .job-header {
                    margin-bottom: 1rem;
                }

                .job-header h3 {
                    color: #2d3748;
                    margin-bottom: 0.25rem;
                }

                .job-department {
                    color: #667eea;
                    font-size: 0.9rem;
                    font-weight: 500;
                }

                .job-meta {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1rem;
                    flex-wrap: wrap;
                }

                .job-meta span {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                    color: #718096;
                    font-size: 0.9rem;
                }

                .job-description {
                    color: #4a5568;
                    margin-bottom: 1rem;
                    line-height: 1.6;
                }

                .job-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .job-salary {
                    font-weight: 600;
                    color: #48bb78;
                }

                .jobs-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .job-list-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.5rem;
                    background: white;
                    border-radius: 8px;
                    transition: all 0.3s;
                }

                .job-list-item:hover {
                    transform: translateX(5px);
                    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                }

                .job-item-content {
                    flex: 1;
                }

                .job-item-header {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 0.5rem;
                }

                .job-item-header h4 {
                    color: #2d3748;
                }

                .job-item-department {
                    color: #667eea;
                    font-size: 0.85rem;
                    font-weight: 500;
                }

                .job-item-meta {
                    display: flex;
                    gap: 1.5rem;
                    color: #718096;
                    font-size: 0.9rem;
                }

                .job-item-meta span {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }

                .job-item-salary {
                    color: #48bb78;
                    font-weight: 500;
                }

                .no-jobs {
                    text-align: center;
                    padding: 4rem 2rem;
                    background: white;
                    border-radius: 12px;
                }

                .no-jobs svg {
                    color: #cbd5e0;
                    margin-bottom: 1rem;
                }

                .no-jobs h3 {
                    color: #2d3748;
                    margin-bottom: 0.5rem;
                }

                .no-jobs p {
                    color: #718096;
                }

                /* CTA Section */
                .careers-cta {
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

                /* Buttons */
                .btn {
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

                /* Animations */
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-20px); }
                }

                /* Responsive */
                @media (max-width: 768px) {
                    .hero-content h1 {
                        font-size: 2rem;
                    }

                    .hero-stats {
                        flex-wrap: wrap;
                        gap: 1.5rem;
                    }

                    .hero-cta {
                        flex-direction: column;
                    }

                    .filter-group {
                        flex-direction: column;
                    }

                    .job-list-item {
                        flex-direction: column;
                        gap: 1rem;
                        text-align: center;
                    }

                    .job-item-header {
                        flex-direction: column;
                        gap: 0.25rem;
                    }

                    .job-item-meta {
                        flex-wrap: wrap;
                        justify-content: center;
                    }

                    .cta-buttons {
                        flex-direction: column;
                    }
                }
            `}</style>
        </div>
    );
};

export default Careers;