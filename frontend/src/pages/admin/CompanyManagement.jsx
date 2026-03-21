import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../../services/api';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';
import { buildLogoUrls } from '../../utils/companyLogos';
import { resolveMediaUrl } from '../../utils/media';
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
    FaUsers,
    FaRegBuilding,
    FaRegClock,
    FaRegCheckCircle,
    FaRegTimesCircle,
    FaDownload,
    FaPrint,
    FaCopy,
    FaLink,
    FaExternalLinkAlt,
    FaRegEnvelope,
    FaRegAddressCard,
    FaRegCalendarAlt,
    FaRegChartBar,
    FaRegStar,
    FaRegUser,
    FaEllipsisV,
    FaSort,
    FaSortUp,
    FaSortDown,
    FaArrowUp,
    FaArrowDown,
    FaSync,
    FaRegBell,
    FaRegFileAlt,
    FaRegImage,
    FaRegSave,
    FaRegTrashAlt
} from 'react-icons/fa';

// Modern Stat Card Component
const StatCard = ({ icon: Icon, title, value, subtitle, trend, color = 'blue' }) => {
    const colors = {
        blue: { bg: '#3b82f620', text: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)' },
        green: { bg: '#10b98120', text: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #059669)' },
        orange: { bg: '#f59e0b20', text: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
        red: { bg: '#ef444420', text: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #dc2626)' },
        purple: { bg: '#8b5cf620', text: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' },
        pink: { bg: '#ec489920', text: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899, #db2777)' }
    };

    return (
        <div className="stat-card" style={{ '--stat-color': colors[color].text }}>
            <div className="stat-card__icon" style={{ background: colors[color].bg, color: colors[color].text }}>
                <Icon />
            </div>
            <div className="stat-card__content">
                <span className="stat-card__label">{title}</span>
                <span className="stat-card__value">{value}</span>
                {subtitle && <span className="stat-card__subtitle">{subtitle}</span>}
                {trend && (
                    <span className={`stat-card__trend ${trend > 0 ? 'positive' : 'negative'}`}>
                        {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
                    </span>
                )}
            </div>
        </div>
    );
};

// Modern Badge Component
const Badge = ({ children, variant = 'default', icon: Icon }) => {
    return (
        <span className={`badge badge-${variant}`}>
            {Icon && <Icon className="badge__icon" />}
            {children}
        </span>
    );
};

// Modern Table Row Actions
const RowActions = ({ actions }) => {
    const [showMenu, setShowMenu] = useState(false);

    return (
        <div className="row-actions">
            {actions.slice(0, 3).map((action, index) => (
                <button
                    key={index}
                    className={`row-actions__btn row-actions__btn--${action.variant || 'default'}`}
                    onClick={action.onClick}
                    title={action.label}
                >
                    <action.icon />
                </button>
            ))}
            {actions.length > 3 && (
                <div className="row-actions__more">
                    <button
                        className="row-actions__btn"
                        onClick={() => setShowMenu(!showMenu)}
                    >
                        <FaEllipsisV />
                    </button>
                    {showMenu && (
                        <div className="row-actions__menu">
                            {actions.slice(3).map((action, index) => (
                                <button
                                    key={index}
                                    className="row-actions__menu-item"
                                    onClick={() => {
                                        action.onClick();
                                        setShowMenu(false);
                                    }}
                                >
                                    <action.icon /> {action.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Modern Modal Component
const Modal = ({ isOpen, onClose, title, size = 'medium', children }) => {
    if (!isOpen) return null;

    return (
        <div className="company-modal__overlay" onClick={onClose}>
            <div className={`company-modal company-modal--${size}`} onClick={e => e.stopPropagation()}>
                <div className="company-modal__header">
                    <h2 className="company-modal__title">{title}</h2>
                    <button className="company-modal__close" onClick={onClose}>×</button>
                </div>
                <div className="company-modal__body">
                    {children}
                </div>
            </div>
        </div>
    );
};

// Modern Company Logo Component
const CompanyLogo = ({ company, size = 'medium' }) => {
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
                className={`company-logo company-logo--${size}`}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={handleError}
            />
        );
    }

    return (
        <div className={`company-logo-placeholder company-logo-placeholder--${size}`}>
            {(company?.name || 'C').charAt(0)}
        </div>
    );
};

// Modern Rating Component
const Rating = ({ value, max = 5, showValue = true }) => {
    const percentage = (value / max) * 100;

    return (
        <div className="rating">
            <div className="rating__stars">
                {[...Array(max)].map((_, i) => (
                    <FaStar key={i} className={`rating__star ${i < Math.floor(value) ? 'filled' : ''}`} />
                ))}
            </div>
            {showValue && <span className="rating__value">{value.toFixed(1)}</span>}
        </div>
    );
};

// Modern Timeline Component
const Timeline = ({ items }) => {
    return (
        <div className="timeline">
            {items.map((item, index) => (
                <div key={index} className="timeline__item">
                    <div className="timeline__dot" style={{ background: item.color || '#3b82f6' }} />
                    <div className="timeline__content">
                        <div className="timeline__header">
                            <span className="timeline__title">{item.title}</span>
                            <span className="timeline__date">{item.date}</span>
                        </div>
                        <p className="timeline__description">{item.description}</p>
                    </div>
                </div>
            ))}
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
    const [itemsPerPage, setItemsPerPage] = useState(10);
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
    const [selectedRows, setSelectedRows] = useState([]);
    const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'
    const [showFilters, setShowFilters] = useState(false);

    const toNumber = (value, fallback = 0) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    };

    const toLocale = (value, fallback = '0') => {
        const n = toNumber(value, NaN);
        return Number.isFinite(n) ? n.toLocaleString() : fallback;
    };

    const normalizeCompany = (company) => ({
        ...company,
        reviews_count: toNumber(company.review_count ?? company.reviews_count ?? 0),
        avg_rating: toNumber(company.avg_rating ?? 0),
        employee_count: toNumber(company.employee_count ?? 0),
        claimed_by: company.claimed_by_name || company.claimed_by
    });

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
                    industry: filterIndustry !== 'all' ? filterIndustry : undefined,
                    startDate: dateRange.start || undefined,
                    endDate: dateRange.end || undefined
                }
            });

            const companyRows = data.companies || [];
            const normalizedCompanies = companyRows.map(normalizeCompany);

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
            const normalized = normalizeCompany(data);
            setSelectedCompany(normalized);
            setCompanies((prev) =>
                prev.map((c) => (c.id === normalized.id ? { ...c, ...normalized } : c))
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
                const nextCompany = data.company || data || null;
                setSelectedCompany(nextCompany ? normalizeCompany(nextCompany) : null);
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

    const handleBulkDelete = async () => {
        if (selectedRows.length === 0) {
            toast.error('Select at least one company');
            return;
        }

        if (!window.confirm(`Delete ${selectedRows.length} companies?`)) return;

        try {
            await Promise.all(selectedRows.map(id => api.delete(`/admin/companies/${id}`)));
            toast.success(`${selectedRows.length} companies deleted`);
            setSelectedRows([]);
            fetchCompanies();
        } catch (error) {
            toast.error('Failed to delete some companies');
        }
    };

    const handleBulkVerify = async () => {
        if (selectedRows.length === 0) {
            toast.error('Select at least one company');
            return;
        }

        if (!window.confirm(`Verify ${selectedRows.length} companies?`)) return;

        try {
            await Promise.all(selectedRows.map(id => api.patch(`/admin/companies/${id}/verify`)));
            toast.success(`${selectedRows.length} companies verified`);
            setSelectedRows([]);
            fetchCompanies();
        } catch (error) {
            toast.error('Failed to verify some companies');
        }
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

    const getSortIcon = (field) => {
        if (sortBy !== field) return <FaSort className="sort-icon" />;
        return sortOrder === 'asc' ? <FaSortUp className="sort-icon active" /> : <FaSortDown className="sort-icon active" />;
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

    const timelineItems = useMemo(() => {
        if (!selectedCompany) return [];
        return [
            {
                title: 'Company Created',
                date: new Date(selectedCompany.created_at).toLocaleDateString(),
                description: 'Company profile was created',
                color: '#3b82f6'
            },
            ...(selectedCompany.claimed_date ? [{
                title: 'Company Claimed',
                date: new Date(selectedCompany.claimed_date).toLocaleDateString(),
                description: `Claimed by ${selectedCompany.claimed_by}`,
                color: '#8b5cf6'
            }] : []),
            ...(selectedCompany.verification_date ? [{
                title: 'Company Verified',
                date: new Date(selectedCompany.verification_date).toLocaleDateString(),
                description: 'Company was verified',
                color: '#10b981'
            }] : []),
            {
                title: 'Last Updated',
                date: new Date(selectedCompany.updated_at).toLocaleDateString(),
                description: 'Profile was updated',
                color: '#f59e0b'
            }
        ];
    }, [selectedCompany]);

    if (loading) return <Loading />;

    return (
        <div className="company-management">
            {/* Header */}
            <div className="page-header">
                <div className="page-header__left">
                    <div className="page-header__title">
                        <FaBuilding className="page-header__icon" />
                        <div>
                            <h1>Company Management</h1>
                            <p className="page-header__subtitle">Manage and verify companies on the platform</p>
                        </div>
                    </div>
                </div>
                <div className="page-header__right">
                    <button className="btn btn-outline" onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}>
                        {viewMode === 'table' ? <FaRegBuilding /> : <FaRegFileAlt />}
                    </button>
                    <button className="btn btn-outline" onClick={fetchCompanies}>
                        <FaSync />
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        <FaPlus /> Add Company
                    </button>
                    <button className="btn btn-secondary" onClick={handleExport}>
                        <FaFileExport /> Export
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <StatCard
                    icon={FaBuilding}
                    title="Total Companies"
                    value={stats.total.toLocaleString()}
                    subtitle="All registered companies"
                    trend={12}
                    color="blue"
                />
                <StatCard
                    icon={FaCheckCircle}
                    title="Verified"
                    value={stats.verified.toLocaleString()}
                    subtitle={`${Math.round(stats.verified / stats.total * 100)}% of total`}
                    color="green"
                />
                <StatCard
                    icon={FaExclamationTriangle}
                    title="Pending Verification"
                    value={stats.pending.toLocaleString()}
                    subtitle="Awaiting review"
                    color="orange"
                />
                <StatCard
                    icon={FaShieldAlt}
                    title="Claimed"
                    value={stats.claimed.toLocaleString()}
                    subtitle={`${stats.unclaimed} unclaimed`}
                    color="purple"
                />
            </div>

            {/* Filters Bar */}
            <div className="filters-bar">
                <div className="search-box">
                    <FaSearch className="search-box__icon" />
                    <input
                        type="text"
                        placeholder="Search companies by name, email, or description..."
                        value={searchTerm}
                        onChange={handleSearch}
                        className="search-box__input"
                    />
                </div>

                <div className="filters-group">
                    <button
                        className={`filter-chip ${filterStatus === 'all' ? 'active' : ''}`}
                        onClick={() => handleFilterStatus('all')}
                    >
                        All
                    </button>
                    <button
                        className={`filter-chip verified ${filterStatus === 'verified' ? 'active' : ''}`}
                        onClick={() => handleFilterStatus('verified')}
                    >
                        <FaCheckCircle /> Verified
                    </button>
                    <button
                        className={`filter-chip pending ${filterStatus === 'pending' ? 'active' : ''}`}
                        onClick={() => handleFilterStatus('pending')}
                    >
                        <FaRegClock /> Pending
                    </button>
                    <button
                        className={`filter-chip claimed ${filterStatus === 'claimed' ? 'active' : ''}`}
                        onClick={() => handleFilterStatus('claimed')}
                    >
                        <FaShieldAlt /> Claimed
                    </button>
                    <button
                        className={`filter-chip unclaimed ${filterStatus === 'unclaimed' ? 'active' : ''}`}
                        onClick={() => handleFilterStatus('unclaimed')}
                    >
                        <FaRegBuilding /> Unclaimed
                    </button>

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

                    <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <FaFilter /> {showFilters ? 'Hide' : 'Show'} Filters
                    </button>
                </div>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
                <div className="advanced-filters">
                    <div className="advanced-filters__row">
                        <div className="advanced-filters__group">
                            <label>Date Range</label>
                            <div className="advanced-filters__dates">
                                <input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                    className="filter-input"
                                />
                                <span>to</span>
                                <input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                    className="filter-input"
                                />
                            </div>
                        </div>
                        <div className="advanced-filters__group">
                            <label>Items per page</label>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="filter-select"
                            >
                                <option value={10}>10 per page</option>
                                <option value={25}>25 per page</option>
                                <option value={50}>50 per page</option>
                                <option value={100}>100 per page</option>
                            </select>
                        </div>
                        <div className="advanced-filters__group">
                            <label>&nbsp;</label>
                            <button className="btn btn-primary" onClick={fetchCompanies}>
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Actions */}
            {selectedRows.length > 0 && (
                <div className="bulk-actions">
                    <span className="bulk-actions__info">
                        {selectedRows.length} company(ies) selected
                    </span>
                    <div className="bulk-actions__buttons">
                        <button className="btn btn-success btn-sm" onClick={handleBulkVerify}>
                            <FaCheckCircle /> Verify Selected
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>
                            <FaTrash /> Delete Selected
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => setSelectedRows([])}>
                            Clear
                        </button>
                    </div>
                </div>
            )}

            {/* Table View */}
            {viewMode === 'table' && (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                        <tr>
                            <th width="40">
                                <input
                                    type="checkbox"
                                    checked={selectedRows.length === currentItems.length && currentItems.length > 0}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setSelectedRows(currentItems.map(c => c.id));
                                        } else {
                                            setSelectedRows([]);
                                        }
                                    }}
                                />
                            </th>
                            <th onClick={() => handleSort('name')}>
                                Company {getSortIcon('name')}
                            </th>
                            <th onClick={() => handleSort('industry')}>
                                Industry {getSortIcon('industry')}
                            </th>
                            <th onClick={() => handleSort('is_verified')}>
                                Status
                            </th>
                            <th onClick={() => handleSort('is_claimed')}>
                                Claimed
                            </th>
                            <th onClick={() => handleSort('reviews_count')}>
                                Reviews {getSortIcon('reviews_count')}
                            </th>
                            <th onClick={() => handleSort('avg_rating')}>
                                Rating {getSortIcon('avg_rating')}
                            </th>
                            <th onClick={() => handleSort('employee_count')}>
                                Employees {getSortIcon('employee_count')}
                            </th>
                            <th>Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {currentItems.map(company => (
                            <tr key={company.id} className={selectedRows.includes(company.id) ? 'selected' : ''}>
                                <td>
                                    <input
                                        type="checkbox"
                                        checked={selectedRows.includes(company.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedRows([...selectedRows, company.id]);
                                            } else {
                                                setSelectedRows(selectedRows.filter(id => id !== company.id));
                                            }
                                        }}
                                    />
                                </td>
                                <td>
                                    <div className="company-cell">
                                        <CompanyLogo company={company} size="small" />
                                        <div className="company-cell__info">
                                            <span className="company-cell__name">{company.name}</span>
                                            <span className="company-cell__email">{company.email}</span>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <Badge variant="industry">{company.industry}</Badge>
                                </td>
                                <td>
                                    {company.is_verified ? (
                                        <Badge variant="success" icon={FaCheckCircle}>Verified</Badge>
                                    ) : (
                                        <Badge variant="warning" icon={FaRegClock}>Pending</Badge>
                                    )}
                                </td>
                                <td>
                                    {company.is_claimed ? (
                                        <Badge variant="success" icon={FaCheckCircle}>Yes</Badge>
                                    ) : (
                                        <Badge variant="danger" icon={FaTimesCircle}>No</Badge>
                                    )}
                                </td>
                                <td>{toLocale(company.reviews_count)}</td>
                                <td>
                                    <Rating value={toNumber(company.avg_rating)} />
                                </td>
                                <td>{toLocale(company.employee_count)}</td>
                                <td>
                                    <RowActions
                                        actions={[
                                            {
                                                icon: FaEye,
                                                label: 'View Details',
                                                onClick: () => handleViewDetails(company),
                                                variant: 'info'
                                            },
                                            {
                                                icon: FaEdit,
                                                label: 'Edit',
                                                onClick: () => {
                                                    handleViewDetails(company);
                                                    setEditMode(true);
                                                },
                                                variant: 'warning'
                                            },
                                            ...(!company.is_verified ? [{
                                                icon: FaCheckCircle,
                                                label: 'Verify',
                                                onClick: () => handleVerify(company.id),
                                                variant: 'success'
                                            }] : []),
                                            {
                                                icon: FaTrash,
                                                label: 'Delete',
                                                onClick: () => handleDelete(company.id),
                                                variant: 'danger'
                                            }
                                        ]}
                                    />
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>

                    {filteredCompanies.length === 0 && (
                        <div className="empty-state">
                            <FaBuilding className="empty-state__icon" />
                            <h3 className="empty-state__title">No companies found</h3>
                            <p className="empty-state__text">Try adjusting your search or filter criteria</p>
                        </div>
                    )}
                </div>
            )}

            {/* Grid View */}
            {viewMode === 'grid' && (
                <div className="companies-grid">
                    {currentItems.map(company => (
                        <div key={company.id} className="company-card">
                            <div className="company-card__header">
                                <CompanyLogo company={company} size="large" />
                                <div className="company-card__title">
                                    <h3>{company.name}</h3>
                                    <Badge variant="industry">{company.industry}</Badge>
                                </div>
                                <div className="company-card__status">
                                    {company.is_verified ? (
                                        <Badge variant="success" icon={FaCheckCircle}>Verified</Badge>
                                    ) : (
                                        <Badge variant="warning" icon={FaRegClock}>Pending</Badge>
                                    )}
                                </div>
                            </div>

                            <div className="company-card__stats">
                                <div className="company-card__stat">
                                    <FaRegStar />
                                    <span>{toNumber(company.avg_rating).toFixed(1)} Rating</span>
                                </div>
                                <div className="company-card__stat">
                                    <FaRegFileAlt />
                                    <span>{toLocale(company.reviews_count)} Reviews</span>
                                </div>
                                <div className="company-card__stat">
                                    <FaUsers />
                                    <span>{toLocale(company.employee_count)} Employees</span>
                                </div>
                            </div>

                            <div className="company-card__footer">
                                <button className="btn btn-outline btn-sm" onClick={() => handleViewDetails(company)}>
                                    <FaEye /> View
                                </button>
                                <button className="btn btn-outline btn-sm" onClick={() => {
                                    handleViewDetails(company);
                                    setEditMode(true);
                                }}>
                                    <FaEdit /> Edit
                                </button>
                                {!company.is_verified && (
                                    <button className="btn btn-success btn-sm" onClick={() => handleVerify(company.id)}>
                                        <FaCheckCircle /> Verify
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {filteredCompanies.length > 0 && (
                <div className="pagination">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="pagination__btn"
                    >
                        <FaChevronLeft />
                    </button>

                    <div className="pagination__pages">
                        {[...Array(Math.min(5, totalPages))].map((_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                                pageNum = i + 1;
                            } else if (currentPage <= 3) {
                                pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                                pageNum = totalPages - 4 + i;
                            } else {
                                pageNum = currentPage - 2 + i;
                            }

                            return (
                                <button
                                    key={i}
                                    className={`pagination__page ${currentPage === pageNum ? 'active' : ''}`}
                                    onClick={() => setCurrentPage(pageNum)}
                                >
                                    {pageNum}
                                </button>
                            );
                        })}
                    </div>

                    <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="pagination__btn"
                    >
                        <FaChevronRight />
                    </button>

                    <span className="pagination__info">
                        Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredCompanies.length)} of {filteredCompanies.length}
                    </span>
                </div>
            )}

            {/* Details Modal */}
            <Modal
                isOpen={showDetails}
                onClose={() => {
                    setShowDetails(false);
                    setEditMode(false);
                }}
                title="Company Details"
                size="large"
            >
                {selectedCompany && (
                    <div className="company-details">
                        <div className="company-details__header">
                            <CompanyLogo company={selectedCompany} size="large" />
                            <div className="company-details__title">
                                <h2>{selectedCompany.name}</h2>
                                <Badge variant="industry">{selectedCompany.industry}</Badge>
                            </div>
                            <div className="company-details__badges">
                                {selectedCompany.is_verified ? (
                                    <Badge variant="success" icon={FaCheckCircle}>Verified</Badge>
                                ) : (
                                    <Badge variant="warning" icon={FaRegClock}>Pending</Badge>
                                )}
                                {selectedCompany.is_claimed ? (
                                    <Badge variant="success" icon={FaShieldAlt}>Claimed</Badge>
                                ) : (
                                    <Badge variant="danger" icon={FaRegBuilding}>Unclaimed</Badge>
                                )}
                            </div>
                        </div>

                        {!editMode ? (
                            <>
                                <div className="company-details__grid">
                                    {/* Company Information */}
                                    <div className="company-details__section">
                                        <h3>Company Information</h3>
                                        <div className="company-details__items">
                                            {selectedCompany.website && (
                                                <div className="company-details__item">
                                                    <FaGlobe />
                                                    <a href={selectedCompany.website} target="_blank" rel="noopener noreferrer">
                                                        {selectedCompany.website}
                                                    </a>
                                                </div>
                                            )}
                                            {selectedCompany.email && (
                                                <div className="company-details__item">
                                                    <FaEnvelope />
                                                    <a href={`mailto:${selectedCompany.email}`}>{selectedCompany.email}</a>
                                                </div>
                                            )}
                                            {selectedCompany.phone && (
                                                <div className="company-details__item">
                                                    <FaPhone />
                                                    <a href={`tel:${selectedCompany.phone}`}>{selectedCompany.phone}</a>
                                                </div>
                                            )}
                                            {selectedCompany.address && (
                                                <div className="company-details__item">
                                                    <FaMapMarkerAlt />
                                                    <span>{selectedCompany.address}</span>
                                                </div>
                                            )}
                                            {selectedCompany.city && selectedCompany.country && (
                                                <div className="company-details__item">
                                                    <FaMapMarkerAlt />
                                                    <span>{selectedCompany.city}, {selectedCompany.country}</span>
                                                </div>
                                            )}
                                            {selectedCompany.registration_number && (
                                                <div className="company-details__item">
                                                    <FaRegAddressCard />
                                                    <span>Reg: {selectedCompany.registration_number}</span>
                                                </div>
                                            )}
                                            {selectedCompany.founded && (
                                                <div className="company-details__item">
                                                    <FaRegCalendarAlt />
                                                    <span>Founded: {selectedCompany.founded}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Verification Status */}
                                    <div className="company-details__section">
                                        <h3>Verification Status</h3>
                                        <div className="company-details__items">
                                            <div className="company-details__item">
                                                <FaCheckCircle />
                                                <span>Verified: {selectedCompany.is_verified ? 'Yes' : 'No'}</span>
                                            </div>
                                            {selectedCompany.is_verified && selectedCompany.verification_date && (
                                                <>
                                                    <div className="company-details__item">
                                                        <FaRegCalendarAlt />
                                                        <span>Verified: {new Date(selectedCompany.verification_date).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="company-details__item">
                                                        <FaUserTie />
                                                        <span>By: {selectedCompany.claimed_by}</span>
                                                    </div>
                                                </>
                                            )}
                                            <div className="company-details__item">
                                                <FaShieldAlt />
                                                <span>Claimed: {selectedCompany.is_claimed ? 'Yes' : 'No'}</span>
                                            </div>
                                            {selectedCompany.is_claimed && selectedCompany.claimed_date && (
                                                <div className="company-details__item">
                                                    <FaRegCalendarAlt />
                                                    <span>Claimed: {new Date(selectedCompany.claimed_date).toLocaleDateString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Statistics */}
                                    <div className="company-details__section">
                                        <h3>Statistics</h3>
                                        <div className="company-details__items">
                                            <div className="company-details__item">
                                                <FaStar />
                                                <span>Rating: {toNumber(selectedCompany.avg_rating).toFixed(1)}</span>
                                                <Rating value={toNumber(selectedCompany.avg_rating)} showValue={false} />
                                            </div>
                                            <div className="company-details__item">
                                                <FaRegFileAlt />
                                                <span>Reviews: {toLocale(selectedCompany.reviews_count)}</span>
                                            </div>
                                            <div className="company-details__item">
                                                <FaUsers />
                                                <span>Employees: {toLocale(selectedCompany.employee_count)}</span>
                                            </div>
                                            {selectedCompany.monthly_revenue && (
                                                <div className="company-details__item">
                                                    <FaChartLine />
                                                    <span>Revenue: ${selectedCompany.monthly_revenue.toLocaleString()}/mo</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Description */}
                                {selectedCompany.description && (
                                    <div className="company-details__section full-width">
                                        <h3>Description</h3>
                                        <p className="company-details__description">{selectedCompany.description}</p>
                                    </div>
                                )}

                                {/* Timeline */}
                                <div className="company-details__section full-width">
                                    <h3>Timeline</h3>
                                    <Timeline items={timelineItems} />
                                </div>
                            </>
                        ) : (
                            /* Edit Mode */
                            <div className="company-details__section full-width">
                                <h3>Edit Company</h3>
                                <div className="edit-form">
                                    <div className="edit-form__grid">
                                        <div className="edit-form__field">
                                            <label>Name *</label>
                                            <input
                                                type="text"
                                                value={editForm.name}
                                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                                className="edit-form__input"
                                            />
                                        </div>
                                        <div className="edit-form__field">
                                            <label>Industry</label>
                                            <input
                                                type="text"
                                                value={editForm.industry}
                                                onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })}
                                                className="edit-form__input"
                                            />
                                        </div>
                                        <div className="edit-form__field">
                                            <label>Website</label>
                                            <input
                                                type="url"
                                                value={editForm.website}
                                                onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                                                className="edit-form__input"
                                            />
                                        </div>
                                        <div className="edit-form__field">
                                            <label>Email</label>
                                            <input
                                                type="email"
                                                value={editForm.email}
                                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                                className="edit-form__input"
                                            />
                                        </div>
                                        <div className="edit-form__field">
                                            <label>Phone</label>
                                            <input
                                                type="tel"
                                                value={editForm.phone}
                                                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                                className="edit-form__input"
                                            />
                                        </div>
                                        <div className="edit-form__field">
                                            <label>Address</label>
                                            <input
                                                type="text"
                                                value={editForm.address}
                                                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                                                className="edit-form__input"
                                            />
                                        </div>
                                        <div className="edit-form__field">
                                            <label>City</label>
                                            <input
                                                type="text"
                                                value={editForm.city}
                                                onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                                                className="edit-form__input"
                                            />
                                        </div>
                                        <div className="edit-form__field">
                                            <label>Country *</label>
                                            <input
                                                type="text"
                                                value={editForm.country}
                                                onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                                                className="edit-form__input"
                                            />
                                        </div>
                                        <div className="edit-form__field">
                                            <label>Registration Number</label>
                                            <input
                                                type="text"
                                                value={editForm.registration_number}
                                                onChange={(e) => setEditForm({ ...editForm, registration_number: e.target.value })}
                                                className="edit-form__input"
                                            />
                                        </div>
                                        <div className="edit-form__field">
                                            <label>Logo URL</label>
                                            <input
                                                type="url"
                                                value={editForm.logo_url}
                                                onChange={(e) => setEditForm({ ...editForm, logo_url: e.target.value })}
                                                className="edit-form__input"
                                            />
                                        </div>
                                        <div className="edit-form__field full-width">
                                            <label>Description</label>
                                            <textarea
                                                rows={4}
                                                value={editForm.description}
                                                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                                className="edit-form__textarea"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Modal Actions */}
                        <div className="company-modal__actions">
                            <button className="btn btn-outline" onClick={() => {
                                setShowDetails(false);
                                setEditMode(false);
                            }}>
                                Close
                            </button>

                            {!editMode ? (
                                <>
                                    <button className="btn btn-primary" onClick={() => setEditMode(true)}>
                                        <FaEdit /> Edit Company
                                    </button>
                                    {!selectedCompany.is_verified && (
                                        <button className="btn btn-success" onClick={() => handleVerify(selectedCompany.id)}>
                                            <FaCheckCircle /> Verify
                                        </button>
                                    )}
                                    {selectedCompany.is_claimed && (
                                        <button className="btn btn-warning" onClick={() => handleUnclaim(selectedCompany.id)}>
                                            <FaTimesCircle /> Unclaim
                                        </button>
                                    )}
                                    <button className="btn btn-danger" onClick={() => handleDelete(selectedCompany.id)}>
                                        <FaTrash /> Delete
                                    </button>
                                </>
                            ) : (
                                <button className="btn btn-primary" onClick={handleEditSave} disabled={saving}>
                                    <FaRegSave /> {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Create Company Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="Add New Company"
                size="large"
            >
                <div className="create-form">
                    <div className="create-form__grid">
                        <div className="create-form__field">
                            <label>Name *</label>
                            <input
                                type="text"
                                value={createForm.name}
                                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                                placeholder="Company name"
                                className="create-form__input"
                            />
                        </div>
                        <div className="create-form__field">
                            <label>Industry</label>
                            <input
                                type="text"
                                value={createForm.industry}
                                onChange={(e) => setCreateForm({ ...createForm, industry: e.target.value })}
                                placeholder="e.g., Technology"
                                className="create-form__input"
                            />
                        </div>
                        <div className="create-form__field">
                            <label>Website</label>
                            <input
                                type="url"
                                value={createForm.website}
                                onChange={(e) => setCreateForm({ ...createForm, website: e.target.value })}
                                placeholder="https://example.com"
                                className="create-form__input"
                            />
                        </div>
                        <div className="create-form__field">
                            <label>Email</label>
                            <input
                                type="email"
                                value={createForm.email}
                                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                                placeholder="contact@company.com"
                                className="create-form__input"
                            />
                        </div>
                        <div className="create-form__field">
                            <label>Phone</label>
                            <input
                                type="tel"
                                value={createForm.phone}
                                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                                placeholder="+1 234 567 890"
                                className="create-form__input"
                            />
                        </div>
                        <div className="create-form__field">
                            <label>Address</label>
                            <input
                                type="text"
                                value={createForm.address}
                                onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                                placeholder="Street address"
                                className="create-form__input"
                            />
                        </div>
                        <div className="create-form__field">
                            <label>City</label>
                            <input
                                type="text"
                                value={createForm.city}
                                onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                                placeholder="City"
                                className="create-form__input"
                            />
                        </div>
                        <div className="create-form__field">
                            <label>Country *</label>
                            <input
                                type="text"
                                value={createForm.country}
                                onChange={(e) => setCreateForm({ ...createForm, country: e.target.value })}
                                placeholder="Country"
                                className="create-form__input"
                            />
                        </div>
                        <div className="create-form__field full-width">
                            <label>Description</label>
                            <textarea
                                rows={4}
                                value={createForm.description}
                                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                                placeholder="Company description"
                                className="create-form__textarea"
                            />
                        </div>
                    </div>

                    <div className="company-modal__actions">
                        <button className="btn btn-outline" onClick={() => setShowCreateModal(false)}>
                            Cancel
                        </button>
                        <button className="btn btn-primary" onClick={handleCreateCompany} disabled={createSaving}>
                            {createSaving ? 'Creating...' : 'Create Company'}
                        </button>
                    </div>
                </div>
            </Modal>

            <style>{`
                /* Company Management - Modern Styles */
                .company-management {
                    padding: 2rem;
                    background: #f8fafc;
                    min-height: 100vh;
                }

                /* Page Header */
                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }

                .page-header__left {
                    display: flex;
                    align-items: center;
                }

                .page-header__title {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .page-header__icon {
                    font-size: 2.5rem;
                    color: #3b82f6;
                    background: rgba(59, 130, 246, 0.1);
                    padding: 1rem;
                    border-radius: 16px;
                }

                .page-header__title h1 {
                    font-size: 2rem;
                    color: #1e293b;
                    margin: 0;
                }

                .page-header__subtitle {
                    color: #64748b;
                    margin: 0.25rem 0 0 0;
                }

                .page-header__right {
                    display: flex;
                    gap: 0.75rem;
                }

                /* Stats Grid */
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .stat-card {
                    background: white;
                    border-radius: 16px;
                    padding: 1.5rem;
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
                    transition: all 0.3s;
                    border: 1px solid #e2e8f0;
                }

                .stat-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
                }

                .stat-card__icon {
                    width: 60px;
                    height: 60px;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.8rem;
                }

                .stat-card__content {
                    flex: 1;
                }

                .stat-card__label {
                    display: block;
                    font-size: 0.9rem;
                    color: #64748b;
                    margin-bottom: 0.25rem;
                }

                .stat-card__value {
                    display: block;
                    font-size: 2rem;
                    font-weight: 700;
                    color: #1e293b;
                    line-height: 1.2;
                    margin-bottom: 0.25rem;
                }

                .stat-card__subtitle {
                    font-size: 0.85rem;
                    color: #94a3b8;
                }

                .stat-card__trend {
                    font-size: 0.85rem;
                    font-weight: 600;
                }

                .stat-card__trend.positive {
                    color: #10b981;
                }

                .stat-card__trend.negative {
                    color: #ef4444;
                }

                /* Filters Bar */
                .filters-bar {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                    flex-wrap: wrap;
                }

                .search-box {
                    flex: 1;
                    position: relative;
                    min-width: 300px;
                }

                .search-box__icon {
                    position: absolute;
                    left: 1rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #94a3b8;
                }

                .search-box__input {
                    width: 100%;
                    padding: 0.75rem 1rem 0.75rem 2.5rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    font-size: 0.95rem;
                    background: white;
                    transition: all 0.2s;
                }

                .search-box__input:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
                }

                .filters-group {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    flex-wrap: wrap;
                }

                .filter-chip {
                    padding: 0.5rem 1rem;
                    border-radius: 30px;
                    border: 1px solid #e2e8f0;
                    background: white;
                    color: #64748b;
                    font-size: 0.9rem;
                    font-weight: 500;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    transition: all 0.2s;
                }

                .filter-chip:hover {
                    border-color: #3b82f6;
                    color: #3b82f6;
                }

                .filter-chip.active {
                    background: #3b82f6;
                    border-color: #3b82f6;
                    color: white;
                }

                .filter-chip.verified.active {
                    background: #10b981;
                    border-color: #10b981;
                }

                .filter-chip.pending.active {
                    background: #f59e0b;
                    border-color: #f59e0b;
                }

                .filter-chip.claimed.active {
                    background: #8b5cf6;
                    border-color: #8b5cf6;
                }

                .filter-chip.unclaimed.active {
                    background: #ef4444;
                    border-color: #ef4444;
                }

                .filter-select {
                    padding: 0.5rem 1rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    background: white;
                    color: #1e293b;
                    font-size: 0.9rem;
                    cursor: pointer;
                    min-width: 150px;
                }

                .filter-select:focus {
                    outline: none;
                    border-color: #3b82f6;
                }

                /* Advanced Filters */
                .advanced-filters {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin-bottom: 1.5rem;
                }

                .advanced-filters__row {
                    display: flex;
                    gap: 1.5rem;
                    flex-wrap: wrap;
                    align-items: flex-end;
                }

                .advanced-filters__group {
                    flex: 1;
                    min-width: 200px;
                }

                .advanced-filters__group label {
                    display: block;
                    font-size: 0.85rem;
                    font-weight: 500;
                    color: #64748b;
                    margin-bottom: 0.5rem;
                }

                .advanced-filters__dates {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                /* Bulk Actions */
                .bulk-actions {
                    background: #eff6ff;
                    border: 1px solid #bfdbfe;
                    border-radius: 12px;
                    padding: 1rem 1.5rem;
                    margin-bottom: 1.5rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 1rem;
                }

                .bulk-actions__info {
                    font-weight: 600;
                    color: #1e40af;
                }

                .bulk-actions__buttons {
                    display: flex;
                    gap: 0.75rem;
                }

                /* Badges */
                .badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.25rem 0.75rem;
                    border-radius: 30px;
                    font-size: 0.85rem;
                    font-weight: 500;
                }

                .badge__icon {
                    font-size: 0.75rem;
                }

                .badge-success {
                    background: #d1fae5;
                    color: #065f46;
                }

                .badge-warning {
                    background: #fef3c7;
                    color: #92400e;
                }

                .badge-danger {
                    background: #fee2e2;
                    color: #991b1b;
                }

                .badge-industry {
                    background: #e2e8f0;
                    color: #334155;
                }

                /* Table */
                .table-container {
                    background: white;
                    border-radius: 16px;
                    overflow-x: auto;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
                    border: 1px solid #e2e8f0;
                }

                .data-table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .data-table th {
                    padding: 1rem;
                    text-align: left;
                    color: #64748b;
                    font-weight: 600;
                    font-size: 0.85rem;
                    border-bottom: 2px solid #e2e8f0;
                    cursor: pointer;
                    user-select: none;
                    background: #f8fafc;
                }

                .data-table th:hover {
                    color: #3b82f6;
                }

                .data-table td {
                    padding: 1rem;
                    border-bottom: 1px solid #e2e8f0;
                    color: #1e293b;
                }

                .data-table tr.selected td {
                    background: #eff6ff;
                }

                .data-table tr:hover td {
                    background: #f8fafc;
                }

                .sort-icon {
                    margin-left: 0.25rem;
                    color: #94a3b8;
                }

                .sort-icon.active {
                    color: #3b82f6;
                }

                /* Company Cell */
                .company-cell {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .company-cell__info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .company-cell__name {
                    font-weight: 600;
                    color: #1e293b;
                }

                .company-cell__email {
                    font-size: 0.85rem;
                    color: #64748b;
                }

                /* Company Logo */
                .company-logo {
                    border-radius: 8px;
                    object-fit: cover;
                }

                .company-logo--small {
                    width: 40px;
                    height: 40px;
                }

                .company-logo--medium {
                    width: 60px;
                    height: 60px;
                }

                .company-logo--large {
                    width: 80px;
                    height: 80px;
                }

                .company-logo-placeholder {
                    border-radius: 8px;
                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                }

                .company-logo-placeholder--small {
                    width: 40px;
                    height: 40px;
                    font-size: 1.2rem;
                }

                .company-logo-placeholder--medium {
                    width: 60px;
                    height: 60px;
                    font-size: 1.5rem;
                }

                .company-logo-placeholder--large {
                    width: 80px;
                    height: 80px;
                    font-size: 2rem;
                }

                /* Rating */
                .rating {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .rating__stars {
                    display: flex;
                    gap: 2px;
                }

                .rating__star {
                    color: #cbd5e1;
                }

                .rating__star.filled {
                    color: #fbbf24;
                }

                .rating__value {
                    font-weight: 600;
                    color: #1e293b;
                }

                /* Row Actions */
                .row-actions {
                    display: flex;
                    gap: 0.25rem;
                    position: relative;
                }

                .row-actions__btn {
                    width: 32px;
                    height: 32px;
                    border-radius: 6px;
                    border: none;
                    background: transparent;
                    color: #64748b;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }

                .row-actions__btn:hover {
                    background: #f1f5f9;
                    color: #1e293b;
                }

                .row-actions__btn--success:hover {
                    background: #10b981;
                    color: white;
                }

                .row-actions__btn--danger:hover {
                    background: #ef4444;
                    color: white;
                }

                .row-actions__btn--warning:hover {
                    background: #f59e0b;
                    color: white;
                }

                .row-actions__btn--info:hover {
                    background: #3b82f6;
                    color: white;
                }

                .row-actions__menu {
                    position: absolute;
                    right: 0;
                    top: 100%;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
                    border: 1px solid #e2e8f0;
                    z-index: 10;
                    min-width: 160px;
                }

                .row-actions__menu-item {
                    width: 100%;
                    padding: 0.75rem 1rem;
                    border: none;
                    background: transparent;
                    text-align: left;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: #1e293b;
                }

                .row-actions__menu-item:hover {
                    background: #f1f5f9;
                }

                /* Grid View */
                .companies-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 1.5rem;
                }

                .company-card {
                    background: white;
                    border-radius: 16px;
                    padding: 1.5rem;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
                    transition: all 0.3s;
                }

                .company-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
                }

                .company-card__header {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .company-card__title {
                    flex: 1;
                }

                .company-card__title h3 {
                    margin: 0 0 0.25rem 0;
                    color: #1e293b;
                }

                .company-card__status {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .company-card__stats {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1rem;
                    margin-bottom: 1rem;
                    padding: 1rem 0;
                    border-top: 1px solid #e2e8f0;
                    border-bottom: 1px solid #e2e8f0;
                }

                .company-card__stat {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: #64748b;
                    font-size: 0.9rem;
                }

                .company-card__footer {
                    display: flex;
                    gap: 0.5rem;
                }

                /* Buttons */
                .btn {
                    padding: 0.75rem 1.25rem;
                    border-radius: 12px;
                    font-size: 0.95rem;
                    font-weight: 500;
                    cursor: pointer;
                    border: none;
                    transition: all 0.2s;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .btn-primary {
                    background: #3b82f6;
                    color: white;
                }

                .btn-primary:hover {
                    background: #2563eb;
                }

                .btn-secondary {
                    background: #64748b;
                    color: white;
                }

                .btn-secondary:hover {
                    background: #475569;
                }

                .btn-success {
                    background: #10b981;
                    color: white;
                }

                .btn-success:hover {
                    background: #059669;
                }

                .btn-danger {
                    background: #ef4444;
                    color: white;
                }

                .btn-danger:hover {
                    background: #dc2626;
                }

                .btn-warning {
                    background: #f59e0b;
                    color: white;
                }

                .btn-warning:hover {
                    background: #d97706;
                }

                .btn-outline {
                    background: white;
                    border: 1px solid #e2e8f0;
                    color: #1e293b;
                }

                .btn-outline:hover {
                    background: #f1f5f9;
                    border-color: #cbd5e1;
                }

                .btn-sm {
                    padding: 0.5rem 1rem;
                    font-size: 0.85rem;
                }

                /* Pagination */
                .pagination {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 1rem;
                    margin-top: 2rem;
                }

                .pagination__btn {
                    padding: 0.5rem 1rem;
                    border: 1px solid #e2e8f0;
                    background: white;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                }

                .pagination__btn:hover:not(:disabled) {
                    background: #f1f5f9;
                    border-color: #cbd5e1;
                }

                .pagination__btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .pagination__pages {
                    display: flex;
                    gap: 0.5rem;
                }

                .pagination__page {
                    width: 36px;
                    height: 36px;
                    border: 1px solid #e2e8f0;
                    background: white;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .pagination__page:hover {
                    background: #f1f5f9;
                }

                .pagination__page.active {
                    background: #3b82f6;
                    border-color: #3b82f6;
                    color: white;
                }

                .pagination__info {
                    color: #64748b;
                    font-size: 0.9rem;
                }

                /* Empty State */
                .empty-state {
                    text-align: center;
                    padding: 4rem 2rem;
                }

                .empty-state__icon {
                    color: #cbd5e1;
                    margin-bottom: 1rem;
                }

                .empty-state__title {
                    color: #1e293b;
                    margin-bottom: 0.5rem;
                }

                .empty-state__text {
                    color: #64748b;
                }

                /* Modal */
                .company-modal__overlay {
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
                    animation: fadeIn 0.2s;
                }

                .company-modal {
                    background: white;
                    border-radius: 16px;
                    max-height: 90vh;
                    overflow-y: auto;
                    animation: slideUp 0.3s;
                }

                .company-modal--medium {
                    max-width: 600px;
                    width: 90%;
                }

                .company-modal--large {
                    max-width: 900px;
                    width: 95%;
                }

                .company-modal__header {
                    padding: 1.5rem;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    position: sticky;
                    top: 0;
                    background: white;
                    z-index: 1;
                }

                .company-modal__title {
                    margin: 0;
                    color: #1e293b;
                }

                .company-modal__close {
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: #94a3b8;
                }

                .company-modal__close:hover {
                    color: #1e293b;
                }

                .company-modal__body {
                    padding: 1.5rem;
                }

                /* Company Details */
                .company-details__header {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .company-details__title h2 {
                    margin: 0 0 0.5rem 0;
                    color: #1e293b;
                }

                .company-details__badges {
                    display: flex;
                    gap: 0.5rem;
                }

                .company-details__grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 1.5rem;
                }

                .company-details__section {
                    background: #f8fafc;
                    border-radius: 12px;
                    padding: 1.5rem;
                }

                .company-details__section.full-width {
                    grid-column: 1 / -1;
                }

                .company-details__section h3 {
                    margin: 0 0 1rem 0;
                    color: #334155;
                    font-size: 1.1rem;
                }

                .company-details__items {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .company-details__item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    color: #475569;
                }

                .company-details__item svg {
                    color: #3b82f6;
                }

                .company-details__item a {
                    color: #3b82f6;
                    text-decoration: none;
                }

                .company-details__item a:hover {
                    text-decoration: underline;
                }

                .company-details__description {
                    color: #475569;
                    line-height: 1.6;
                }

                /* Timeline */
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

                .timeline__item {
                    position: relative;
                    padding-bottom: 1.5rem;
                }

                .timeline__dot {
                    position: absolute;
                    left: -2rem;
                    top: 0.25rem;
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    border: 2px solid white;
                }

                .timeline__content {
                    background: white;
                    padding: 1rem;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                }

                .timeline__header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }

                .timeline__title {
                    font-weight: 600;
                    color: #1e293b;
                }

                .timeline__date {
                    font-size: 0.85rem;
                    color: #64748b;
                }

                .timeline__description {
                    margin: 0;
                    color: #64748b;
                    font-size: 0.95rem;
                }

                /* Edit Form */
                .edit-form__grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1rem;
                }

                .edit-form__field {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .edit-form__field.full-width {
                    grid-column: 1 / -1;
                }

                .edit-form__field label {
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: #64748b;
                }

                .edit-form__input,
                .edit-form__textarea,
                .create-form__input,
                .create-form__textarea {
                    padding: 0.75rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 0.95rem;
                    transition: all 0.2s;
                }

                .edit-form__input:focus,
                .edit-form__textarea:focus,
                .create-form__input:focus,
                .create-form__textarea:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
                }

                .edit-form__textarea,
                .create-form__textarea {
                    resize: vertical;
                    min-height: 100px;
                }

                /* Create Form */
                .create-form__grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .create-form__field {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .create-form__field.full-width {
                    grid-column: 1 / -1;
                }

                .create-form__field label {
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: #64748b;
                }

                /* Modal Actions */
                .company-modal__actions {
                    display: flex;
                    gap: 1rem;
                    justify-content: flex-end;
                    margin-top: 1.5rem;
                    padding-top: 1.5rem;
                    border-top: 1px solid #e2e8f0;
                }

                /* Animations */
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                /* Responsive */
                @media (max-width: 1024px) {
                    .company-details__grid {
                        grid-template-columns: 1fr;
                    }

                    .edit-form__grid,
                    .create-form__grid {
                        grid-template-columns: 1fr;
                    }
                }

                @media (max-width: 768px) {
                    .company-management {
                        padding: 1rem;
                    }

                    .page-header {
                        flex-direction: column;
                        gap: 1rem;
                    }

                    .page-header__right {
                        width: 100%;
                        justify-content: flex-start;
                    }

                    .stats-grid {
                        grid-template-columns: 1fr;
                    }

                    .filters-bar {
                        flex-direction: column;
                    }

                    .search-box {
                        min-width: 100%;
                    }

                    .filters-group {
                        width: 100%;
                    }

                    .filter-select {
                        flex: 1;
                    }

                    .advanced-filters__row {
                        flex-direction: column;
                    }

                    .advanced-filters__dates {
                        flex-direction: column;
                    }

                    .bulk-actions {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .bulk-actions__buttons {
                        width: 100%;
                        flex-wrap: wrap;
                    }

                    .pagination {
                        flex-wrap: wrap;
                    }

                    .company-details__header {
                        flex-direction: column;
                        text-align: center;
                    }

                    .company-details__badges {
                        justify-content: center;
                    }

                    .company-modal__actions {
                        flex-direction: column;
                    }

                    .company-modal__actions button {
                        width: 100%;
                    }
                }

                @media (max-width: 480px) {
                    .companies-grid {
                        grid-template-columns: 1fr;
                    }

                    .filter-chip {
                        font-size: 0.8rem;
                        padding: 0.4rem 0.8rem;
                    }

                    .table-container {
                        overflow-x: auto;
                    }

                    .data-table {
                        min-width: 800px;
                    }
                }
            `}</style>
        </div>
    );
};

export default CompanyManagement;
