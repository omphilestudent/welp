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
    FaCalendarAlt,
    FaDollarSign,
    FaLevelUpAlt,
    FaRegClock,
    FaCheckCircle,
    FaTimesCircle
} from 'react-icons/fa';
import api from '../services/api';
import Loading from '../components/common/Loading';
import toast from 'react-hot-toast';

const Careers = () => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDepartment, setSelectedDepartment] = useState('all');
    const [selectedLocation, setSelectedLocation] = useState('all');
    const [selectedType, setSelectedType] = useState('all');
    const [departments, setDepartments] = useState([]);
    const [locations, setLocations] = useState([]);
    const [jobTypes, setJobTypes] = useState([]);
    const [stats, setStats] = useState({
        total: 0,
        countries: 0,
        remote: 0
    });

    useEffect(() => {
        fetchJobs();
        fetchFilters();
    }, []);

    const fetchJobs = async () => {
        setLoading(true);
        try {
            // Try the standard HR jobs endpoint — fetch all and filter client-side
            // so we work regardless of whether a ?status= filter is supported.
            let response;
            try {
                response = await api.get('/hr/public/jobs');
            } catch (primaryErr) {
                // Fallback: some deployments expose a /jobs public route
                response = await api.get('/hr/public/jobs');
            }

            const raw = response.data;

            // Handle different response shapes: { data: [...] }, { jobs: [...] }, or plain array
            const jobsData = raw?.data ?? raw?.jobs ?? raw;
            const allJobs = Array.isArray(jobsData) ? jobsData : [];

            // Keep only published / open jobs for the public careers page
            const OPEN_STATUSES = ['open', 'published'];
            const openJobs = allJobs.filter(job =>
                OPEN_STATUSES.includes((job.status || '').toLowerCase())
            );

            const normalizedJobs = openJobs.map((job) => ({
                id: job.id,
                title: job.title || 'Untitled Position',
                department: job.department_name || job.department || 'Unassigned',
                location: job.location || 'Remote',
                type: job.employment_type || job.type || 'full-time',
                experience: job.experience_level || job.experience || 'Not specified',
                salary_min: job.salary_min ?? null,
                salary_max: job.salary_max ?? null,
                salary_currency: job.salary_currency || 'USD',
                description: job.description || '',
                requirements: Array.isArray(job.requirements) ? job.requirements : [],
                responsibilities: Array.isArray(job.responsibilities) ? job.responsibilities : [],
                benefits: Array.isArray(job.benefits) ? job.benefits : [],
                skills: Array.isArray(job.skills_required) ? job.skills_required : [],
                isRemote: job.is_remote || false,
                education: job.education_required || null,
                postedDate: job.created_at
                    ? new Date(job.created_at).toISOString()
                    : new Date().toISOString(),
                featured: job.is_featured || false,
                status: job.status
            }));

            setJobs(normalizedJobs);

            // Calculate hero stats
            const uniqueLocations = [...new Set(normalizedJobs.map(j => j.location))];
            const remoteCount = normalizedJobs.filter(
                j => j.isRemote || j.location.toLowerCase().includes('remote')
            ).length;
            const remotePercent = normalizedJobs.length > 0
                ? Math.round((remoteCount / normalizedJobs.length) * 100)
                : 0;

            setStats({
                total: normalizedJobs.length,
                countries: uniqueLocations.length,
                remote: remotePercent
            });
        } catch (error) {
            console.error('Failed to fetch jobs:', error);
            toast.error('Failed to load job listings');
            setJobs([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchFilters = async () => {
        try {
            const jobsResponse = await api.get('/hr/public/jobs');
            const jobsRaw = jobsResponse.data;
            const jobsData = jobsRaw?.data ?? jobsRaw?.jobs ?? jobsRaw;
            const list = Array.isArray(jobsData) ? jobsData : [];

            const uniqueDepartments = [...new Set(list.map((j) => j.department_name || j.department).filter(Boolean))];
            const uniqueLocations = [...new Set(list.map((j) => j.location).filter(Boolean))];
            const uniqueTypes = [...new Set(list.map((j) => j.employment_type || j.type).filter(Boolean))];

            setDepartments(uniqueDepartments);
            setLocations(uniqueLocations);
            setJobTypes(uniqueTypes);
        } catch (error) {
            console.error('Failed to fetch filters:', error);
        }
    };

    const formatSalary = (job) => {
        if (!job.salary_min && !job.salary_max) return null;
        const fmt = (n) => Number(n).toLocaleString();
        if (job.salary_min && job.salary_max) {
            return `${job.salary_currency} ${fmt(job.salary_min)} – ${fmt(job.salary_max)}`;
        }
        return job.salary_min ? `${job.salary_currency} ${fmt(job.salary_min)}+` : 'Negotiable';
    };

    const timeAgo = (dateString) => {
        const now = new Date();
        const posted = new Date(dateString);
        const days = Math.floor((now - posted) / (1000 * 60 * 60 * 24));
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
        return posted.toLocaleDateString();
    };

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

    const filteredJobs = jobs.filter(job => {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
            job.title.toLowerCase().includes(q) ||
            job.description.toLowerCase().includes(q) ||
            job.department.toLowerCase().includes(q);

        const matchesDepartment = selectedDepartment === 'all' || job.department === selectedDepartment;
        const matchesLocation   = selectedLocation   === 'all' || job.location   === selectedLocation;
        // Case-insensitive type match
        const matchesType       = selectedType       === 'all' ||
            job.type.toLowerCase() === selectedType.toLowerCase();

        return matchesSearch && matchesDepartment && matchesLocation && matchesType;
    });

    const featuredJobs = filteredJobs.filter(job => job.featured);
    const regularJobs  = filteredJobs.filter(job => !job.featured);

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
                                <span className="stat-number">{stats.countries}</span>
                                <span className="stat-label">Locations</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-number">{stats.total}</span>
                                <span className="stat-label">Open Positions</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-number">{stats.remote}%</span>
                                <span className="stat-label">Remote Friendly</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-number">4.8</span>
                                <span className="stat-label">Glassdoor Rating</span>
                            </div>
                        </div>

                        <div className="hero-cta">
                            <a href="#openings" className="btn btn-primary btn-large">
                                View Open Positions
                            </a>
                            <a href="#culture" className="btn btn-secondary btn-large">
                                Learn About Our Culture
                            </a>
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
                        {[
                            { icon: <FaRocket />, title: 'Innovation First', text: 'We encourage creativity and give you the freedom to experiment and innovate.', dir: 'x', val: -20 },
                            { icon: <FaUsers />, title: 'Diverse & Inclusive', text: 'We celebrate differences and create an environment where everyone belongs.', dir: 'y', val: 20 },
                            { icon: <FaHandsHelping />, title: 'Supportive Team', text: 'We help each other grow and succeed through mentorship and collaboration.', dir: 'x', val: 20 },
                            { icon: <FaChartLine />, title: 'Growth Mindset', text: 'We invest in your professional development with learning budgets and mentorship.', dir: 'x', val: -20 },
                            { icon: <FaClock />, title: 'Work-Life Balance', text: 'We trust you to manage your time and prioritize what matters most.', dir: 'y', val: 20 },
                            { icon: <FaGlobe />, title: 'Global Impact', text: 'Your work will positively impact employees in over 20 countries.', dir: 'x', val: 20 },
                        ].map(({ icon, title, text, dir, val }, i) => (
                            <motion.div
                                key={title}
                                className="culture-card"
                                initial={{ opacity: 0, [dir]: val }}
                                whileInView={{ opacity: 1, [dir]: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: i * 0.1 }}
                            >
                                <div className="culture-icon">{icon}</div>
                                <h3>{title}</h3>
                                <p>{text}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Jobs Section */}
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
                        <p>
                            {jobs.length > 0
                                ? `${jobs.length} opportunit${jobs.length === 1 ? 'y' : 'ies'} available right now`
                                : 'Find your next role at Welp'}
                        </p>
                    </motion.div>

                    {/* Filters */}
                    <div className="job-filters">
                        <div className="search-box">
                            <FaSearch className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search by title, department, or description…"
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
                                    <option key={type} value={type}>
                                        {type.charAt(0).toUpperCase() + type.slice(1)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Featured Jobs */}
                    {featuredJobs.length > 0 && (
                        <div className="featured-jobs">
                            <h3>Featured Opportunities</h3>
                            <div className="jobs-grid">
                                {featuredJobs.map((job, index) => {
                                    const salary = formatSalary(job);
                                    return (
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
                                                <span><FaMapMarkerAlt /> {job.location}{job.isRemote && ' 🌍'}</span>
                                                <span><FaBriefcase /> {job.type}</span>
                                                <span><FaLevelUpAlt /> {job.experience}</span>
                                            </div>
                                            {salary && (
                                                <div className="job-salary">
                                                    <FaDollarSign /> {salary}
                                                </div>
                                            )}
                                            <p className="job-description">
                                                {job.description.length > 150
                                                    ? job.description.substring(0, 150) + '…'
                                                    : job.description}
                                            </p>
                                            {job.skills.length > 0 && (
                                                <div className="skills-preview">
                                                    {job.skills.slice(0, 3).map((skill, i) => (
                                                        <span key={i} className="skill-tag">{skill}</span>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="job-footer">
                                                <span className="posted-date">
                                                    <FaRegClock /> {timeAgo(job.postedDate)}
                                                </span>
                                                <Link to={`/careers/jobs/${job.id}`} className="btn btn-primary">
                                                    View Details
                                                </Link>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* All Jobs */}
                    {regularJobs.length > 0 && (
                        <div className="all-jobs">
                            <h3>{featuredJobs.length > 0 ? 'All Openings' : 'Current Openings'}</h3>
                            <div className="jobs-list">
                                {regularJobs.map((job, index) => {
                                    const salary = formatSalary(job);
                                    return (
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
                                                    <span><FaMapMarkerAlt /> {job.location}{job.isRemote && ' 🌍'}</span>
                                                    <span><FaBriefcase /> {job.type}</span>
                                                    <span><FaLevelUpAlt /> {job.experience}</span>
                                                    {salary && (
                                                        <span className="job-item-salary">
                                                            <FaDollarSign /> {salary}
                                                        </span>
                                                    )}
                                                    <span className="job-item-posted">
                                                        <FaRegClock /> {timeAgo(job.postedDate)}
                                                    </span>
                                                </div>
                                                {job.skills.length > 0 && (
                                                    <div className="job-item-skills">
                                                        {job.skills.slice(0, 4).map((skill, i) => (
                                                            <span key={i} className="skill-tag-small">{skill}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <Link to={`/careers/jobs/${job.id}`} className="btn btn-apply">
                                                Apply Now
                                            </Link>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {filteredJobs.length === 0 && (
                        <motion.div
                            className="no-jobs"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                        >
                            <FaSearch size={48} />
                            {jobs.length === 0 ? (
                                <>
                                    <h3>No open positions right now</h3>
                                    <p>We're not actively hiring at the moment, but check back soon for new openings.</p>
                                </>
                            ) : (
                                <>
                                    <h3>No jobs match your search</h3>
                                    <p>Try adjusting your filters or search term</p>
                                    <button
                                        className="btn btn-reset"
                                        onClick={() => {
                                            setSearchTerm('');
                                            setSelectedDepartment('all');
                                            setSelectedLocation('all');
                                            setSelectedType('all');
                                        }}
                                    >
                                        Reset Filters
                                    </button>
                                </>
                            )}
                        </motion.div>
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
                        <p>Follow us for upcoming openings and reach out to recruiting for future opportunities.</p>
                        <div className="cta-buttons">
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

                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0 2rem;
                }

                /* Hero */
                .careers-hero {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 6rem 0;
                    position: relative;
                    overflow: hidden;
                }

                .hero-particles {
                    position: absolute;
                    inset: 0;
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

                .stat-item { text-align: center; }

                .stat-number {
                    display: block;
                    font-size: 2rem;
                    font-weight: 800;
                    margin-bottom: 0.25rem;
                }

                .stat-label { font-size: 0.9rem; opacity: 0.9; }

                .hero-cta {
                    display: flex;
                    gap: 1rem;
                    justify-content: center;
                }

                /* Section Headers */
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

                /* Benefits */
                .benefits-section {
                    padding: 5rem 0;
                    background: #f7fafc;
                }

                .benefits-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 2rem;
                }

                .benefit-card {
                    background: white;
                    padding: 2rem;
                    border-radius: 12px;
                    text-align: center;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                }

                .benefit-icon {
                    font-size: 2.5rem;
                    color: #667eea;
                    margin-bottom: 1rem;
                }

                .benefit-card h3 { color: #2d3748; margin-bottom: 0.5rem; }
                .benefit-card p  { color: #718096; line-height: 1.6; }

                /* Culture */
                .culture-section { padding: 5rem 0; }

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

                .culture-card h3 { color: #2d3748; margin-bottom: 0.5rem; }
                .culture-card p  { color: #718096; line-height: 1.6; }

                /* Jobs */
                .jobs-section {
                    padding: 5rem 0;
                    background: #f7fafc;
                }

                .job-filters { margin-bottom: 3rem; }

                .search-box { position: relative; margin-bottom: 1rem; }

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
                    box-sizing: border-box;
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

                .featured-jobs { margin-bottom: 3rem; }

                .featured-jobs h3,
                .all-jobs h3 {
                    color: #2d3748;
                    margin-bottom: 1.5rem;
                    font-size: 1.25rem;
                }

                .jobs-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
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

                .job-card.featured { border: 2px solid #667eea; }

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

                .job-header { margin-bottom: 1rem; }

                .job-header h3 { color: #2d3748; margin-bottom: 0.25rem; }

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
                    gap: 0.3rem;
                    color: #718096;
                    font-size: 0.875rem;
                }

                .job-salary {
                    background: #f0fff4;
                    padding: 0.5rem 1rem;
                    border-radius: 6px;
                    margin-bottom: 1rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: #38a169;
                    font-weight: 600;
                    font-size: 0.95rem;
                }

                .job-description {
                    color: #4a5568;
                    margin-bottom: 1rem;
                    line-height: 1.6;
                    font-size: 0.9rem;
                }

                .skills-preview {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                    margin-bottom: 1rem;
                }

                .skill-tag {
                    padding: 0.25rem 0.75rem;
                    background: #ebf4ff;
                    color: #4c6ef5;
                    border-radius: 30px;
                    font-size: 0.8rem;
                    font-weight: 500;
                }

                .job-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 0.5rem;
                }

                .posted-date {
                    display: flex;
                    align-items: center;
                    gap: 0.3rem;
                    color: #a0aec0;
                    font-size: 0.82rem;
                }

                /* Job List */
                .jobs-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .job-list-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.25rem 1.5rem;
                    background: white;
                    border-radius: 10px;
                    transition: all 0.25s;
                    border: 1px solid #e2e8f0;
                    gap: 1rem;
                }

                .job-list-item:hover {
                    border-color: #667eea;
                    box-shadow: 0 4px 12px rgba(102,126,234,0.12);
                    transform: translateX(4px);
                }

                .job-item-content { flex: 1; min-width: 0; }

                .job-item-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 0.4rem;
                    flex-wrap: wrap;
                }

                .job-item-header h4 {
                    color: #2d3748;
                    font-size: 1rem;
                    font-weight: 600;
                    margin: 0;
                }

                .job-item-department {
                    color: #667eea;
                    font-size: 0.82rem;
                    font-weight: 500;
                    background: #ebf4ff;
                    padding: 0.15rem 0.6rem;
                    border-radius: 20px;
                }

                .job-item-meta {
                    display: flex;
                    gap: 1rem;
                    color: #718096;
                    font-size: 0.85rem;
                    flex-wrap: wrap;
                    align-items: center;
                }

                .job-item-meta span {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }

                .job-item-salary {
                    color: #38a169 !important;
                    font-weight: 600;
                }

                .job-item-posted { color: #a0aec0 !important; }

                .job-item-skills {
                    display: flex;
                    gap: 0.4rem;
                    margin-top: 0.5rem;
                    flex-wrap: wrap;
                }

                .skill-tag-small {
                    padding: 0.15rem 0.55rem;
                    background: #f7fafc;
                    color: #4a5568;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    border: 1px solid #e2e8f0;
                }

                /* Buttons */
                .btn {
                    padding: 0.7rem 1.4rem;
                    border-radius: 8px;
                    font-weight: 600;
                    text-decoration: none;
                    transition: all 0.25s;
                    display: inline-block;
                    cursor: pointer;
                    border: none;
                    font-size: 0.9rem;
                    white-space: nowrap;
                }

                .btn-primary {
                    background: #667eea;
                    color: white;
                }

                .btn-primary:hover {
                    background: #5a6fd6;
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(102,126,234,0.35);
                }

                .btn-apply {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    padding: 0.65rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 600;
                    text-decoration: none;
                    transition: all 0.25s;
                    display: inline-block;
                    white-space: nowrap;
                    font-size: 0.875rem;
                }

                .btn-apply:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(102,126,234,0.4);
                }

                .btn-secondary {
                    background: rgba(255,255,255,0.15);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.4);
                }

                .btn-secondary:hover { background: rgba(255,255,255,0.25); }

                .btn-reset {
                    margin-top: 1rem;
                    background: #667eea;
                    color: white;
                    padding: 0.65rem 1.5rem;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    border: none;
                    transition: all 0.2s;
                }

                .btn-reset:hover { background: #5a6fd6; }

                .btn-large { padding: 1rem 2rem; font-size: 1.05rem; }

                /* No Jobs */
                .no-jobs {
                    text-align: center;
                    padding: 4rem 2rem;
                    background: white;
                    border-radius: 12px;
                    border: 2px dashed #e2e8f0;
                }

                .no-jobs svg { color: #cbd5e0; margin-bottom: 1.25rem; }
                .no-jobs h3 { color: #2d3748; margin-bottom: 0.5rem; }
                .no-jobs p  { color: #718096; }

                /* CTA */
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

                .cta-content h2 { font-size: 2.5rem; margin-bottom: 1rem; }

                .cta-content p {
                    font-size: 1.2rem;
                    margin-bottom: 2rem;
                    opacity: 0.95;
                }

                .cta-buttons {
                    display: flex;
                    gap: 1rem;
                    justify-content: center;
                    flex-wrap: wrap;
                }

                /* Hero buttons override for white bg */
                .careers-hero .btn-primary {
                    background: white;
                    color: #667eea;
                }

                .careers-cta .btn-primary {
                    background: white;
                    color: #667eea;
                }

                /* Animation */
                @keyframes float {
                    0%, 100% { transform: translateY(0); }
                    50%       { transform: translateY(-20px); }
                }

                /* Responsive */
                @media (max-width: 768px) {
                    .hero-content h1 { font-size: 2rem; }
                    .hero-stats { flex-wrap: wrap; gap: 1.5rem; }
                    .hero-cta { flex-direction: column; align-items: center; }
                    .filter-group { flex-direction: column; }
                    .job-list-item { flex-direction: column; align-items: flex-start; }
                    .cta-buttons { flex-direction: column; align-items: center; }
                    .section-header h2 { font-size: 1.8rem; }
                }
            `}</style>
        </div>
    );
};

export default Careers;