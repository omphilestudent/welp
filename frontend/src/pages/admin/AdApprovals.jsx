import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Loading from '../../components/common/Loading';
import { adminApproveAd, adminListAds, adminRejectAd } from '../../services/adService';

const defaultFilters = {
    reviewStatus: 'pending',
    status: '',
    tier: '',
    business: ''
};

const AdApprovals = () => {
    const [filters, setFilters] = useState(defaultFilters);
    const [ads, setAds] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedOverride, setSelectedOverride] = useState({});

    const fetchAds = async () => {
        setLoading(true);
        try {
            const params = {
                reviewStatus: filters.reviewStatus || undefined,
                status: filters.status || undefined,
                tier: filters.tier || undefined,
                search: filters.business || undefined
            };
            const { data } = await adminListAds(params);
            setAds(data?.ads || []);
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

    const handleFilterChange = (field) => (event) => {
        setFilters((prev) => ({
            ...prev,
            [field]: event.target.value
        }));
    };

    const applyFilters = (event) => {
        event.preventDefault();
        fetchAds();
    };

    const handleApprove = async (adId) => {
        try {
            await adminApproveAd({
                adId,
                overrideRestrictions: Boolean(selectedOverride[adId])
            });
            toast.success('Ad approved');
            await fetchAds();
        } catch (error) {
            console.error('Approve failed', error);
            toast.error(error.response?.data?.error || 'Unable to approve ad');
        }
    };

    const handleReject = async (adId) => {
        const reason = window.prompt('Reason for rejection?');
        if (!reason) return;
        try {
            await adminRejectAd({ adId, reason, notes: reason });
            toast.success('Ad rejected');
            await fetchAds();
        } catch (error) {
            console.error('Reject failed', error);
            toast.error(error.response?.data?.error || 'Unable to reject ad');
        }
    };

    if (loading && !ads.length) {
        return <Loading />;
    }

    return (
        <section className="admin-panel">
            <header className="admin-panel__header">
                <div>
                    <p className="admin-panel__eyebrow">Advertising</p>
                    <h1>Ad Approvals</h1>
                </div>
                <form className="admin-filters" onSubmit={applyFilters}>
                    <select value={filters.reviewStatus} onChange={handleFilterChange('reviewStatus')}>
                        <option value="pending">Pending review</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>
                    <select value={filters.status} onChange={handleFilterChange('status')}>
                        <option value="">Any status</option>
                        <option value="pending_review">Pending review</option>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="completed">Completed</option>
                    </select>
                    <select value={filters.tier} onChange={handleFilterChange('tier')}>
                        <option value="">All tiers</option>
                        <option value="base">Base</option>
                        <option value="enhanced">Enhanced</option>
                        <option value="premium">Premium</option>
                    </select>
                    <input
                        type="text"
                        placeholder="Search business"
                        value={filters.business}
                        onChange={handleFilterChange('business')}
                    />
                    <button type="submit" className="btn btn-primary">
                        Apply
                    </button>
                </form>
            </header>

            <div className="admin-table__wrapper">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Business</th>
                            <th>Plan/Tier</th>
                            <th>Status</th>
                            <th>Review</th>
                            <th>Analytics</th>
                            <th>Controls</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ads.map((ad) => (
                            <tr key={ad.id}>
                                <td>
                                    <strong>{ad.business_name}</strong>
                                    <p>{ad.name}</p>
                                    <small>{ad.owner_email || '—'}</small>
                                </td>
                                <td>
                                    <span>{ad.subscription_tier || 'base'}</span>
                                </td>
                                <td>
                                    <span className={`badge badge--${ad.status}`}>{ad.status}</span>
                                </td>
                                <td>
                                    <div className="admin-review">
                                        <span>{ad.review_status}</span>
                                        <label className="admin-toggle">
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
                                    </div>
                                </td>
                                <td>
                                    <p>Impr. {ad.impressions}</p>
                                    <p>Clicks {ad.clicks}</p>
                                    <p>Spend ${(ad.spend_minor || 0) / 100}</p>
                                </td>
                                <td className="admin-table__actions">
                                    <button type="button" onClick={() => handleApprove(ad.id)} className="btn btn-primary">
                                        Approve
                                    </button>
                                    <button type="button" onClick={() => handleReject(ad.id)} className="btn btn-secondary">
                                        Reject
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default AdApprovals;
