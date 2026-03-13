import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { createCampaign, deleteCampaign, getMyCampaigns } from '../../services/adService';
import './BusinessAdsManager.css';

const placements = ['business_profile', 'search_results', 'category', 'recommended'];
const bidTypes = ['cpc', 'cpm'];

const BusinessAdsManager = () => {
    const { user } = useAuth();
    const [campaigns, setCampaigns] = useState([]);
    const [form, setForm] = useState({
        name: '',
        mediaType: 'image',
        dailyBudget: '',
        bidType: 'cpc',
        clickRedirectUrl: '',
        targetLocations: '',
        targetIndustries: '',
        behaviors: ''
    });
    const [selectedPlacements, setSelectedPlacements] = useState(['business_profile']);
    const [mediaFile, setMediaFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [capabilities, setCapabilities] = useState(null);

    const loadCampaigns = async () => {
        setLoading(true);
        try {
            const { data } = await getMyCampaigns();
            const list = (data.campaigns || []).map((campaign) => ({
                ...campaign,
                ctr: campaign.impressions > 0
                    ? Number(((campaign.clicks / campaign.impressions) * 100).toFixed(2))
                    : 0,
                spendMajor: campaign.spend_minor ? (campaign.spend_minor / 100).toFixed(2) : '0.00'
            }));
            setCampaigns(list);
            setCapabilities(data.capabilities || null);
        } catch (error) {
            console.error('Failed to load campaigns', error);
            toast.error('Unable to load campaigns');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.role === 'business') {
            loadCampaigns();
        }
    }, [user]);

    const handleFieldChange = (field) => (event) => {
        setForm((prev) => ({
            ...prev,
            [field]: event.target.value
        }));
    };

    const handlePlacementToggle = (placement) => {
        setSelectedPlacements((prev) =>
            prev.includes(placement)
                ? prev.filter((item) => item !== placement)
                : [...prev, placement]
        );
    };

    const activeCampaigns = useMemo(() => (
        campaigns.filter((campaign) => ['pending_review', 'active'].includes(campaign.status)).length
    ), [campaigns]);

    const maxActive = capabilities?.maxActive;
    const premiumOverride = capabilities?.premiumException;
    const limitReached = Number.isFinite(maxActive) && !premiumOverride && activeCampaigns >= maxActive;

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!mediaFile) {
            toast.error('Please upload a media file');
            return;
        }
        if (!selectedPlacements.length) {
            toast.error('Select at least one placement');
            return;
        }
        if (limitReached) {
            toast.error('Ad limit reached for your current plan');
            return;
        }

        const formData = new FormData();
        formData.append('media', mediaFile);
        formData.append('name', form.name || 'Sponsored Campaign');
        formData.append('mediaType', form.mediaType);
        formData.append('dailyBudget', form.dailyBudget || '0');
        formData.append('bid_type', form.bidType);
        formData.append('clickRedirectUrl', form.clickRedirectUrl);
        formData.append('targetLocations', form.targetLocations);
        formData.append('targetIndustries', form.targetIndustries);
        formData.append('behaviors', form.behaviors);
        formData.append('placements', JSON.stringify(selectedPlacements));

        setSaving(true);
        try {
            await createCampaign(formData);
            toast.success('Campaign submitted for approval');
            setForm({
                name: '',
                mediaType: 'image',
                dailyBudget: '',
                bidType: 'cpc',
                clickRedirectUrl: '',
                targetLocations: '',
                targetIndustries: '',
                behaviors: ''
            });
            setSelectedPlacements(['business_profile']);
            setMediaFile(null);
            await loadCampaigns();
        } catch (error) {
            console.error('Create campaign failed:', error);
            toast.error(error.response?.data?.error || 'Failed to create campaign');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (campaignId) => {
        if (!window.confirm('Delete this campaign?')) return;
        try {
            await deleteCampaign(campaignId);
            toast.success('Campaign deleted');
            await loadCampaigns();
        } catch (error) {
            console.error('Delete campaign failed:', error);
            toast.error('Unable to delete campaign');
        }
    };

    const placementsSummary = useMemo(() => selectedPlacements.join(', '), [selectedPlacements]);

    if (user?.role !== 'business') return null;

    return (
        <section className="business-ads-manager">
            <header>
                <h2>Advertising Campaigns</h2>
                <p>
                    {premiumOverride
                        ? 'Welp premium exception active â€“ unlimited ads unlocked.'
                        : Number.isFinite(maxActive)
                            ? `You can run ${maxActive} active ads with ${capabilities?.analyticsMode || 'limited'} analytics.`
                            : 'Unlimited campaigns with advanced analytics.'}
                </p>
            </header>
            <form className="business-ads-form" onSubmit={handleSubmit}>
                <div className="form-grid">
                    <label>
                        Campaign name
                        <input value={form.name} onChange={handleFieldChange('name')} placeholder="Title for the campaign" />
                    </label>
                    <label>
                        Media type
                        <select value={form.mediaType} onChange={handleFieldChange('mediaType')}>
                            <option value="image">Image</option>
                            <option value="video">Video</option>
                            <option value="gif">GIF</option>
                        </select>
                    </label>
                    <label>
                        Daily budget (USD)
                        <input
                            type="number"
                            min="0"
                            step="1"
                            value={form.dailyBudget}
                            onChange={handleFieldChange('dailyBudget')}
                        />
                    </label>
                    <label>
                        Bid type
                        <select value={form.bidType} onChange={handleFieldChange('bidType')}>
                            {bidTypes.map((type) => (
                                <option key={type} value={type}>
                                    {type.toUpperCase()}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="form-grid">
                    <label>
                        Click redirect URL
                        <input value={form.clickRedirectUrl} onChange={handleFieldChange('clickRedirectUrl')} placeholder="https://..." />
                    </label>
                    <label>
                        Target locations (comma separated)
                        <input value={form.targetLocations} onChange={handleFieldChange('targetLocations')} />
                    </label>
                    <label>
                        Target industries
                        <input value={form.targetIndustries} onChange={handleFieldChange('targetIndustries')} />
                    </label>
                    <label>
                        Behavior tags
                        <input value={form.behaviors} onChange={handleFieldChange('behaviors')} placeholder="remote,tech" />
                    </label>
                </div>
                <div className="placements">
                    <span>Placements</span>
                    <div className="placements-grid">
                        {placements.map((placement) => (
                            <label key={placement}>
                                <input
                                    type="checkbox"
                                    value={placement}
                                    checked={selectedPlacements.includes(placement)}
                                    onChange={() => handlePlacementToggle(placement)}
                                />
                                {placement.replace('_', ' ')}
                            </label>
                        ))}
                    </div>
                </div>
                <label className="media-upload">
                    <span>{mediaFile ? mediaFile.name : 'Upload media (PNG, JPG, MP4, GIF)'}</span>
                    <input type="file" accept="image/*,video/*,.gif" onChange={(event) => setMediaFile(event.target.files[0])} />
                </label>
                <div className="form-actions">
                    <button
                        type="submit"
                        className="primary"
                        disabled={saving || limitReached}
                        title={limitReached ? 'Upgrade your plan to unlock more ads' : undefined}
                    >
                        {limitReached ? 'Ad limit reached' : saving ? 'Saving…' : 'Submit for approval'}
                    </button>
                    <span className="placements-summary">{placementsSummary}</span>
                </div>
            </form>

            <section className="campaign-list">
                <div className="campaign-list__header">
                    <h3>Your campaigns</h3>
                    {loading && <span className="loading-chip">Loading…</span>}
                </div>
                <ul>
                    {campaigns.map((campaign) => (
                        <li key={campaign.id} className="campaign-list__item">
                            <div>
                                <strong>{campaign.name}</strong>
                                <p>
                                    Status <strong>{campaign.status}</strong> · Review <strong>{campaign.review_status}</strong>
                                </p>
                                <p>
                                    Placements:{' '}
                                    {campaign.placements?.map((item) => item.placement).join(', ') || '—'}
                                </p>
                            </div>
                            <div className="campaign-stats">
                                <span>Impr. {campaign.impressions}</span>
                                <span>Clicks {campaign.clicks}</span>
                                <span>CTR {campaign.ctr}%</span>
                                <span>Spend ${campaign.spendMajor}</span>
                            </div>
                            <button className="text-link" onClick={() => handleDelete(campaign.id)}>
                                Delete
                            </button>
                        </li>
                    ))}
                </ul>
            </section>
        </section>
    );
};

export default BusinessAdsManager;
