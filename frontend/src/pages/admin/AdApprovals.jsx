import React, { useEffect, useState, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import Loading from '../../components/common/Loading';
import {
    adminApproveAd,
    adminListAds,
    adminRejectAd,
    adminBulkApproveAds,
    adminBulkRejectAds,
    adminPauseAd,
    adminResumeAd,
    adminGetAdDetails,
    adminGetAdAnalytics,
    adminListAdFailures
} from '../../services/adService';
import './AdApprovals.css';

// Modern, simplified components
const StatCard = ({ label, value, trend, color = 'blue' }) => (
    <div className={`stat-card stat-${color}`}>
        <div className="stat-card__content">
            <span className="stat-card__label">{label}</span>
            <span className="stat-card__value">{value}</span>
            {trend && <span className="stat-card__trend">{trend}</span>}
        </div>
    </div>
);

const Badge = ({ children, variant = 'default' }) => (
    <span className={`badge badge-${variant}`}>{children}</span>
);

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal__header">
                    <h2>{title}</h2>
                    <button className="modal__close" onClick={onClose}>×</button>
                </div>
                <div className="modal__body">{children}</div>
            </div>
        </div>
    );
};

const AdApprovals = () => {
    const [ads, setAds] = useState([]);
    const [filteredAds, setFilteredAds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedOverride, setSelectedOverride] = useState({});
    const [selectedAds, setSelectedAds] = useState([]);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        reviewStatus: 'pending',
        status: '',
        tier: '',
        business: '',
        dateRange: 'all',
        minImpressions: '',
        maxImpressions: '',
        minClicks: '',
        maxClicks: '',
        minSpend: '',
        maxSpend: ''
    });
    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
    const [selectedAd, setSelectedAd] = useState(null);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [failureLog, setFailureLog] = useState([]);
    const [failureLoading, setFailureLoading] = useState(false);

    const getAdId = (ad) => ad?.id || ad?.campaign_id || ad?.campaignId;
    const normalizeReviewStatus = (status) => {
        const raw = String(status || '').toLowerCase();
        if (!raw) return 'pending';
        if (raw === 'pending_review') return 'pending';
        return raw;
    };
    const normalizeStatus = (status) => String(status || '').toLowerCase() || 'pending';

    const parseFailureDetails = (details) => {
        if (!details) return {};
        if (typeof details === 'string') {
            try {
                return JSON.parse(details);
            } catch {
                return { raw: details };
            }
        }
        return details;
    };

    // Fetch ads with current filters
    const fetchAds = useCallback(async () => {
        setLoading(true);
        try {
            const params = {
                reviewStatus: filters.reviewStatus || undefined,
                status: filters.status || undefined,
                tier: filters.tier || undefined,
                search: filters.business || undefined,
                startDate: dateRange.start || undefined,
                endDate: dateRange.end || undefined
            };

            // Remove undefined values
            Object.keys(params).forEach(key =>
                params[key] === undefined && delete params[key]
            );

            const { data } = await adminListAds(params);
            const adsData = data?.campaigns || data?.ads || [];
            const normalized = adsData.map((ad) => ({
                ...ad,
                id: getAdId(ad),
                review_status: normalizeReviewStatus(ad.review_status),
                status: normalizeStatus(ad.status)
            }));
            setAds(normalized);
            applyLocalFilters(normalized);
        } catch (error) {
            toast.error('Failed to load ads');
        } finally {
            setLoading(false);
        }
    }, [filters, dateRange]);

    // Fetch failure log
    const fetchFailureLog = useCallback(async () => {
        setFailureLoading(true);
        try {
            const { data } = await adminListAdFailures({ limit: 50 });
            setFailureLog(data?.data || data?.failures || []);
        } catch (error) {
            toast.error('Failed to load ad failure log');
        } finally {
            setFailureLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAds();
        fetchFailureLog();
    }, [fetchAds, fetchFailureLog]);

    // Apply local filters
    const applyLocalFilters = (adsData) => {
        let filtered = [...adsData];

        // Apply numeric filters
        if (filters.minImpressions) {
            filtered = filtered.filter(ad => ad.impressions >= parseInt(filters.minImpressions));
        }
        if (filters.maxImpressions) {
            filtered = filtered.filter(ad => ad.impressions <= parseInt(filters.maxImpressions));
        }
        if (filters.minClicks) {
            filtered = filtered.filter(ad => ad.clicks >= parseInt(filters.minClicks));
        }
        if (filters.maxClicks) {
            filtered = filtered.filter(ad => ad.clicks <= parseInt(filters.maxClicks));
        }
        if (filters.minSpend) {
            filtered = filtered.filter(ad => (ad.spend_minor || 0) / 100 >= parseFloat(filters.minSpend));
        }
        if (filters.maxSpend) {
            filtered = filtered.filter(ad => (ad.spend_minor || 0) / 100 <= parseFloat(filters.maxSpend));
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];

            // Handle nested properties
            if (sortConfig.key === 'spend') {
                aVal = (a.spend_minor || 0) / 100;
                bVal = (b.spend_minor || 0) / 100;
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        setFilteredAds(filtered);
    };

    // Calculate stats
    const stats = useMemo(() => ({
        total: ads.length,
        pending: ads.filter(a => normalizeReviewStatus(a.review_status) === 'pending').length,
        approved: ads.filter(a => normalizeReviewStatus(a.review_status) === 'approved').length,
        rejected: ads.filter(a => normalizeReviewStatus(a.review_status) === 'rejected').length,
        totalImpressions: ads.reduce((sum, a) => sum + (a.impressions || 0), 0),
        totalClicks: ads.reduce((sum, a) => sum + (a.clicks || 0), 0),
        totalSpend: ads.reduce((sum, a) => sum + ((a.spend_minor || 0) / 100), 0)
    }), [ads]);

    // Handle filter changes
    const handleFilterChange = (field) => (e) => {
        const value = e.target.value;
        setFilters(prev => {
            const newFilters = { ...prev, [field]: value };
            // Apply filters after state update
            setTimeout(() => applyLocalFilters(ads), 0);
            return newFilters;
        });
    };

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
        setTimeout(() => applyLocalFilters(ads), 0);
    };

    const applyFilters = (e) => {
        e?.preventDefault();
        fetchAds();
    };

    const resetFilters = () => {
        setFilters({
            reviewStatus: 'pending',
            status: '',
            tier: '',
            business: '',
            dateRange: 'all',
            minImpressions: '',
            maxImpressions: '',
            minClicks: '',
            maxClicks: '',
            minSpend: '',
            maxSpend: ''
        });
        setDateRange({ start: '', end: '' });
        setSortConfig({ key: 'created_at', direction: 'desc' });
        fetchAds();
    };

    // Handle ad actions
    const handleApprove = async (adId) => {
        try {
            await adminApproveAd({
                adId,
                overrideRestrictions: Boolean(selectedOverride[adId])
            });
            toast.success('Ad approved');
            setSelectedOverride(prev => {
                const newState = { ...prev };
                delete newState[adId];
                return newState;
            });
            fetchAds();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to approve ad');
        }
    };

    const handleReject = async (adId) => {
        const reason = window.prompt('Please provide a reason for rejection:');
        if (!reason) return;

        try {
            await adminRejectAd({ adId, reason, notes: reason });
            toast.success('Ad rejected');
            fetchAds();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to reject ad');
        }
    };

    const handleBulkApprove = async () => {
        if (selectedAds.length === 0) {
            toast.error('Please select at least one ad');
            return;
        }

        if (!window.confirm(`Approve ${selectedAds.length} selected ad(s)?`)) return;

        try {
            await adminBulkApproveAds({
                adIds: selectedAds,
                overrideRestrictions: true
            });
            toast.success(`${selectedAds.length} ad(s) approved`);
            setSelectedAds([]);
            fetchAds();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to bulk approve ads');
        }
    };

    const handleBulkReject = async () => {
        if (selectedAds.length === 0) {
            toast.error('Please select at least one ad');
            return;
        }

        const reason = window.prompt(`Provide a reason for rejecting ${selectedAds.length} ad(s):`);
        if (!reason) return;

        try {
            await adminBulkRejectAds({ adIds: selectedAds, reason });
            toast.success(`${selectedAds.length} ad(s) rejected`);
            setSelectedAds([]);
            fetchAds();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to bulk reject ads');
        }
    };

    const handlePauseAd = async (adId) => {
        try {
            await adminPauseAd(adId);
            toast.success('Ad paused');
            fetchAds();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to pause ad');
        }
    };

    const handleResumeAd = async (adId) => {
        try {
            await adminResumeAd(adId);
            toast.success('Ad resumed');
            fetchAds();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to resume ad');
        }
    };

    const handleViewDetails = async (ad) => {
        try {
            setLoading(true);
            const id = getAdId(ad);
            const [detailsResponse, analyticsResponse] = await Promise.all([
                adminGetAdDetails(id),
                adminGetAdAnalytics(id)
            ]);

            const campaignDetails =
                detailsResponse?.data?.campaign ||
                detailsResponse?.data?.data ||
                detailsResponse?.data ||
                null;

            const analyticsData =
                analyticsResponse?.data?.data ||
                analyticsResponse?.data ||
                null;

            if (campaignDetails) {
                setSelectedAd({ ...campaignDetails, analytics: analyticsData });
            } else {
                toast.error('Could not load campaign details');
            }
        } catch (error) {
            toast.error('Failed to load ad details');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAll = () => {
        if (selectedAds.length === filteredAds.length) {
            setSelectedAds([]);
        } else {
            setSelectedAds(filteredAds.map(ad => getAdId(ad)));
        }
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return '↕️';
        return sortConfig.direction === 'asc' ? '↑' : '↓';
    };

    return (
        <div className="ad-approvals">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1>Ad Approvals</h1>
                    <p className="text-secondary">Manage and review advertisement submissions</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <StatCard label="Total Ads" value={stats.total} color="blue" />
                <StatCard label="Pending" value={stats.pending} color="yellow" />
                <StatCard label="Approved" value={stats.approved} color="green" />
                <StatCard label="Rejected" value={stats.rejected} color="red" />
                <StatCard
                    label="Impressions"
                    value={stats.totalImpressions.toLocaleString()}
                    color="purple"
                />
                <StatCard
                    label="Clicks"
                    value={stats.totalClicks.toLocaleString()}
                    color="indigo"
                />
                <StatCard
                    label="Total Spend"
                    value={`$${stats.totalSpend.toFixed(2)}`}
                    color="pink"
                />
            </div>

            {/* Filter Toggle */}
            <button
                className="btn btn-outline filter-toggle"
                onClick={() => setShowFilters(!showFilters)}
            >
                {showFilters ? 'Hide Filters' : 'Show Filters'} 🔍
            </button>

            {/* Advanced Filters */}
            {showFilters && (
                <form className="advanced-filters" onSubmit={applyFilters}>
                    <div className="filters-grid">
                        <select
                            value={filters.reviewStatus}
                            onChange={handleFilterChange('reviewStatus')}
                            className="filter-select"
                        >
                            <option value="pending">Pending review</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="">All review statuses</option>
                        </select>

                        <select
                            value={filters.status}
                            onChange={handleFilterChange('status')}
                            className="filter-select"
                        >
                            <option value="">Any campaign status</option>
                            <option value="pending_review">Pending review</option>
                            <option value="active">Active</option>
                            <option value="paused">Paused</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>

                        <select
                            value={filters.tier}
                            onChange={handleFilterChange('tier')}
                            className="filter-select"
                        >
                            <option value="">All tiers</option>
                            <option value="base">Base</option>
                            <option value="enhanced">Enhanced</option>
                            <option value="premium">Premium</option>
                        </select>

                        <input
                            type="text"
                            placeholder="Search business name"
                            value={filters.business}
                            onChange={handleFilterChange('business')}
                            className="filter-input"
                        />

                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            className="filter-input"
                            placeholder="Start date"
                        />

                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            className="filter-input"
                            placeholder="End date"
                        />
                    </div>

                    <div className="filters-grid">
                        <div className="range-filter">
                            <label>Impressions:</label>
                            <input
                                type="number"
                                placeholder="Min"
                                value={filters.minImpressions}
                                onChange={handleFilterChange('minImpressions')}
                                className="filter-input small"
                            />
                            <span>to</span>
                            <input
                                type="number"
                                placeholder="Max"
                                value={filters.maxImpressions}
                                onChange={handleFilterChange('maxImpressions')}
                                className="filter-input small"
                            />
                        </div>

                        <div className="range-filter">
                            <label>Clicks:</label>
                            <input
                                type="number"
                                placeholder="Min"
                                value={filters.minClicks}
                                onChange={handleFilterChange('minClicks')}
                                className="filter-input small"
                            />
                            <span>to</span>
                            <input
                                type="number"
                                placeholder="Max"
                                value={filters.maxClicks}
                                onChange={handleFilterChange('maxClicks')}
                                className="filter-input small"
                            />
                        </div>

                        <div className="range-filter">
                            <label>Spend ($):</label>
                            <input
                                type="number"
                                placeholder="Min"
                                value={filters.minSpend}
                                onChange={handleFilterChange('minSpend')}
                                className="filter-input small"
                                step="0.01"
                            />
                            <span>to</span>
                            <input
                                type="number"
                                placeholder="Max"
                                value={filters.maxSpend}
                                onChange={handleFilterChange('maxSpend')}
                                className="filter-input small"
                                step="0.01"
                            />
                        </div>
                    </div>

                    <div className="filter-actions">
                        <button type="submit" className="btn btn-primary">
                            Apply Filters
                        </button>
                        <button type="button" className="btn btn-outline" onClick={resetFilters}>
                            Reset
                        </button>
                    </div>
                </form>
            )}

            {/* Bulk Actions */}
            {selectedAds.length > 0 && (
                <div className="bulk-actions">
          <span className="bulk-actions__info">
            {selectedAds.length} ad(s) selected
          </span>
                    <div className="bulk-actions__buttons">
                        <button
                            className="btn btn-success btn-sm"
                            onClick={handleBulkApprove}
                        >
                            Approve Selected
                        </button>
                        <button
                            className="btn btn-danger btn-sm"
                            onClick={handleBulkReject}
                        >
                            Reject Selected
                        </button>
                        <button
                            className="btn btn-outline btn-sm"
                            onClick={() => setSelectedAds([])}
                        >
                            Clear
                        </button>
                    </div>
                </div>
            )}

            {/* Ads Table */}
            <div className="table-container">
                <table className="table">
                    <thead>
                    <tr>
                        <th width="40">
                            <input
                                type="checkbox"
                                checked={selectedAds.length === filteredAds.length && filteredAds.length > 0}
                                onChange={handleSelectAll}
                            />
                        </th>
                        <th onClick={() => handleSort('business_name')} className="sortable">
                            Business {getSortIcon('business_name')}
                        </th>
                        <th onClick={() => handleSort('subscription_tier')} className="sortable">
                            Tier {getSortIcon('subscription_tier')}
                        </th>
                        <th onClick={() => handleSort('status')} className="sortable">
                            Status {getSortIcon('status')}
                        </th>
                        <th onClick={() => handleSort('review_status')} className="sortable">
                            Review {getSortIcon('review_status')}
                        </th>
                        <th onClick={() => handleSort('impressions')} className="sortable">
                            Performance {getSortIcon('impressions')}
                        </th>
                        <th onClick={() => handleSort('spend')} className="sortable">
                            Spend {getSortIcon('spend')}
                        </th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {loading ? (
                        <tr>
                            <td colSpan="8" className="text-center py-8">
                                <Loading size="small" />
                            </td>
                        </tr>
                    ) : filteredAds.length === 0 ? (
                        <tr>
                            <td colSpan="8" className="text-center py-8 text-secondary">
                                No advertisements found matching your criteria
                            </td>
                        </tr>
                    ) : (
                        filteredAds.map(ad => (
                            <tr key={getAdId(ad)} className={selectedAds.includes(getAdId(ad)) ? 'row-selected' : ''}>
                                <td>
                                    <input
                                        type="checkbox"
                                        checked={selectedAds.includes(getAdId(ad))}
                                        onChange={(e) => {
                                            setSelectedAds(prev =>
                                                e.target.checked
                                                    ? [...prev, getAdId(ad)]
                                                    : prev.filter(id => id !== getAdId(ad))
                                            );
                                        }}
                                    />
                                </td>
                                <td>
                                    <div className="business-info">
                                        <span className="business-name">{ad.business_name}</span>
                                        <span className="ad-name">{ad.name}</span>
                                        <span className="text-xs text-secondary">{ad.owner_email || 'No owner email'}</span>
                                        <span className="text-xs text-secondary">
                        Created: {new Date(ad.created_at).toLocaleDateString()}
                      </span>
                                    </div>
                                </td>
                                <td>
                                    <Badge variant={ad.subscription_tier || 'base'}>
                                        {ad.subscription_tier || 'base'}
                                    </Badge>
                                </td>
                                <td>
                                    <Badge variant={ad.status}>
                                        {ad.status?.replace('_', ' ') || 'unknown'}
                                    </Badge>
                                </td>
                                <td>
                                    <div className="review-info">
                                        <Badge variant={normalizeReviewStatus(ad.review_status)}>
                                            {normalizeReviewStatus(ad.review_status)}
                                        </Badge>
                                        {normalizeReviewStatus(ad.review_status) === 'pending' && (
                                            <label className="override-toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(selectedOverride[getAdId(ad)])}
                                                    onChange={(e) =>
                                                        setSelectedOverride(prev => ({
                                                            ...prev,
                                                            [getAdId(ad)]: e.target.checked
                                                        }))
                                                    }
                                                />
                                                <span className="text-xs">Override limits</span>
                                            </label>
                                        )}
                                    </div>
                                </td>
                                <td>
                                    <div className="performance-stats">
                                        <span>👁️ {ad.impressions?.toLocaleString() || 0}</span>
                                        <span>🖱️ {ad.clicks?.toLocaleString() || 0}</span>
                                        <span>📊 {ad.impressions ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : 0}% CTR</span>
                                    </div>
                                </td>
                                <td>
                                    <div className="spend-info">
                      <span className="spend-amount">
                        ${((ad.spend_minor || 0) / 100).toFixed(2)}
                      </span>
                                        {ad.budget && (
                                            <span className="budget-info">
                          of ${(ad.budget / 100).toFixed(2)}
                        </span>
                                        )}
                                    </div>
                                </td>
                                <td>
                                    <div className="action-buttons">
                                        <button
                                            className="btn btn-icon"
                                            onClick={() => handleViewDetails(ad)}
                                            title="View details"
                                        >
                                            📋
                                        </button>

                                        {normalizeReviewStatus(ad.review_status) === 'pending' && (
                                            <>
                                                <button
                                                    className="btn btn-icon btn-success"
                                                    onClick={() => handleApprove(getAdId(ad))}
                                                    title="Approve"
                                                    disabled={loading}
                                                >
                                                    ✓
                                                </button>
                                                <button
                                                    className="btn btn-icon btn-danger"
                                                    onClick={() => handleReject(getAdId(ad))}
                                                    title="Reject"
                                                    disabled={loading}
                                                >
                                                    ✗
                                                </button>
                                            </>
                                        )}

                                        {normalizeStatus(ad.status) === 'active' && (
                                            <button
                                                className="btn btn-icon btn-warning"
                                                onClick={() => handlePauseAd(getAdId(ad))}
                                                title="Pause"
                                                disabled={loading}
                                            >
                                                ⏸️
                                            </button>
                                        )}

                                        {normalizeStatus(ad.status) === 'paused' && (
                                            <button
                                                className="btn btn-icon btn-success"
                                                onClick={() => handleResumeAd(getAdId(ad))}
                                                title="Resume"
                                                disabled={loading}
                                            >
                                                ▶️
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                    </tbody>
                </table>
            </div>

            {/* Failure Log */}
            <div className="failure-log">
                <div className="failure-log__header">
                    <h3>Recent Submission Failures</h3>
                    <button
                        className="btn btn-outline btn-sm"
                        onClick={fetchFailureLog}
                        disabled={failureLoading}
                    >
                        {failureLoading ? 'Refreshing…' : 'Refresh'}
                    </button>
                </div>

                {failureLoading ? (
                    <div className="failure-loading">
                        <Loading size="small" />
                    </div>
                ) : failureLog.length === 0 ? (
                    <p className="failure-empty">No recent failures recorded.</p>
                ) : (
                    <div className="failure-log__list">
                        {failureLog.map((failure) => {
                            const details = parseFailureDetails(failure.details);
                            return (
                                <div key={failure.id || failure.created_at} className="failure-log__item">
                                    <div className="failure-log__title">
                                        <div>
                                            <strong>{failure.business_name || 'Unlinked business'}</strong>
                                            {failure.user_email && (
                                                <span className="failure-meta">Submitted by {failure.user_email}</span>
                                            )}
                                        </div>
                                        <span className="text-xs text-secondary">
                      {new Date(failure.created_at).toLocaleString()}
                    </span>
                                    </div>
                                    <p className="failure-log__error">{failure.error_message}</p>
                                    <div className="failure-meta-details">
                                        {details.code && <span>Code: {details.code}</span>}
                                        {Array.isArray(details.placements) && details.placements.length > 0 && (
                                            <span>Placements: {details.placements.join(', ')}</span>
                                        )}
                                        {details.stage && <span>Stage: {details.stage}</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Details Modal */}
            <Modal
                isOpen={!!selectedAd}
                onClose={() => setSelectedAd(null)}
                title={`Ad Details: ${selectedAd?.name}`}
            >
                {selectedAd && (
                    <div className="details-content">
                        <div className="details-grid">
                            <div className="detail-item">
                                <label>Business</label>
                                <span>{selectedAd.business_name}</span>
                            </div>
                            <div className="detail-item">
                                <label>Owner</label>
                                <span>{selectedAd.owner_email}</span>
                            </div>
                            <div className="detail-item">
                                <label>Tier</label>
                                <Badge variant={selectedAd.subscription_tier}>
                                    {selectedAd.subscription_tier}
                                </Badge>
                            </div>
                            <div className="detail-item">
                                <label>Status</label>
                                <Badge variant={selectedAd.status}>
                                    {selectedAd.status}
                                </Badge>
                            </div>
                            <div className="detail-item">
                                <label>Review Status</label>
                                <Badge variant={selectedAd.review_status}>
                                    {selectedAd.review_status}
                                </Badge>
                            </div>
                            <div className="detail-item">
                                <label>Created</label>
                                <span>{new Date(selectedAd.created_at).toLocaleString()}</span>
                            </div>
                        </div>

                        {selectedAd.content && (
                            <div className="content-preview">
                                <h4>Ad Content</h4>
                                {selectedAd.content.image && (
                                    <img src={selectedAd.content.image} alt="Ad preview" className="content-image" />
                                )}
                                <div className="content-text">
                                    <p><strong>Headline:</strong> {selectedAd.content.headline}</p>
                                    <p><strong>Description:</strong> {selectedAd.content.description}</p>
                                    {selectedAd.content.cta && (
                                        <p><strong>CTA:</strong> {selectedAd.content.cta}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {selectedAd.analytics && (
                            <div className="analytics-preview">
                                <h4>Performance Analytics</h4>
                                <div className="analytics-grid">
                                    <div className="analytics-item">
                                        <label>Total Impressions</label>
                                        <span>{selectedAd.analytics.totalImpressions?.toLocaleString()}</span>
                                    </div>
                                    <div className="analytics-item">
                                        <label>Total Clicks</label>
                                        <span>{selectedAd.analytics.totalClicks?.toLocaleString()}</span>
                                    </div>
                                    <div className="analytics-item">
                                        <label>CTR</label>
                                        <span>{selectedAd.analytics.ctr?.toFixed(2)}%</span>
                                    </div>
                                    <div className="analytics-item">
                                        <label>Total Spend</label>
                                        <span>${selectedAd.analytics.totalSpend?.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {selectedAd.rejection_reason && (
                            <div className="rejection-reason">
                                <h4>Rejection Reason</h4>
                                <p>{selectedAd.rejection_reason}</p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default AdApprovals;
