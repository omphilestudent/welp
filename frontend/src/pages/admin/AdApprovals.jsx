import React, { useEffect, useState } from 'react';
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
    adminGetAdAnalytics
} from '../../services/adService';
import './AdApprovals.css'; // Create this CSS file

const defaultFilters = {
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
};

const AdApprovals = () => {
    const [filters, setFilters] = useState(defaultFilters);
    const [ads, setAds] = useState([]);
    const [filteredAds, setFilteredAds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedOverride, setSelectedOverride] = useState({});
    const [selectedAds, setSelectedAds] = useState([]);
    const [showFilters, setShowFilters] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
    const [stats, setStats] = useState({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalSpend: 0
    });
    const [selectedAdDetails, setSelectedAdDetails] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [dateRange, setDateRange] = useState({
        start: '',
        end: ''
    });

    const fetchAds = async () => {
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
            setAds(adsData);
            applyLocalFilters(adsData);
            calculateStats(adsData);
        } catch (error) {
            console.error('Failed to fetch ads', error);
            toast.error('Unable to load advertisements');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAds();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Calculate statistics
    const calculateStats = (adsData) => {
        const stats = {
            total: adsData.length,
            pending: adsData.filter(ad => ad.review_status === 'pending').length,
            approved: adsData.filter(ad => ad.review_status === 'approved').length,
            rejected: adsData.filter(ad => ad.review_status === 'rejected').length,
            totalImpressions: adsData.reduce((sum, ad) => sum + (ad.impressions || 0), 0),
            totalClicks: adsData.reduce((sum, ad) => sum + (ad.clicks || 0), 0),
            totalSpend: adsData.reduce((sum, ad) => sum + ((ad.spend_minor || 0) / 100), 0)
        };
        setStats(stats);
    };

    const handleFilterChange = (field) => (event) => {
        const value = event.target.value;
        setFilters((prev) => {
            const newFilters = { ...prev, [field]: value };
            // Apply filters after state update
            setTimeout(() => applyLocalFilters(ads), 0);
            return newFilters;
        });
    };

    const applyFilters = (event) => {
        event?.preventDefault();
        fetchAds();
    };

    const resetFilters = () => {
        setFilters(defaultFilters);
        setDateRange({ start: '', end: '' });
        setSortConfig({ key: 'created_at', direction: 'desc' });
        fetchAds();
    };

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
        setTimeout(() => applyLocalFilters(ads), 0);
    };

    const handleApprove = async (adId) => {
        try {
            await adminApproveAd({
                adId,
                overrideRestrictions: Boolean(selectedOverride[adId])
            });
            toast.success('Ad approved successfully');
            await fetchAds();
            // Clear override for this ad
            setSelectedOverride(prev => {
                const newState = { ...prev };
                delete newState[adId];
                return newState;
            });
        } catch (error) {
            console.error('Approve failed', error);
            toast.error(error.response?.data?.error || 'Unable to approve ad');
        }
    };

    const handleReject = async (adId) => {
        const reason = window.prompt('Please provide a reason for rejection:');
        if (!reason) return;

        try {
            await adminRejectAd({
                adId,
                reason,
                notes: reason
            });
            toast.success('Ad rejected successfully');
            await fetchAds();
        } catch (error) {
            console.error('Reject failed', error);
            toast.error(error.response?.data?.error || 'Unable to reject ad');
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
            toast.success(`${selectedAds.length} ad(s) approved successfully`);
            setSelectedAds([]);
            await fetchAds();
        } catch (error) {
            console.error('Bulk approve failed', error);
            toast.error(error.response?.data?.error || 'Unable to bulk approve ads');
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
            await adminBulkRejectAds({
                adIds: selectedAds,
                reason
            });
            toast.success(`${selectedAds.length} ad(s) rejected successfully`);
            setSelectedAds([]);
            await fetchAds();
        } catch (error) {
            console.error('Bulk reject failed', error);
            toast.error(error.response?.data?.error || 'Unable to bulk reject ads');
        }
    };

    const handlePauseAd = async (adId) => {
        try {
            await adminPauseAd(adId);
            toast.success('Ad paused successfully');
            await fetchAds();
        } catch (error) {
            console.error('Pause failed', error);
            toast.error(error.response?.data?.error || 'Unable to pause ad');
        }
    };

    const handleResumeAd = async (adId) => {
        try {
            await adminResumeAd(adId);
            toast.success('Ad resumed successfully');
            await fetchAds();
        } catch (error) {
            console.error('Resume failed', error);
            toast.error(error.response?.data?.error || 'Unable to resume ad');
        }
    };

    const handleViewDetails = async (adId) => {
        try {
            setLoading(true);
            const [detailsResponse, analyticsResponse] = await Promise.all([
                adminGetAdDetails(adId),
                adminGetAdAnalytics(adId)
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
                setSelectedAdDetails({ ...campaignDetails, analytics: analyticsData });
                setShowDetailsModal(true);
            } else {
                toast.error('Could not load campaign details');
            }
        } catch (error) {
            console.error('Failed to fetch ad details', error);
            toast.error('Unable to load ad details');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAll = () => {
        if (selectedAds.length === filteredAds.length) {
            setSelectedAds([]);
        } else {
            setSelectedAds(filteredAds.map(ad => ad.id));
        }
    };

    const handleSelectAd = (adId) => {
        setSelectedAds(prev =>
            prev.includes(adId)
                ? prev.filter(id => id !== adId)
                : [...prev, adId]
        );
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return '↕️';
        return sortConfig.direction === 'asc' ? '↑' : '↓';
    };

    if (loading && !ads.length) {
        return <Loading />;
    }

    return (
        <section className="admin-panel ad-approvals">
            <header className="admin-panel__header">
                <div>
                    <p className="admin-panel__eyebrow">Advertising Management</p>
                    <h1>Ad Approvals & Analytics</h1>
                </div>

                {/* Stats Cards */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <span className="stat-label">Total Ads</span>
                        <span className="stat-value">{stats.total}</span>
                    </div>
                    <div className="stat-card pending">
                        <span className="stat-label">Pending</span>
                        <span className="stat-value">{stats.pending}</span>
                    </div>
                    <div className="stat-card approved">
                        <span className="stat-label">Approved</span>
                        <span className="stat-value">{stats.approved}</span>
                    </div>
                    <div className="stat-card rejected">
                        <span className="stat-label">Rejected</span>
                        <span className="stat-value">{stats.rejected}</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Total Impressions</span>
                        <span className="stat-value">{stats.totalImpressions.toLocaleString()}</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Total Clicks</span>
                        <span className="stat-value">{stats.totalClicks.toLocaleString()}</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Total Spend</span>
                        <span className="stat-value">${stats.totalSpend.toFixed(2)}</span>
                    </div>
                </div>

                {/* Filter Toggle */}
                <button
                    className="btn btn-secondary filter-toggle"
                    onClick={() => setShowFilters(!showFilters)}
                >
                    {showFilters ? 'Hide Filters' : 'Show Filters'} 🔍
                </button>

                {/* Advanced Filters */}
                {showFilters && (
                    <form className="admin-filters advanced" onSubmit={applyFilters}>
                        <div className="filter-row">
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
                        </div>

                        <div className="filter-row">
                            <input
                                type="text"
                                placeholder="Search business name"
                                value={filters.business}
                                onChange={handleFilterChange('business')}
                                className="filter-input"
                            />

                            <div className="date-range">
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

                        <div className="filter-row">
                            <div className="range-filter">
                                <label>Impressions:</label>
                                <input
                                    type="number"
                                    placeholder="Min"
                                    value={filters.minImpressions}
                                    onChange={handleFilterChange('minImpressions')}
                                    className="filter-input small"
                                />
                                <span>-</span>
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
                                <span>-</span>
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
                                <span>-</span>
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
                            <button type="button" className="btn btn-secondary" onClick={resetFilters}>
                                Reset
                            </button>
                        </div>
                    </form>
                )}

                {/* Bulk Actions */}
                {selectedAds.length > 0 && (
                    <div className="bulk-actions">
                        <span>{selectedAds.length} ad(s) selected</span>
                        <button className="btn btn-success" onClick={handleBulkApprove}>
                            Approve Selected
                        </button>
                        <button className="btn btn-warning" onClick={handleBulkReject}>
                            Reject Selected
                        </button>
                        <button className="btn btn-secondary" onClick={() => setSelectedAds([])}>
                            Clear
                        </button>
                    </div>
                )}
            </header>

            {/* Ads Table */}
            <div className="admin-table__wrapper">
                <table className="admin-table">
                    <thead>
                    <tr>
                        <th className="checkbox-col">
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
                            Plan/Tier {getSortIcon('subscription_tier')}
                        </th>
                        <th onClick={() => handleSort('status')} className="sortable">
                            Status {getSortIcon('status')}
                        </th>
                        <th onClick={() => handleSort('review_status')} className="sortable">
                            Review {getSortIcon('review_status')}
                        </th>
                        <th onClick={() => handleSort('impressions')} className="sortable">
                            Analytics {getSortIcon('impressions')}
                        </th>
                        <th onClick={() => handleSort('spend')} className="sortable">
                            Spend {getSortIcon('spend')}
                        </th>
                        <th>Controls</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filteredAds.length === 0 ? (
                        <tr>
                            <td colSpan="8" className="no-results">
                                No advertisements found matching your criteria
                            </td>
                        </tr>
                    ) : (
                        filteredAds.map((ad) => (
                            <tr key={ad.id} className={selectedAds.includes(ad.id) ? 'selected' : ''}>
                                <td className="checkbox-col">
                                    <input
                                        type="checkbox"
                                        checked={selectedAds.includes(ad.id)}
                                        onChange={() => handleSelectAd(ad.id)}
                                    />
                                </td>
                                <td>
                                    <div className="business-info">
                                        <strong className="business-name">{ad.business_name}</strong>
                                        <p className="ad-name">{ad.name}</p>
                                        <small className="owner-email">{ad.owner_email || 'No owner email'}</small>
                                        <small className="created-date">
                                            Created: {new Date(ad.created_at).toLocaleDateString()}
                                        </small>
                                    </div>
                                </td>
                                <td>
                                        <span className={`tier-badge tier-${ad.subscription_tier || 'base'}`}>
                                            {ad.subscription_tier || 'base'}
                                        </span>
                                </td>
                                <td>
                                        <span className={`status-badge status-${ad.status}`}>
                                            {ad.status?.replace('_', ' ') || 'unknown'}
                                        </span>
                                </td>
                                <td>
                                    <div className="review-info">
                                            <span className={`review-badge review-${ad.review_status}`}>
                                                {ad.review_status}
                                            </span>
                                        {ad.review_status === 'pending' && (
                                            <label className="override-toggle">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(selectedOverride[ad.id])}
                                                    onChange={(event) =>
                                                        setSelectedOverride((prev) => ({
                                                            ...prev,
                                                            [ad.id]: event.target.checked
                                                        }))
                                                    }
                                                />
                                                <span>Override limits</span>
                                            </label>
                                        )}
                                    </div>
                                </td>
                                <td>
                                    <div className="analytics-stats">
                                        <p className="stat-row">
                                            <span className="stat-label">👁️</span>
                                            <span className="stat-value">{ad.impressions?.toLocaleString() || 0}</span>
                                        </p>
                                        <p className="stat-row">
                                            <span className="stat-label">🖱️</span>
                                            <span className="stat-value">{ad.clicks?.toLocaleString() || 0}</span>
                                        </p>
                                        <p className="stat-row">
                                            <span className="stat-label">📊</span>
                                            <span className="stat-value">
                                                    {ad.impressions ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : 0}% CTR
                                                </span>
                                        </p>
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
                                <td className="admin-table__actions">
                                    <div className="action-buttons">
                                        <button
                                            type="button"
                                            onClick={() => handleViewDetails(ad.id)}
                                            className="btn btn-icon"
                                            title="View Details"
                                        >
                                            📋
                                        </button>

                                        {ad.review_status === 'pending' && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => handleApprove(ad.id)}
                                                    className="btn btn-success btn-small"
                                                    disabled={loading}
                                                >
                                                    ✓ Approve
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleReject(ad.id)}
                                                    className="btn btn-danger btn-small"
                                                    disabled={loading}
                                                >
                                                    ✗ Reject
                                                </button>
                                            </>
                                        )}

                                        {ad.status === 'active' && (
                                            <button
                                                type="button"
                                                onClick={() => handlePauseAd(ad.id)}
                                                className="btn btn-warning btn-small"
                                                disabled={loading}
                                            >
                                                ⏸️ Pause
                                            </button>
                                        )}

                                        {ad.status === 'paused' && (
                                            <button
                                                type="button"
                                                onClick={() => handleResumeAd(ad.id)}
                                                className="btn btn-success btn-small"
                                                disabled={loading}
                                            >
                                                ▶️ Resume
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

            {/* Ad Details Modal */}
            {showDetailsModal && selectedAdDetails && (
                <div className="modal" onClick={() => setShowDetailsModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Ad Details: {selectedAdDetails.name}</h2>
                            <button className="modal-close" onClick={() => setShowDetailsModal(false)}>×</button>
                        </div>

                        <div className="modal-body">
                            <div className="details-section">
                                <h3>Basic Information</h3>
                                <div className="details-grid">
                                    <div className="detail-item">
                                        <label>Business:</label>
                                        <span>{selectedAdDetails.business_name}</span>
                                    </div>
                                    <div className="detail-item">
                                        <label>Owner:</label>
                                        <span>{selectedAdDetails.owner_email}</span>
                                    </div>
                                    <div className="detail-item">
                                        <label>Tier:</label>
                                        <span className={`tier-badge tier-${selectedAdDetails.subscription_tier}`}>
                                            {selectedAdDetails.subscription_tier}
                                        </span>
                                    </div>
                                    <div className="detail-item">
                                        <label>Status:</label>
                                        <span className={`status-badge status-${selectedAdDetails.status}`}>
                                            {selectedAdDetails.status}
                                        </span>
                                    </div>
                                    <div className="detail-item">
                                        <label>Review Status:</label>
                                        <span className={`review-badge review-${selectedAdDetails.review_status}`}>
                                            {selectedAdDetails.review_status}
                                        </span>
                                    </div>
                                    <div className="detail-item">
                                        <label>Created:</label>
                                        <span>{new Date(selectedAdDetails.created_at).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {selectedAdDetails.content && (
                                <div className="details-section">
                                    <h3>Ad Content</h3>
                                    <div className="content-preview">
                                        {selectedAdDetails.content.image && (
                                            <img
                                                src={selectedAdDetails.content.image}
                                                alt="Ad preview"
                                                className="content-image"
                                            />
                                        )}
                                        <div className="content-text">
                                            <p><strong>Headline:</strong> {selectedAdDetails.content.headline}</p>
                                            <p><strong>Description:</strong> {selectedAdDetails.content.description}</p>
                                            {selectedAdDetails.content.cta && (
                                                <p><strong>CTA:</strong> {selectedAdDetails.content.cta}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedAdDetails.analytics && (
                                <div className="details-section">
                                    <h3>Performance Analytics</h3>
                                    <div className="analytics-charts">
                                        <div className="analytics-summary">
                                            <div className="summary-card">
                                                <span className="summary-label">Total Impressions</span>
                                                <span className="summary-value">
                                                    {selectedAdDetails.analytics.totalImpressions?.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="summary-card">
                                                <span className="summary-label">Total Clicks</span>
                                                <span className="summary-value">
                                                    {selectedAdDetails.analytics.totalClicks?.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="summary-card">
                                                <span className="summary-label">CTR</span>
                                                <span className="summary-value">
                                                    {selectedAdDetails.analytics.ctr?.toFixed(2)}%
                                                </span>
                                            </div>
                                            <div className="summary-card">
                                                <span className="summary-label">Total Spend</span>
                                                <span className="summary-value">
                                                    ${selectedAdDetails.analytics.totalSpend?.toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedAdDetails.rejection_reason && (
                                <div className="details-section rejection">
                                    <h3>Rejection Reason</h3>
                                    <p className="rejection-reason">{selectedAdDetails.rejection_reason}</p>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowDetailsModal(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default AdApprovals;
