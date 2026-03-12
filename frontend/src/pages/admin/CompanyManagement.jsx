
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';
import { buildLogoUrls } from '../../utils/companyLogos';
import {
    FaBuilding,
    FaSearch,
    FaFilter,
    FaEye,
    FaCheckCircle,
    FaTimesCircle,
    FaEdit,
    FaTrash,
    FaPlus,
    FaFileExport,
    FaEnvelope,
    FaPhone,
    FaGlobe,
    FaMapMarkerAlt,
    FaStar,
    FaUserTie,
    FaCalendarAlt,
    FaChartLine,
    FaShieldAlt,
    FaExclamationTriangle,
    FaChevronLeft,
    FaChevronRight,
    FaDownload,
    FaPrint,
    FaCopy,
    FaUsers
} from 'react-icons/fa';

const resolveMediaUrl = (url) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

const CompanyLogoThumb = ({ company }) => {
    const [idx, setIdx] = useState(0);
    const nameLower = (company?.name || '').toLowerCase().trim();
    const logoUrls = useMemo(() => buildLogoUrls(company, nameLower), [company, nameLower]);
    const current = idx < logoUrls.length ? logoUrls[idx] : null;
    const src = current ? resolveMediaUrl(current) : '';
    const handleError = useCallback(() => setIdx((i) => i + 1), []);

    if (src) {
        return (
            <img
                src={src}
                alt={company?.name || 'Company logo'}
                className="company-logo-small"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={handleError}
            />
        );
    }

    return (
        <div className="company-logo-placeholder-small">
            {(company?.name || 'C').charAt(0)}
        </div>
    );
};

const CompanyManagement = () => {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterIndustry, setFilterIndustry] = useState('all');
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [stats, setStats] = useState({
        total: 0,
        verified: 0,
        pending: 0,
        claimed: 0,
        unclaimed: 0
    });
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: '',
        industry: '',
        website: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        country: '',
        description: ''
    });
    const [createSaving, setCreateSaving] = useState(false);

    const toNumber = (value, fallback = 0) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    };

    const toLocale = (value, fallback = '0') => {
        const n = toNumber(value, NaN);
        return Number.isFinite(n) ? n.toLocaleString() : fallback;
    };

    const industries = [
        'Technology', 'Finance', 'Healthcare', 'Education', 'Retail',
        'Manufacturing', 'Construction', 'Transportation', 'Hospitality',
        'Media', 'Energy', 'Agriculture', 'Real Estate', 'Consulting'
    ];

    useEffect(() => {
        fetchCompanies();
    }, []);

    const fetchCompanies = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/admin/companies', {
                params: {
                    page: 1,
                    limit: 200,
                    search: searchTerm || undefined,
                    status: filterStatus !== 'all' ? filterStatus : undefined,
                    industry: filterIndustry !== 'all' ? filterIndustry : undefined
                }
            });

            const companyRows = data.companies || [];
            const normalizedCompanies = companyRows.map((company) => ({
                ...company,
                reviews_count: Number(company.review_count || 0),
                avg_rating: Number(company.avg_rating || 0),
                employee_count: Number(company.employee_count || 0),
                claimed_by: company.claimed_by_name || company.claimed_by
            }));

            setCompanies(normalizedCompanies);

            setStats({
                total: normalizedCompanies.length,
                verified: normalizedCompanies.filter((company) => company.is_verified).length,
                pending: normalizedCompanies.filter((company) => !company.is_verified).length,
                claimed: normalizedCompanies.filter((company) => company.is_claimed).length,
                unclaimed: normalizedCompanies.filter((company) => !company.is_claimed).length
            });
        } catch (error) {
            console.error('Failed to fetch companies:', error);
            toast.error('Failed to load companies');
            setCompanies([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const handleFilterStatus = (status) => {
        setFilterStatus(status);
        setCurrentPage(1);
    };

    const handleFilterIndustry = (industry) => {
        setFilterIndustry(industry);
        setCurrentPage(1);
    };

    const handleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('asc');
        }
    };

    const handleViewDetails = (company) => {
        setSelectedCompany(company);
        setShowDetails(true);
        setEditMode(false);
        setEditForm({
            name: company.name || '',
            description: company.description || '',
            industry: company.industry || '',
            website: company.website || '',
            email: company.email || '',
            phone: company.phone || '',
            address: company.address || '',
            city: company.city || '',
            country: company.country || '',
            registration_number: company.registration_number || '',
            logo_url: company.logo_url || ''
        });
    };

    const handleVerify = async (id) => {
        try {
            await api.patch(`/admin/companies/${id}/verify`);
            toast.success('Company verified successfully');
            fetchCompanies();
        } catch (error) {
            toast.error('Failed to verify company');
        }
    };

    const handleEditSave = async () => {
        if (!selectedCompany || !editForm) return;
        setSaving(true);
        try {
            const { data } = await api.put(`/companies/${selectedCompany.id}`, editForm);
            setSelectedCompany(data);
            setCompanies((prev) =>
                prev.map((c) => (c.id === data.id ? { ...c, ...data } : c))
            );
            toast.success('Company updated');
            setEditMode(false);
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to update company');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this company?')) return;

        try {
            await api.delete(`/admin/companies/${id}`);
            toast.success('Company deleted successfully');
            fetchCompanies();
        } catch (error) {
            toast.error('Failed to delete company');
        }
    };

    const handleUnclaim = async (id) => {
        if (!window.confirm('Unclaim this business? This will remove ownership and verification.')) return;
        try {
            const { data } = await api.patch(`/admin/companies/${id}/unclaim`);
            toast.success('Company unclaimed');
            if (selectedCompany?.id === id) {
                setSelectedCompany(data.company || null);
            }
            fetchCompanies();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to unclaim company');
        }
    };

    const handleExport = () => {

        const data = companies.map(c => ({
            Name: c.name,
            Industry: c.industry,
            Status: c.is_verified ? 'Verified' : 'Pending',
            Claimed: c.is_claimed ? 'Yes' : 'No',
            Reviews: c.reviews_count,
            Rating: c.avg_rating,
            Employees: c.employee_count,
            Founded: c.founded
        }));

        const csv = convertToCSV(data);
        downloadCSV(csv, 'companies_export.csv');
        toast.success('Companies exported successfully');
    };

    const handleCreateCompany = async () => {
        if (!createForm.name || !createForm.country) {
            toast.error('Company name and country are required');
            return;
        }
        setCreateSaving(true);
        try {
            const payload = {
                name: createForm.name.trim(),
                industry: createForm.industry.trim() || undefined,
                website: createForm.website.trim() || undefined,
                email: createForm.email.trim() || undefined,
                phone: createForm.phone.trim() || undefined,
                address: createForm.address.trim() || undefined,
                city: createForm.city.trim() || undefined,
                country: createForm.country.trim(),
                description: createForm.description.trim() || undefined
            };
            await api.post('/admin/companies', payload);
            toast.success('Company created');
            setShowCreateModal(false);
            setCreateForm({
                name: '',
                industry: '',
                website: '',
                email: '',
                phone: '',
                address: '',
                city: '',
                country: '',
                description: ''
            });
            fetchCompanies();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to create company');
        } finally {
            setCreateSaving(false);
        }
    };

    const convertToCSV = (data) => {
        if (!data.length) return '';
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(obj => Object.values(obj).join(','));
        return [headers, ...rows].join('\n');
    };

    const downloadCSV = (csv, filename) => {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
    };


    const filteredCompanies = companies
        .filter(company => {
            const matchesSearch = company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                company.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                company.email?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = filterStatus === 'all' ||
                (filterStatus === 'verified' && company.is_verified) ||
                (filterStatus === 'pending' && !company.is_verified) ||
                (filterStatus === 'claimed' && company.is_claimed) ||
                (filterStatus === 'unclaimed' && !company.is_claimed);

            const matchesIndustry = filterIndustry === 'all' || company.industry === filterIndustry;

            return matchesSearch && matchesStatus && matchesIndustry;
        })
        .sort((a, b) => {
            let aVal = a[sortBy];
            let bVal = b[sortBy];

            if (sortBy === 'avg_rating' || sortBy === 'reviews_count' || sortBy === 'employee_count') {
                aVal = Number(aVal);
                bVal = Number(bVal);
            }

            if (sortOrder === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });


    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredCompanies.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredCompanies.length / itemsPerPage);

    if (loading) return <Loading />;

    return (
        <div className="company-management">
            {}
            <div className="page-header">
                <div className="header-left">
                    <h1>
                        <FaBuilding className="header-icon" />
                        Company Management
                    </h1>
                    <p className="page-description">
                        Manage and verify companies on the platform
                    </p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        <FaPlus /> Add Company
                    </button>
                    <button className="btn btn-secondary" onClick={handleExport}>
                        <FaFileExport /> Export
                    </button>
                </div>
            </div>

            {}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: '#4299e120', color: '#4299e1' }}>
                        <FaBuilding />
                    </div>
                    <div className="stat-content">
                        <h3>Total Companies</h3>
                        <div className="stat-value">{stats.total}</div>
                        <div className="stat-change">+12 this month</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: '#48bb7820', color: '#48bb78' }}>
                        <FaCheckCircle />
                    </div>
                    <div className="stat-content">
                        <h3>Verified</h3>
                        <div className="stat-value">{stats.verified}</div>
                        <div className="stat-change">{Math.round(stats.verified / stats.total * 100)}% of total</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: '#ed893620', color: '#ed8936' }}>
                        <FaExclamationTriangle />
                    </div>
                    <div className="stat-content">
                        <h3>Pending Verification</h3>
                        <div className="stat-value">{stats.pending}</div>
                        <div className="stat-change">Awaiting review</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon" style={{ backgroundColor: '#9f7aea20', color: '#9f7aea' }}>
                        <FaShieldAlt />
                    </div>
                    <div className="stat-content">
                        <h3>Claimed</h3>
                        <div className="stat-value">{stats.claimed}</div>
                        <div className="stat-change">{stats.unclaimed} unclaimed</div>
                    </div>
                </div>
            </div>

            {}
            <div className="filters-section">
                <div className="search-box">
                    <FaSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search companies by name, email, or description..."
                        value={searchTerm}
                        onChange={handleSearch}
                    />
                </div>

                <div className="filter-group">
                    <div className="filter-label">
                        <FaFilter /> Status:
                    </div>
                    <select
                        value={filterStatus}
                        onChange={(e) => handleFilterStatus(e.target.value)}
                        className="filter-select"
                    >
                        <option value="all">All Companies</option>
                        <option value="verified">Verified</option>
                        <option value="pending">Pending</option>
                        <option value="claimed">Claimed</option>
                        <option value="unclaimed">Unclaimed</option>
                    </select>

                    <select
                        value={filterIndustry}
                        onChange={(e) => handleFilterIndustry(e.target.value)}
                        className="filter-select"
                    >
                        <option value="all">All Industries</option>
                        {industries.map(ind => (
                            <option key={ind} value={ind}>{ind}</option>
                        ))}
                    </select>
                </div>
            </div>

            {}
            <div className="table-container">
                <table className="data-table">
                    <thead>
                    <tr>
                        <th onClick={() => handleSort('name')}>
                            Company {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('industry')}>
                            Industry {sortBy === 'industry' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('is_verified')}>
                            Status
                        </th>
                        <th onClick={() => handleSort('is_claimed')}>
                            Claimed
                        </th>
                        <th onClick={() => handleSort('reviews_count')}>
                            Reviews {sortBy === 'reviews_count' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('avg_rating')}>
                            Rating {sortBy === 'avg_rating' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('employee_count')}>
                            Employees {sortBy === 'employee_count' && (sortOrder === 'asc' ? '↑' : '↓')}
                        </th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {currentItems.map(company => (
                        <tr key={company.id}>
                            <td>
                                <div className="company-cell">
                                    <CompanyLogoThumb company={company} />
                                    <div>
                                        <div className="company-name">{company.name}</div>
                                        <small className="company-email">{company.email}</small>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span className="industry-badge">{company.industry}</span>
                            </td>
                            <td>
                                {company.is_verified ? (
                                    <span className="status-badge verified">
                                            <FaCheckCircle /> Verified
                                        </span>
                                ) : (
                                    <span className="status-badge pending">
                                            <FaTimesCircle /> Pending
                                        </span>
                                )}
                            </td>
                            <td>
                                {company.is_claimed ? (
                                    <span className="claimed-badge claimed">
                                            <FaCheckCircle /> Yes
                                        </span>
                                ) : (
                                    <span className="claimed-badge unclaimed">
                                            <FaTimesCircle /> No
                                        </span>
                                )}
                            </td>
                            <td>{company.reviews_count.toLocaleString()}</td>
                            <td>
                                <div className="rating-cell">
                                        <span className="rating-stars">
                                            {'★'.repeat(Math.floor(company.avg_rating))}
                                            {'☆'.repeat(5 - Math.floor(company.avg_rating))}
                                        </span>
                                    <span className="rating-value">{company.avg_rating}</span>
                                </div>
                            </td>
                            <td>{company.employee_count.toLocaleString()}</td>
                            <td>
                                <div className="action-buttons">
                                    <button
                                        className="btn-icon"
                                        onClick={() => handleViewDetails(company)}
                                        title="View Details"
                                    >
                                        <FaEye />
                                    </button>
                                    <button
                                        className="btn-icon"
                                        onClick={() => {
                                            handleViewDetails(company);
                                            setEditMode(true);
                                        }}
                                        title="Edit"
                                    >
                                        <FaEdit />
                                    </button>
                                    {!company.is_verified && (
                                        <button
                                            className="btn-icon success"
                                            onClick={() => handleVerify(company.id)}
                                            title="Verify"
                                        >
                                            <FaCheckCircle />
                                        </button>
                                    )}
                                    <button
                                        className="btn-icon danger"
                                        onClick={() => handleDelete(company.id)}
                                        title="Delete"
                                    >
                                        <FaTrash />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>

                {filteredCompanies.length === 0 && (
                    <div className="empty-state">
                        <FaBuilding size={48} />
                        <h3>No companies found</h3>
                        <p>Try adjusting your search or filter criteria</p>
                    </div>
                )}
            </div>

            {}
            {filteredCompanies.length > 0 && (
                <div className="pagination">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="pagination-btn"
                    >
                        <FaChevronLeft />
                    </button>

                    <span className="page-info">
                        Page {currentPage} of {totalPages}
                    </span>

                    <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="pagination-btn"
                    >
                        <FaChevronRight />
                    </button>

                    <select
                        value={itemsPerPage}
                        onChange={(e) => setCurrentPage(1)}
                        className="rows-per-page"
                    >
                        <option value={10}>10 rows</option>
                        <option value={25}>25 rows</option>
                        <option value={50}>50 rows</option>
                        <option value={100}>100 rows</option>
                    </select>
                </div>
            )}

            {}
            {showDetails && selectedCompany && (
                <div className="modal-overlay" onClick={() => setShowDetails(false)}>
                    <div className="modal-content large" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Company Details</h2>
                            <button className="close-btn" onClick={() => setShowDetails(false)}>×</button>
                        </div>

                        <div className="company-details">
                            <div className="detail-header">
                                {selectedCompany.logo_url ? (
                                    <img src={resolveMediaUrl(selectedCompany.logo_url)} alt={selectedCompany.name} className="detail-logo" />
                                ) : (
                                    <div className="detail-logo-placeholder">
                                        {selectedCompany.name.charAt(0)}
                                    </div>
                                )}
                                <div className="detail-title">
                                    <h3>{selectedCompany.name}</h3>
                                    <p className="detail-industry">{selectedCompany.industry}</p>
                                </div>
                                <div className="detail-status">
                                    {selectedCompany.is_verified ? (
                                        <span className="status-badge verified">Verified</span>
                                    ) : (
                                        <span className="status-badge pending">Pending</span>
                                    )}
                                </div>
                            </div>

                            <div className="detail-grid">
                                <div className="detail-section">
                                    <h4>Company Information</h4>
                                    <div className="detail-item">
                                        <FaGlobe /> <strong>Website:</strong>
                                        <a href={selectedCompany.website} target="_blank" rel="noopener noreferrer">
                                            {selectedCompany.website}
                                        </a>
                                    </div>
                                    <div className="detail-item">
                                        <FaEnvelope /> <strong>Email:</strong> {selectedCompany.email}
                                    </div>
                                    <div className="detail-item">
                                        <FaPhone /> <strong>Phone:</strong> {selectedCompany.phone}
                                    </div>
                                    <div className="detail-item">
                                        <FaMapMarkerAlt /> <strong>Address:</strong> {selectedCompany.address}
                                    </div>
                                    <div className="detail-item">
                                        <FaMapMarkerAlt /> <strong>City:</strong> {selectedCompany.city || '-'}
                                    </div>
                                    <div className="detail-item">
                                        <FaMapMarkerAlt /> <strong>Country:</strong> {selectedCompany.country || '-'}
                                    </div>
                                    <div className="detail-item">
                                        <FaBuilding /> <strong>Registration:</strong> {selectedCompany.registration_number || '-'}
                                    </div>
                                    <div className="detail-item">
                                        <FaCalendarAlt /> <strong>Founded:</strong> {selectedCompany.founded}
                                    </div>
                                </div>

                                <div className="detail-section">
                                    <h4>Verification Status</h4>
                                    <div className="detail-item">
                                        <FaCheckCircle /> <strong>Verified:</strong>
                                        {selectedCompany.is_verified ? ' Yes' : ' No'}
                                    </div>
                                    {selectedCompany.is_verified && (
                                        <>
                                            <div className="detail-item">
                                                <FaCalendarAlt /> <strong>Verification Date:</strong> {selectedCompany.verification_date}
                                            </div>
                                            <div className="detail-item">
                                                <FaUserTie /> <strong>Verified By:</strong> {selectedCompany.claimed_by}
                                            </div>
                                        </>
                                    )}
                                    <div className="detail-item">
                                        <FaBuilding /> <strong>Claimed:</strong>
                                        {selectedCompany.is_claimed ? ' Yes' : ' No'}
                                    </div>
                                    {selectedCompany.is_claimed && (
                                        <div className="detail-item">
                                            <FaCalendarAlt /> <strong>Claimed Date:</strong> {selectedCompany.claimed_date}
                                        </div>
                                    )}
                                </div>

                                <div className="detail-section">
                                    <h4>Statistics</h4>
                                    <div className="detail-item">
                                        <FaStar /> <strong>Average Rating:</strong>
                                        <span className="rating-value">{selectedCompany.avg_rating}</span>
                                        <span className="rating-stars">
                                            {'★'.repeat(Math.floor(selectedCompany.avg_rating))}
                                            {'☆'.repeat(5 - Math.floor(selectedCompany.avg_rating))}
                                        </span>
                                    </div>
                                    <div className="detail-item">
                                        <FaBuilding /> <strong>Total Reviews:</strong> {toLocale(selectedCompany.reviews_count)}
                                    </div>
                                    <div className="detail-item">
                                        <FaUsers /> <strong>Employees:</strong> {toLocale(selectedCompany.employee_count)}
                                    </div>
                                    <div className="detail-item">
                                        <FaChartLine /> <strong>Monthly Revenue:</strong> ${toLocale(selectedCompany.monthly_revenue)}
                                    </div>
                                </div>

                                <div className="detail-section full-width">
                                    <h4>Description</h4>
                                    <p>{selectedCompany.description}</p>
                                </div>

                                {editMode && editForm && (
                                    <div className="detail-section full-width">
                                        <h4>Edit Company</h4>
                                        <div className="admin-edit-grid">
                                            <label>
                                                Name
                                                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                                            </label>
                                            <label>
                                                Industry
                                                <input type="text" value={editForm.industry} onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })} />
                                            </label>
                                            <label>
                                                Website
                                                <input type="text" value={editForm.website} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} />
                                            </label>
                                            <label>
                                                Email
                                                <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                                            </label>
                                            <label>
                                                Phone
                                                <input type="text" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                                            </label>
                                            <label>
                                                Address
                                                <input type="text" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                                            </label>
                                            <label>
                                                City
                                                <input type="text" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
                                            </label>
                                            <label>
                                                Country
                                                <input type="text" value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} />
                                            </label>
                                            <label>
                                                Registration Number
                                                <input type="text" value={editForm.registration_number} onChange={(e) => setEditForm({ ...editForm, registration_number: e.target.value })} />
                                            </label>
                                            <label>
                                                Logo URL
                                                <input type="text" value={editForm.logo_url} onChange={(e) => setEditForm({ ...editForm, logo_url: e.target.value })} />
                                            </label>
                                            <label className="admin-edit-grid__full">
                                                Description
                                                <textarea rows={4} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                                            </label>
                                        </div>
                                    </div>
                                )}

                                <div className="detail-section full-width">
                                    <h4>Timeline</h4>
                                    <div className="timeline">
                                        <div className="timeline-item">
                                            <div className="timeline-date">{selectedCompany.created_at}</div>
                                            <div className="timeline-content">
                                                <strong>Created</strong> - Company profile was created
                                            </div>
                                        </div>
                                        {selectedCompany.claimed_date && (
                                            <div className="timeline-item">
                                                <div className="timeline-date">{selectedCompany.claimed_date}</div>
                                                <div className="timeline-content">
                                                    <strong>Claimed</strong> - Company was claimed by {selectedCompany.claimed_by}
                                                </div>
                                            </div>
                                        )}
                                        {selectedCompany.verification_date && (
                                            <div className="timeline-item">
                                                <div className="timeline-date">{selectedCompany.verification_date}</div>
                                                <div className="timeline-content">
                                                    <strong>Verified</strong> - Company was verified
                                                </div>
                                            </div>
                                        )}
                                        <div className="timeline-item">
                                            <div className="timeline-date">{selectedCompany.updated_at}</div>
                                            <div className="timeline-content">
                                                <strong>Last Updated</strong> - Profile was updated
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setShowDetails(false)}>
                                    Close
                                </button>
                                {!editMode ? (
                                    <button className="btn btn-primary" onClick={() => setEditMode(true)}>
                                        <FaEdit /> Edit Company
                                    </button>
                                ) : (
                                    <button className="btn btn-primary" onClick={handleEditSave} disabled={saving}>
                                        <FaEdit /> {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                )}
                                {!selectedCompany.is_verified && (
                                    <button className="btn btn-success" onClick={() => handleVerify(selectedCompany.id)}>
                                        <FaCheckCircle /> Verify Company
                                    </button>
                                )}
                                {selectedCompany.is_claimed && (
                                    <button className="btn btn-warning" onClick={() => handleUnclaim(selectedCompany.id)}>
                                        <FaTimesCircle /> Unclaim Company
                                    </button>
                                )}
                                <button className="btn btn-danger" onClick={() => handleDelete(selectedCompany.id)}>
                                    <FaTrash /> Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content large" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Add Company</h2>
                            <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
                        </div>
                        <div className="company-details">
                            <div className="detail-section full-width">
                                <div className="admin-edit-grid">
                                    <label>
                                        Name *
                                        <input type="text" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} />
                                    </label>
                                    <label>
                                        Industry
                                        <input type="text" value={createForm.industry} onChange={(e) => setCreateForm({ ...createForm, industry: e.target.value })} />
                                    </label>
                                    <label>
                                        Website
                                        <input type="text" value={createForm.website} onChange={(e) => setCreateForm({ ...createForm, website: e.target.value })} />
                                    </label>
                                    <label>
                                        Email
                                        <input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
                                    </label>
                                    <label>
                                        Phone
                                        <input type="text" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} />
                                    </label>
                                    <label>
                                        Address
                                        <input type="text" value={createForm.address} onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })} />
                                    </label>
                                    <label>
                                        City
                                        <input type="text" value={createForm.city} onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })} />
                                    </label>
                                    <label>
                                        Country *
                                        <input type="text" value={createForm.country} onChange={(e) => setCreateForm({ ...createForm, country: e.target.value })} />
                                    </label>
                                    <label className="admin-edit-grid__full">
                                        Description
                                        <textarea rows={4} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
                                    </label>
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                                    Cancel
                                </button>
                                <button className="btn btn-primary" onClick={handleCreateCompany} disabled={createSaving}>
                                    {createSaving ? 'Saving...' : 'Create Company'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .company-management {
                    padding: 2rem;
                }

                .page-header {
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
                }

                .header-icon {
                    color: #4299e1;
                }

                .page-description {
                    color: #718096;
                    margin-top: 0.5rem;
                }

                .header-actions {
                    display: flex;
                    gap: 1rem;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
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
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
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
                    color: #48bb78;
                    font-size: 0.85rem;
                }

                .filters-section {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 2rem;
                    flex-wrap: wrap;
                }

                .search-box {
                    flex: 1;
                    position: relative;
                    min-width: 300px;
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
                    font-size: 0.95rem;
                }

                .filter-group {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    flex-wrap: wrap;
                }

                .filter-label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: #4a5568;
                    font-weight: 500;
                }

                .filter-select {
                    padding: 0.75rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    background: white;
                    min-width: 150px;
                }

                .table-container {
                    background: white;
                    border-radius: 12px;
                    overflow-x: auto;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }

                .data-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .data-table th {
                    padding: 1rem;
                    text-align: left;
                    color: #718096;
                    font-weight: 600;
                    font-size: 0.85rem;
                    border-bottom: 2px solid #e2e8f0;
                    cursor: pointer;
                }

                .data-table th:hover {
                    color: #4299e1;
                }

                .data-table td {
                    padding: 1rem;
                    border-bottom: 1px solid #e2e8f0;
                    color: #2d3748;
                }

                .company-cell {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .company-logo-small {
                    width: 40px;
                    height: 40px;
                    border-radius: 8px;
                    object-fit: cover;
                }

                .company-logo-placeholder-small {
                    width: 40px;
                    height: 40px;
                    border-radius: 8px;
                    background: linear-gradient(135deg, #4299e1, #667eea);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                    font-weight: bold;
                }

                .company-name {
                    font-weight: 600;
                    color: #2d3748;
                }

                .company-email {
                    color: #a0aec0;
                    font-size: 0.85rem;
                }

                .industry-badge {
                    padding: 0.25rem 0.75rem;
                    background: #ebf8ff;
                    color: #4299e1;
                    border-radius: 30px;
                    font-size: 0.85rem;
                    font-weight: 500;
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

                .status-badge.verified {
                    background: #f0fff4;
                    color: #48bb78;
                }

                .status-badge.pending {
                    background: #fffaf0;
                    color: #ed8936;
                }

                .claimed-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.25rem 0.75rem;
                    border-radius: 30px;
                    font-size: 0.85rem;
                    font-weight: 500;
                }

                .claimed-badge.claimed {
                    background: #f0fff4;
                    color: #48bb78;
                }

                .claimed-badge.unclaimed {
                    background: #fff5f5;
                    color: #f56565;
                }

                .rating-cell {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .rating-stars {
                    color: #fbbf24;
                    font-size: 1rem;
                }

                .rating-value {
                    font-weight: 600;
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

                .btn-icon.success:hover {
                    background: #48bb78;
                }

                .btn-icon.danger:hover {
                    background: #f56565;
                }

                .btn.btn-warning {
                    background: #f59e0b;
                    color: #fff;
                }

                .empty-state {
                    text-align: center;
                    padding: 4rem 2rem;
                }

                .empty-state svg {
                    color: #cbd5e0;
                    margin-bottom: 1rem;
                }

                .empty-state h3 {
                    color: #2d3748;
                    margin-bottom: 0.5rem;
                }

                .empty-state p {
                    color: #a0aec0;
                }

                .pagination {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 1rem;
                    margin-top: 2rem;
                }

                .pagination-btn {
                    padding: 0.5rem 1rem;
                    border: 1px solid #e2e8f0;
                    background: white;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.3s;
                }

                .pagination-btn:hover:not(:disabled) {
                    background: #4299e1;
                    color: white;
                    border-color: #4299e1;
                }

                .pagination-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .page-info {
                    color: #4a5568;
                }

                .rows-per-page {
                    padding: 0.5rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    margin-left: 1rem;
                }

                
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }

                .modal-content.large {
                    max-width: 900px;
                    width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid #e2e8f0;
                }

                .close-btn {
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: #a0aec0;
                }

                .company-details {
                    padding: 1rem 0;
                }

                .admin-edit-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 1rem;
                }

                .admin-edit-grid label {
                    display: flex;
                    flex-direction: column;
                    gap: 0.4rem;
                    font-size: 0.9rem;
                    color: #334155;
                }

                .admin-edit-grid input,
                .admin-edit-grid textarea {
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    padding: 0.55rem 0.75rem;
                }

                .admin-edit-grid__full {
                    grid-column: 1 / -1;
                }

                .detail-header {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .detail-logo {
                    width: 80px;
                    height: 80px;
                    border-radius: 12px;
                    object-fit: cover;
                }

                .detail-logo-placeholder {
                    width: 80px;
                    height: 80px;
                    border-radius: 12px;
                    background: linear-gradient(135deg, #4299e1, #667eea);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 2rem;
                    font-weight: bold;
                }

                .detail-title h3 {
                    color: #2d3748;
                    font-size: 1.5rem;
                    margin-bottom: 0.25rem;
                }

                .detail-industry {
                    color: #718096;
                }

                .detail-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 2rem;
                }

                .detail-section {
                    background: #f7fafc;
                    padding: 1.5rem;
                    border-radius: 8px;
                }

                .detail-section.full-width {
                    grid-column: 1 / -1;
                }

                .detail-section h4 {
                    color: #2d3748;
                    margin-bottom: 1rem;
                    font-size: 1.1rem;
                }

                .detail-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 0.75rem;
                    color: #4a5568;
                }

                .detail-item svg {
                    color: #4299e1;
                }

                .detail-item a {
                    color: #4299e1;
                    text-decoration: none;
                }

                .detail-item a:hover {
                    text-decoration: underline;
                }

                .timeline {
                    position: relative;
                    padding-left: 2rem;
                }

                .timeline::before {
                    content: '';
                    position: absolute;
                    left: 7px;
                    top: 0;
                    bottom: 0;
                    width: 2px;
                    background: #e2e8f0;
                }

                .timeline-item {
                    position: relative;
                    padding-bottom: 1.5rem;
                }

                .timeline-item::before {
                    content: '';
                    position: absolute;
                    left: -2rem;
                    top: 0.25rem;
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: #4299e1;
                    border: 2px solid white;
                }

                .timeline-date {
                    color: #718096;
                    font-size: 0.85rem;
                    margin-bottom: 0.25rem;
                }

                .timeline-content {
                    color: #2d3748;
                }

                .modal-actions {
                    display: flex;
                    gap: 1rem;
                    justify-content: flex-end;
                    margin-top: 2rem;
                    padding-top: 1rem;
                    border-top: 1px solid #e2e8f0;
                }

                .btn-success {
                    background: #48bb78;
                    color: white;
                }

                .btn-success:hover {
                    background: #38a169;
                }

                @media (max-width: 1024px) {
                    .detail-grid {
                        grid-template-columns: 1fr;
                    }
                }

                @media (max-width: 768px) {
                    .page-header {
                        flex-direction: column;
                        gap: 1rem;
                    }

                    .filters-section {
                        flex-direction: column;
                    }

                    .search-box {
                        min-width: 100%;
                    }

                    .filter-group {
                        width: 100%;
                    }

                    .filter-select {
                        flex: 1;
                    }

                    .stats-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
};

export default CompanyManagement;
