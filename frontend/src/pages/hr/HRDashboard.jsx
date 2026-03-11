
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import Loading from '../../components/common/Loading';
import {
    FaBriefcase,
    FaUsers,
    FaFileAlt,
    FaCalendarAlt,
    FaBuilding,
    FaUserTie,
    FaChartLine,
    FaClock,
    FaCheckCircle,
    FaTimesCircle,
    FaEye,
    FaEdit,
    FaPlus,
    FaDownload,
    FaFilter,
    FaSearch,
    FaArrowUp,
    FaArrowDown,
    FaUserPlus,
    FaUserCheck,
    FaUserClock,
    FaUserTimes
} from 'react-icons/fa';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';

const HRDashboard = () => {
    const [stats, setStats] = useState(null);
    const [recentJobs, setRecentJobs] = useState([]);
    const [recentApplications, setRecentApplications] = useState([]);
    const [upcomingInterviews, setUpcomingInterviews] = useState([]);
    const [hiringTrend, setHiringTrend] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState('week');
    const [selectedDepartment, setSelectedDepartment] = useState('all');

    useEffect(() => {
        fetchDashboardData();
    }, [dateRange, selectedDepartment]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const [statsRes, jobsRes, interviewsRes, hiringRes] = await Promise.all([
                api.get('/hr/dashboard/stats', { params: { dateRange, department: selectedDepartment } }),
                api.get('/hr/jobs', { params: { department: selectedDepartment } }),
                api.get('/hr/interviews/upcoming', { params: { dateRange, department: selectedDepartment } }),
                api.get('/hr/analytics/hiring', { params: { dateRange, department: selectedDepartment } })
            ]);

            const dashboard = statsRes.data || {};
            setStats({
                jobs: {
                    total: Number(dashboard.jobs?.total_jobs || 0),
                    open: Number(dashboard.jobs?.open_jobs || 0),
                    closed: Number(dashboard.jobs?.closed_jobs || 0),
                    draft: Number(dashboard.jobs?.draft_jobs || 0)
                },
                applications: {
                    total: Number(dashboard.applications?.total_applications || 0),
                    pending: Number(dashboard.applications?.pending_applications || 0),
                    reviewed: Number(dashboard.applications?.reviewed_applications || 0),
                    shortlisted: Number(dashboard.applications?.shortlisted_applications || 0),
                    interviewed: Number(dashboard.applications?.interviewed_applications || 0),
                    hired: Number(dashboard.applications?.hired_applications || 0),
                    rejected: Number(dashboard.applications?.rejected_applications || 0)
                },
                interviews: {
                    total: Number(dashboard.interviews?.total_interviews || 0),
                    scheduled: Number(dashboard.interviews?.scheduled_interviews || 0),
                    completed: Number(dashboard.interviews?.completed_interviews || 0),
                    cancelled: Number(dashboard.interviews?.cancelled_interviews || 0),
                    today: (interviewsRes.data || []).filter((i) => {
                        const dt = new Date(i.scheduled_at);
                        const now = new Date();
                        return dt.toDateString() === now.toDateString();
                    }).length
                },
                employees: {
                    total: Number(dashboard.employees?.total_employees || 0),
                    active: Number(dashboard.employees?.active_employees || 0),
                    newThisMonth: 0
                },
                timeToHire: 0,
                acceptanceRate: Number(dashboard.applications?.total_applications || 0)
                    ? Math.round((Number(dashboard.applications?.hired_applications || 0) / Number(dashboard.applications?.total_applications || 1)) * 100)
                    : 0
            });

            const jobs = jobsRes.data || [];
            const recentJobsRows = jobs.slice(0, 5).map((job) => ({
                id: job.id,
                title: job.title,
                department: job.department_name || '-',
                applications: Number(job.applications_count || 0),
                status: job.status,
                daysLeft: job.application_deadline
                    ? Math.max(0, Math.ceil((new Date(job.application_deadline) - new Date()) / (1000 * 60 * 60 * 24)))
                    : 0
            }));
            setRecentJobs(recentJobsRows);

            const applicationsRes = await api.get('/hr/applications', { params: { limit: 5 } });
            const applications = Array.isArray(applicationsRes.data)
                ? applicationsRes.data
                : (Array.isArray(applicationsRes.data?.applications) ? applicationsRes.data.applications : []);

            setRecentApplications(applications.map((app) => ({
                id: app.id,
                name: `${app.first_name || ''} ${app.last_name || ''}`.trim() || app.email,
                position: app.job_title || '-',
                status: app.status || 'pending',
                date: app.created_at ? new Date(app.created_at).toLocaleDateString() : '-',
                experience: app.experience_years
                    ? `${app.experience_years} years`
                    : (app.years_experience ? `${app.years_experience} years` : 'N/A')
            })));

            setUpcomingInterviews((interviewsRes.data || []).slice(0, 4).map((interview) => ({
                id: interview.id,
                candidate: `${interview.first_name || ''} ${interview.last_name || ''}`.trim() || interview.email,
                position: interview.job_title || '-',
                time: interview.scheduled_at ? new Date(interview.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
                type: interview.interview_type,
                interviewer: interview.interviewer_name || '-'
            })));

            setHiringTrend((hiringRes.data || []).slice().reverse().map((row) => ({
                week: new Date(row.month).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
                applications: Number(row.applications || 0),
                hires: Number(row.hires || 0)
            })));
        } catch (error) {
            console.error('Failed to fetch dashboard data', error);
            setStats(null);
            setRecentJobs([]);
            setRecentApplications([]);
            setUpcomingInterviews([]);
            setHiringTrend([]);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            pending: { bg: '#fff7e6', color: '#ed8936', icon: <FaClock /> },
            reviewed: { bg: '#e6f7ff', color: '#3182ce', icon: <FaEye /> },
            shortlisted: { bg: '#e6f7e6', color: '#38a169', icon: <FaUserCheck /> },
            interviewed: { bg: '#e6e6ff', color: '#667eea', icon: <FaUserClock /> },
            hired: { bg: '#e6ffe6', color: '#48bb78', icon: <FaCheckCircle /> },
            rejected: { bg: '#ffe6e6', color: '#f56565', icon: <FaTimesCircle /> },
            open: { bg: '#e6f7e6', color: '#38a169', icon: <FaCheckCircle /> },
            closed: { bg: '#ffe6e6', color: '#f56565', icon: <FaTimesCircle /> },
            draft: { bg: '#e6e6e6', color: '#718096', icon: <FaEdit /> }
        };
        return badges[status] || badges.pending;
    };

    const statCards = [
        {
            title: 'Open Positions',
            value: stats?.jobs?.open || 0,
            change: '+3',
            icon: <FaBriefcase />,
            color: '#4299e1',
            link: '/hr/jobs'
        },
        {
            title: 'Total Applications',
            value: stats?.applications?.total || 0,
            change: '+23 today',
            icon: <FaFileAlt />,
            color: '#48bb78',
            link: '/hr/applications'
        },
        {
            title: 'Upcoming Interviews',
            value: stats?.interviews?.scheduled || 0,
            change: `${stats?.interviews?.today || 0} today`,
            icon: <FaCalendarAlt />,
            color: '#ed8936',
            link: '/hr/interviews'
        },
        {
            title: 'Active Employees',
            value: stats?.employees?.active || 0,
            change: `+${stats?.employees?.newThisMonth || 0} this month`,
            icon: <FaUsers />,
            color: '#9f7aea',
            link: '/hr/employees'
        },
        {
            title: 'Time to Hire',
            value: `${stats?.timeToHire || 0} days`,
            change: '-2 days',
            icon: <FaClock />,
            color: '#f687b3',
            link: '/hr/analytics'
        },
        {
            title: 'Acceptance Rate',
            value: `${stats?.acceptanceRate || 0}%`,
            change: '+5%',
            icon: <FaChartLine />,
            color: '#fc8181',
            link: '/hr/analytics'
        }
    ];

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="spinner"></div>
                <p>Loading HR dashboard...</p>
            </div>
        );
    }

    return (
        <div className="hr-dashboard">
            {}
            <div className="dashboard-header">
                <div className="header-left">
                    <h1>
                        <FaUsers className="header-icon" />
                        HR Dashboard
                    </h1>
                    <p className="header-description">
                        Welcome back! Here's what's happening in your organization today.
                    </p>
                </div>
                <div className="header-actions">
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="date-range-select"
                    >
                        <option value="today">Today</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                        <option value="quarter">This Quarter</option>
                        <option value="year">This Year</option>
                    </select>
                    <Link to="/hr/jobs/new" className="btn btn-primary">
                        <FaPlus /> Post New Job
                    </Link>
                </div>
            </div>

            {}
            <div className="stats-grid">
                {statCards.map((stat, index) => (
                    <Link to={stat.link} key={index} className="stat-card">
                        <div className="stat-icon" style={{ backgroundColor: `${stat.color}20`, color: stat.color }}>
                            {stat.icon}
                        </div>
                        <div className="stat-content">
                            <h3>{stat.title}</h3>
                            <div className="stat-value">{stat.value}</div>
                            <div className="stat-change" style={{ color: stat.color }}>
                                {stat.change}
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            {}
            <div className="quick-actions">
                <h2>Quick Actions</h2>
                <div className="action-grid">
                    <Link to="/hr/jobs/new" className="action-card">
                        <FaBriefcase className="action-icon" />
                        <h3>Post New Job</h3>
                        <p>Create a new job posting</p>
                    </Link>
                    <Link to="/hr/applications" className="action-card">
                        <FaFileAlt className="action-icon" />
                        <h3>Review Applications</h3>
                        <p>{stats?.applications?.pending || 0} pending reviews</p>
                    </Link>
                    <Link to="/hr/interviews" className="action-card">
                        <FaCalendarAlt className="action-icon" />
                        <h3>Schedule Interview</h3>
                        <p>{stats?.interviews?.scheduled || 0} upcoming</p>
                    </Link>
                    <Link to="/hr/employees/new" className="action-card">
                        <FaUserPlus className="action-icon" />
                        <h3>Add Employee</h3>
                        <p>Onboard new team member</p>
                    </Link>
                </div>
            </div>

            {}
            <div className="charts-section">
                <div className="chart-card">
                    <h3>Application Trends</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={hiringTrend}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="week" />
                            <YAxis />
                            <Tooltip />
                            <Area type="monotone" dataKey="applications" stackId="1" stroke="#4299e1" fill="#4299e180" />
                            <Area type="monotone" dataKey="hires" stackId="1" stroke="#48bb78" fill="#48bb7880" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-card">
                    <h3>Hiring Pipeline</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={[
                                    { name: 'Applied', value: stats?.applications?.total || 0 },
                                    { name: 'Reviewed', value: stats?.applications?.reviewed || 0 },
                                    { name: 'Shortlisted', value: stats?.applications?.shortlisted || 0 },
                                    { name: 'Interviewed', value: stats?.applications?.interviewed || 0 },
                                    { name: 'Hired', value: stats?.applications?.hired || 0 }
                                ]}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                fill="#8884d8"
                                paddingAngle={5}
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            >
                                <Cell fill="#4299e1" />
                                <Cell fill="#48bb78" />
                                <Cell fill="#ed8936" />
                                <Cell fill="#9f7aea" />
                                <Cell fill="#f687b3" />
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {}
            <div className="tables-section">
                {}
                <div className="table-card">
                    <div className="table-header">
                        <h3>
                            <FaBriefcase /> Recent Job Postings
                        </h3>
                        <Link to="/hr/jobs" className="view-all">View All Jobs</Link>
                    </div>
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                            <tr>
                                <th>Job Title</th>
                                <th>Department</th>
                                <th>Applications</th>
                                <th>Status</th>
                                <th>Days Left</th>
                                <th>Actions</th>
                            </tr>
                            </thead>
                            <tbody>
                            {recentJobs.map(job => {
                                const badge = getStatusBadge(job.status);
                                return (
                                    <tr key={job.id}>
                                        <td>
                                            <Link to={`/hr/jobs/${job.id}`} className="job-title-link">
                                                {job.title}
                                            </Link>
                                        </td>
                                        <td>{job.department}</td>
                                        <td>{job.applications}</td>
                                        <td>
                                                <span className="status-badge" style={{ backgroundColor: badge.bg, color: badge.color }}>
                                                    {badge.icon} {job.status}
                                                </span>
                                        </td>
                                        <td>{job.daysLeft > 0 ? `${job.daysLeft} days` : 'Expired'}</td>
                                        <td>
                                            <div className="action-buttons">
                                                <Link to={`/hr/jobs/${job.id}`} className="btn-icon" title="View">
                                                    <FaEye />
                                                </Link>
                                                <Link to={`/hr/jobs/${job.id}/edit`} className="btn-icon" title="Edit">
                                                    <FaEdit />
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {}
                <div className="table-card">
                    <div className="table-header">
                        <h3>
                            <FaFileAlt /> Recent Applications
                        </h3>
                        <Link to="/hr/applications" className="view-all">View All Applications</Link>
                    </div>
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                            <tr>
                                <th>Name</th>
                                <th>Position</th>
                                <th>Experience</th>
                                <th>Status</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                            </thead>
                            <tbody>
                            {recentApplications.map(app => {
                                const badge = getStatusBadge(app.status);
                                return (
                                    <tr key={app.id}>
                                        <td>
                                            <Link to={`/hr/applications/${app.id}`} className="applicant-link">
                                                {app.name}
                                            </Link>
                                        </td>
                                        <td>{app.position}</td>
                                        <td>{app.experience}</td>
                                        <td>
                                                <span className="status-badge" style={{ backgroundColor: badge.bg, color: badge.color }}>
                                                    {badge.icon} {app.status}
                                                </span>
                                        </td>
                                        <td>{app.date}</td>
                                        <td>
                                            <div className="action-buttons">
                                                <Link to={`/hr/applications/${app.id}`} className="btn-icon" title="View">
                                                    <FaEye />
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {}
            <div className="interviews-section">
                <div className="section-header">
                    <h2>
                        <FaCalendarAlt /> Upcoming Interviews
                    </h2>
                    <Link to="/hr/interviews" className="view-all">View Schedule</Link>
                </div>
                <div className="interviews-grid">
                    {upcomingInterviews.map(interview => (
                        <div key={interview.id} className="interview-card">
                            <div className="interview-time">{interview.time}</div>
                            <div className="interview-details">
                                <h4>{interview.candidate}</h4>
                                <p className="interview-position">{interview.position}</p>
                                <div className="interview-meta">
                                    <span className="interview-type">{interview.type}</span>
                                    <span className="interviewer">
                                                        <FaUserTie /> {interview.interviewer}
                                                    </span>
                                </div>
                            </div>
                            <Link to={`/hr/interviews/${interview.id}`} className="btn-icon">
                                <FaEye />
                            </Link>
                        </div>
                    ))}
                </div>
            </div>

            <style>{`
                .hr-dashboard {
                    padding: 2rem;
                    max-width: 1600px;
                    margin: 0 auto;
                }

                .dashboard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }

                .header-left h1 {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    color: #2d3748;
                    font-size: 2rem;
                    margin-bottom: 0.5rem;
                }

                .header-icon {
                    color: #4299e1;
                }

                .header-description {
                    color: #718096;
                }

                .header-actions {
                    display: flex;
                    gap: 1rem;
                }

                .date-range-select {
                    padding: 0.5rem 1rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    background: white;
                    color: #4a5568;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .stat-card {
                    background: white;
                    border-radius: 12px;
                    padding: 1.5rem;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    text-decoration: none;
                    transition: all 0.3s;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }

                .stat-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                }

                .stat-icon {
                    width: 60px;
                    height: 60px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.8rem;
                }

                .stat-content {
                    flex: 1;
                }

                .stat-content h3 {
                    color: #718096;
                    font-size: 0.9rem;
                    margin-bottom: 0.5rem;
                }

                .stat-value {
                    color: #2d3748;
                    font-size: 1.8rem;
                    font-weight: 700;
                    margin-bottom: 0.25rem;
                }

                .stat-change {
                    font-size: 0.85rem;
                }

                .quick-actions {
                    margin-bottom: 2rem;
                }

                .quick-actions h2 {
                    color: #2d3748;
                    margin-bottom: 1rem;
                }

                .action-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1rem;
                }

                .action-card {
                    background: white;
                    border-radius: 12px;
                    padding: 1.5rem;
                    text-decoration: none;
                    transition: all 0.3s;
                    border: 1px solid #e2e8f0;
                }

                .action-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                    border-color: #4299e1;
                }

                .action-icon {
                    font-size: 2rem;
                    color: #4299e1;
                    margin-bottom: 1rem;
                }

                .action-card h3 {
                    color: #2d3748;
                    margin-bottom: 0.5rem;
                }

                .action-card p {
                    color: #718096;
                    font-size: 0.9rem;
                }

                .charts-section {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .chart-card {
                    background: white;
                    border-radius: 12px;
                    padding: 1.5rem;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }

                .chart-card h3 {
                    color: #2d3748;
                    margin-bottom: 1rem;
                }

                .tables-section {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(600px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .table-card {
                    background: white;
                    border-radius: 12px;
                    padding: 1.5rem;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }

                .table-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .table-header h3 {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: #2d3748;
                }

                .view-all {
                    color: #4299e1;
                    text-decoration: none;
                }

                .table-responsive {
                    overflow-x: auto;
                }

                .data-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .data-table th {
                    text-align: left;
                    padding: 1rem 0.5rem;
                    color: #718096;
                    font-weight: 600;
                    font-size: 0.85rem;
                    border-bottom: 2px solid #e2e8f0;
                }

                .data-table td {
                    padding: 1rem 0.5rem;
                    border-bottom: 1px solid #e2e8f0;
                    color: #2d3748;
                }

                .job-title-link, .applicant-link {
                    color: #4299e1;
                    text-decoration: none;
                    font-weight: 500;
                }

                .job-title-link:hover, .applicant-link:hover {
                    text-decoration: underline;
                }

                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.25rem 0.75rem;
                    border-radius: 30px;
                    font-size: 0.85rem;
                    font-weight: 500;
                }

                .action-buttons {
                    display: flex;
                    gap: 0.5rem;
                }

                .btn-icon {
                    width: 32px;
                    height: 32px;
                    border-radius: 6px;
                    border: none;
                    background: #f7fafc;
                    color: #718096;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s;
                }

                .btn-icon:hover {
                    background: #4299e1;
                    color: white;
                }

                .interviews-section {
                    background: white;
                    border-radius: 12px;
                    padding: 1.5rem;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }

                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                }

                .section-header h2 {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: #2d3748;
                }

                .interviews-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1rem;
                }

                .interview-card {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem;
                    background: #f7fafc;
                    border-radius: 8px;
                    transition: all 0.3s;
                }

                .interview-card:hover {
                    background: #edf2f7;
                }

                .interview-time {
                    font-weight: 600;
                    color: #4299e1;
                    min-width: 80px;
                }

                .interview-details {
                    flex: 1;
                }

                .interview-details h4 {
                    color: #2d3748;
                    margin-bottom: 0.25rem;
                }

                .interview-position {
                    color: #718096;
                    font-size: 0.9rem;
                    margin-bottom: 0.25rem;
                }

                .interview-meta {
                    display: flex;
                    gap: 1rem;
                    font-size: 0.85rem;
                    color: #a0aec0;
                }

                .interview-type {
                    padding: 0.15rem 0.5rem;
                    background: #e6f7ff;
                    color: #3182ce;
                    border-radius: 30px;
                }

                .interviewer {
                    display: flex;
                    align-items: center;
                    gap: 0.25rem;
                }

                @media (max-width: 1024px) {
                    .charts-section,
                    .tables-section {
                        grid-template-columns: 1fr;
                    }
                }

                @media (max-width: 768px) {
                    .dashboard-header {
                        flex-direction: column;
                        gap: 1rem;
                    }

                    .header-actions {
                        width: 100%;
                    }

                    .date-range-select {
                        flex: 1;
                    }

                    .stats-grid {
                        grid-template-columns: 1fr;
                    }

                    .action-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
};

export default HRDashboard;