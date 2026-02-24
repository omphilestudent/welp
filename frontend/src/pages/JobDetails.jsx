// frontend/src/pages/JobDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    FaBriefcase,
    FaMapMarkerAlt,
    FaClock,
    FaDollarSign,
    FaBuilding,
    FaCalendarAlt,
    FaArrowLeft,
    FaShare,
    FaBookmark,
    FaCheckCircle,
    FaRegBookmark,
    FaUsers,
    FaChartLine,
    FaHeart
} from 'react-icons/fa';
import api from '../services/api';
import Loading from '../components/common/Loading';
import toast from 'react-hot-toast';

const JobDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saved, setSaved] = useState(false);
    const [similarJobs, setSimilarJobs] = useState([]);

    useEffect(() => {
        fetchJobDetails();
        window.scrollTo(0, 0);
    }, [id]);

    const fetchJobDetails = async () => {
        setLoading(true);
        try {
            // Mock data - replace with API call
            const mockJob = {
                id: 1,
                title: 'Senior Frontend Developer',
                department: 'Engineering',
                location: 'Remote',
                type: 'Full-time',
                experience: '5+ years',
                salary: '$120k - $150k',
                description: 'We are looking for an experienced Frontend Developer to join our team and help build the future of work. You will work on challenging problems and create solutions that impact millions of users.',
                responsibilities: [
                    'Build responsive and performant web applications using React and Next.js',
                    'Collaborate with designers and backend engineers to implement new features',
                    'Mentor junior developers and conduct code reviews',
                    'Participate in architectural decisions and technical planning',
                    'Optimize applications for maximum speed and scalability',
                    'Stay up-to-date with emerging trends and technologies'
                ],
                requirements: [
                    '5+ years of experience with React and modern JavaScript',
                    'Strong TypeScript skills and type safety practices',
                    'Experience with Next.js and server-side rendering',
                    'Understanding of web performance optimization techniques',
                    'Experience with state management (Redux, MobX, or Context API)',
                    'Knowledge of modern CSS (Tailwind, CSS-in-JS)',
                    'Excellent communication and collaboration skills'
                ],
                benefits: [
                    'Competitive salary and equity package',
                    'Comprehensive health, dental, and vision insurance',
                    'Unlimited PTO and flexible working hours',
                    'Home office stipend and learning budget',
                    'Regular team events and retreats',
                    '401k matching program'
                ],
                postedDate: '2024-01-15',
                deadline: '2024-02-15',
                applications: 23,
                company: {
                    name: 'Welp',
                    logo: null,
                    size: '150+ employees',
                    industry: 'Technology',
                    founded: '2020',
                    rating: 4.8
                }
            };
            setJob(mockJob);

            // Similar jobs
            setSimilarJobs([
                {
                    id: 2,
                    title: 'Frontend Developer',
                    location: 'Remote',
                    type: 'Full-time',
                    salary: '$90k - $120k'
                },
                {
                    id: 3,
                    title: 'Full Stack Developer',
                    location: 'San Francisco',
                    type: 'Full-time',
                    salary: '$130k - $160k'
                },
                {
                    id: 4,
                    title: 'UI Engineer',
                    location: 'Remote',
                    type: 'Full-time',
                    salary: '$100k - $130k'
                }
            ]);
        } catch (error) {
            console.error('Failed to fetch job details:', error);
            toast.error('Failed to load job details');
        } finally {
            setLoading(false);
        }
    };

    const handleApply = () => {
        navigate(`/careers/apply/${id}`);
    };

    const handleSave = () => {
        setSaved(!saved);
        toast.success(saved ? 'Job removed from saved' : 'Job saved to bookmarks');
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard');
    };

    if (loading) return <Loading />;

    if (!job) {
        return (
            <div className="not-found">
                <h1>Job Not Found</h1>
                <p>The job posting you're looking for doesn't exist.</p>
                <Link to="/careers" className="btn btn-primary">Back to Careers</Link>
            </div>
        );
    }

    return (
        <div className="job-details-page">
            <div className="container">
                {/* Back Button */}
                <button onClick={() => navigate(-1)} className="back-btn">
                    <FaArrowLeft /> Back to Jobs
                </button>

                <div className="job-details-grid">
                    {/* Main Content */}
                    <motion.div
                        className="job-main"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        {/* Job Header */}
                        <div className="job-header">
                            <div className="job-title-section">
                                <h1>{job.title}</h1>
                                <div className="job-actions">
                                    <button onClick={handleSave} className="action-btn">
                                        {saved ? <FaBookmark /> : <FaRegBookmark />}
                                    </button>
                                    <button onClick={handleShare} className="action-btn">
                                        <FaShare />
                                    </button>
                                </div>
                            </div>

                            <div className="job-meta">
                                <span><FaBuilding /> {job.department}</span>
                                <span><FaMapMarkerAlt /> {job.location}</span>
                                <span><FaBriefcase /> {job.type}</span>
                                <span><FaClock /> {job.experience}</span>
                                <span><FaDollarSign /> {job.salary}</span>
                                <span><FaCalendarAlt /> Posted {new Date(job.postedDate).toLocaleDateString()}</span>
                            </div>
                        </div>

                        {/* Company Info */}
                        <div className="company-card">
                            <div className="company-logo">
                                {job.company.logo ? (
                                    <img src={job.company.logo} alt={job.company.name} />
                                ) : (
                                    <div className="logo-placeholder">{job.company.name.charAt(0)}</div>
                                )}
                            </div>
                            <div className="company-info">
                                <h3>{job.company.name}</h3>
                                <div className="company-details">
                                    <span><FaUsers /> {job.company.size}</span>
                                    <span><FaChartLine /> {job.company.industry}</span>
                                    <span><FaHeart /> {job.company.rating} rating</span>
                                </div>
                            </div>
                        </div>

                        {/* Job Description */}
                        <div className="job-section">
                            <h2>About the Role</h2>
                            <p className="job-description">{job.description}</p>
                        </div>

                        {/* Responsibilities */}
                        <div className="job-section">
                            <h2>Responsibilities</h2>
                            <ul className="job-list">
                                {job.responsibilities.map((item, index) => (
                                    <li key={index}>
                                        <FaCheckCircle className="list-icon" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Requirements */}
                        <div className="job-section">
                            <h2>Requirements</h2>
                            <ul className="job-list">
                                {job.requirements.map((item, index) => (
                                    <li key={index}>
                                        <FaCheckCircle className="list-icon" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Benefits */}
                        <div className="job-section">
                            <h2>Benefits</h2>
                            <div className="benefits-grid">
                                {job.benefits.map((benefit, index) => (
                                    <div key={index} className="benefit-item">
                                        <FaHeart className="benefit-icon" />
                                        {benefit}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* Sidebar */}
                    <motion.div
                        className="job-sidebar"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                    >
                        {/* Apply Card */}
                        <div className="sidebar-card apply-card">
                            <h3>Ready to Apply?</h3>
                            <p>Applications close in {Math.ceil((new Date(job.deadline) - new Date()) / (1000 * 60 * 60 * 24))} days</p>
                            <button onClick={handleApply} className="btn btn-primary btn-block">
                                Apply for this Position
                            </button>
                            <p className="application-count">{job.applications} people have already applied</p>
                        </div>

                        {/* Job Overview */}
                        <div className="sidebar-card">
                            <h3>Job Overview</h3>
                            <div className="overview-item">
                                <span>Posted Date:</span>
                                <strong>{new Date(job.postedDate).toLocaleDateString()}</strong>
                            </div>
                            <div className="overview-item">
                                <span>Application Deadline:</span>
                                <strong>{new Date(job.deadline).toLocaleDateString()}</strong>
                            </div>
                            <div className="overview-item">
                                <span>Experience Level:</span>
                                <strong>{job.experience}</strong>
                            </div>
                            <div className="overview-item">
                                <span>Job Type:</span>
                                <strong>{job.type}</strong>
                            </div>
                            <div className="overview-item">
                                <span>Salary Range:</span>
                                <strong>{job.salary}</strong>
                            </div>
                            <div className="overview-item">
                                <span>Department:</span>
                                <strong>{job.department}</strong>
                            </div>
                        </div>

                        {/* Similar Jobs */}
                        {similarJobs.length > 0 && (
                            <div className="sidebar-card">
                                <h3>Similar Jobs</h3>
                                <div className="similar-jobs">
                                    {similarJobs.map(job => (
                                        <Link key={job.id} to={`/careers/jobs/${job.id}`} className="similar-job-item">
                                            <h4>{job.title}</h4>
                                            <div className="similar-job-meta">
                                                <span><FaMapMarkerAlt /> {job.location}</span>
                                                <span><FaBriefcase /> {job.type}</span>
                                            </div>
                                            <span className="similar-job-salary">{job.salary}</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>

            <style jsx>{`
                .job-details-page {
                    padding: 2rem 0;
                    background: #f7fafc;
                    min-height: 100vh;
                }

                .back-btn {
                    background: none;
                    border: none;
                    color: #667eea;
                    font-size: 1rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 2rem;
                }

                .back-btn:hover {
                    text-decoration: underline;
                }

                .job-details-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 2rem;
                }

                /* Main Content */
                .job-main {
                    background: white;
                    border-radius: 16px;
                    padding: 2rem;
                }

                .job-header {
                    margin-bottom: 2rem;
                }

                .job-title-section {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .job-title-section h1 {
                    font-size: 2rem;
                    color: #2d3748;
                }

                .job-actions {
                    display: flex;
                    gap: 0.5rem;
                }

                .action-btn {
                    width: 40px;
                    height: 40px;
                    border: 1px solid #e2e8f0;
                    background: white;
                    border-radius: 8px;
                    color: #718096;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s;
                }

                .action-btn:hover {
                    background: #667eea;
                    color: white;
                    border-color: #667eea;
                }

                .job-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1.5rem;
                }

                .job-meta span {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: #718096;
                }

                .company-card {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    padding: 1.5rem;
                    background: #f7fafc;
                    border-radius: 12px;
                    margin-bottom: 2rem;
                }

                .company-logo {
                    width: 60px;
                    height: 60px;
                    border-radius: 12px;
                    overflow: hidden;
                }

                .logo-placeholder {
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    font-weight: bold;
                }

                .company-info h3 {
                    color: #2d3748;
                    margin-bottom: 0.5rem;
                }

                .company-details {
                    display: flex;
                    gap: 1.5rem;
                    color: #718096;
                    font-size: 0.9rem;
                }

                .company-details span {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }

                .job-section {
                    margin-bottom: 2rem;
                }

                .job-section h2 {
                    color: #2d3748;
                    margin-bottom: 1rem;
                }

                .job-description {
                    color: #4a5568;
                    line-height: 1.8;
                }

                .job-list {
                    list-style: none;
                    padding: 0;
                }

                .job-list li {
                    display: flex;
                    align-items: flex-start;
                    gap: 1rem;
                    margin-bottom: 1rem;
                    color: #4a5568;
                    line-height: 1.6;
                }

                .list-icon {
                    color: #48bb78;
                    margin-top: 0.2rem;
                    flex-shrink: 0;
                }

                .benefits-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1rem;
                }

                .benefit-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    background: #f7fafc;
                    border-radius: 8px;
                    color: #4a5568;
                }

                .benefit-icon {
                    color: #f687b3;
                }

                /* Sidebar */
                .job-sidebar {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .sidebar-card {
                    background: white;
                    border-radius: 12px;
                    padding: 1.5rem;
                }

                .apply-card {
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    color: white;
                }

                .apply-card h3 {
                    color: white;
                    margin-bottom: 0.5rem;
                }

                .apply-card p {
                    color: rgba(255,255,255,0.9);
                    margin-bottom: 1rem;
                }

                .application-count {
                    text-align: center;
                    margin-top: 1rem;
                    font-size: 0.9rem;
                }

                .btn-block {
                    width: 100%;
                }

                .overview-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 0.75rem 0;
                    border-bottom: 1px solid #e2e8f0;
                }

                .overview-item:last-child {
                    border-bottom: none;
                }

                .overview-item span {
                    color: #718096;
                }

                .overview-item strong {
                    color: #2d3748;
                }

                .similar-jobs {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .similar-job-item {
                    text-decoration: none;
                    padding: 1rem;
                    background: #f7fafc;
                    border-radius: 8px;
                    transition: all 0.3s;
                }

                .similar-job-item:hover {
                    background: #edf2f7;
                }

                .similar-job-item h4 {
                    color: #2d3748;
                    margin-bottom: 0.5rem;
                }

                .similar-job-meta {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 0.5rem;
                    color: #718096;
                    font-size: 0.9rem;
                }

                .similar-job-meta span {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }

                .similar-job-salary {
                    color: #48bb78;
                    font-weight: 500;
                }

                .not-found {
                    text-align: center;
                    padding: 4rem 2rem;
                }

                .not-found h1 {
                    color: #2d3748;
                    margin-bottom: 1rem;
                }

                .not-found p {
                    color: #718096;
                    margin-bottom: 2rem;
                }

                .btn-primary {
                    background: #667eea;
                    color: white;
                    padding: 0.75rem 1.5rem;
                    border-radius: 8px;
                    text-decoration: none;
                    display: inline-block;
                }

                .btn-primary:hover {
                    background: #5a67d8;
                }

                @media (max-width: 1024px) {
                    .job-details-grid {
                        grid-template-columns: 1fr;
                    }
                }

                @media (max-width: 768px) {
                    .job-title-section {
                        flex-direction: column;
                        gap: 1rem;
                        align-items: flex-start;
                    }

                    .job-meta {
                        flex-direction: column;
                        gap: 0.5rem;
                    }

                    .company-card {
                        flex-direction: column;
                        text-align: center;
                    }

                    .company-details {
                        flex-wrap: wrap;
                        justify-content: center;
                    }

                    .benefits-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
};

export default JobDetails;