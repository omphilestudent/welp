import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import {
    createCampaign,
    deleteCampaign,
    getMyCampaigns,
    updateCampaign
} from '../../services/adService';
import AdCard from './AdCard';
import './AdvertisingSection.css';

const PLACEMENTS = ['business_profile', 'search_results', 'category', 'recommended'];
const BID_TYPES = ['cpc', 'cpm'];

const INITIAL_FORM = {
    name: '',
    mediaType: 'image',
    dailyBudget: '',
    bidType: 'cpc',
    clickRedirectUrl: '',
    targetLocations: '',
    targetIndustries: '',
    behaviors: ''
};

const normalizeCapabilities = (raw) => {
    if (!raw) return null;
    const maxActive = Number.isFinite(raw.maxActive) ? raw.maxActive : null;
    const remaining = Number.isFinite(raw.remaining) ? raw.remaining : null;
    return {
        ...raw,
        maxActive,
        remaining,
        unlimited: raw.unlimited || maxActive === null
    };
};

const AdvertisingSection = ({ premiumExceptionActive = false }) => {
    const { user } = useAuth();
    const [campaigns, setCampaigns] = useState([]);
    const [form, setForm] = useState(INITIAL_FORM);
    const [selectedPlacements, setSelectedPlacements] = useState(['business_profile']);
    const [mediaFile, setMediaFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [capabilities, setCapabilities] = useState(null);
    const [editingCampaign, setEditingCampaign] = useState(null);
    const userId = user?.id;
    const userRole = user?.role;
    const isBusinessUser = userRole === 'business';

    const loadCampaigns = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await getMyCampaigns();
            const list = (data.campaigns || []).map((campaign) => ({
                ...campaign,
                ctr:
                    campaign.impressions > 0
                        ? Number(((campaign.clicks / Math.max(campaign.impressions, 1)) * 100).toFixed(2))
                        : 0,
                spendMajor: campaign.spend_minor ? campaign.spend_minor / 100 : 0
            }));
            setCampaigns(list);
            setCapabilities(normalizeCapabilities(data.capabilities));
        } catch (error) {
            console.error('Failed to load campaigns', error);
            toast.error('Unable to load campaigns');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isBusinessUser || !userId) {
            setCampaigns([]);
            setCapabilities(null);
            return;
        }
        loadCampaigns();
    }, [isBusinessUser, userId, loadCampaigns]);

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

    const activeCampaigns = useMemo(
        () => campaigns.filter((campaign) => ['pending_review', 'active'].includes(campaign.status)).length,
        [campaigns]
    );

    const analyticsTotals = useMemo(() => {
        return campaigns.reduce(
            (acc, campaign) => {
                acc.impressions += Number(campaign.impressions || 0);
                acc.clicks += Number(campaign.clicks || 0);
                acc.spend += Number(campaign.spendMajor || 0);
                return acc;
            },
            { impressions: 0, clicks: 0, spend: 0 }
        );
    }, [campaigns]);

    const premiumOverride = premiumExceptionActive || capabilities?.premiumException;
    const maxActive = typeof capabilities?.maxActive === 'number' ? capabilities.maxActive : null;
    const slotsRemaining =
        typeof capabilities?.remaining === 'number' ? capabilities.remaining : null;
    const displayedActive = capabilities?.active ?? activeCampaigns;
    const limitReached =
        !premiumOverride && typeof maxActive === 'number' && displayedActive >= maxActive;

    const placementsSummary = useMemo(() => selectedPlacements.join(', '), [selectedPlacements]);
    const editing = Boolean(editingCampaign);

    const resetForm = () => {
        setForm(INITIAL_FORM);
        setSelectedPlacements(['business_profile']);
        setMediaFile(null);
        setEditingCampaign(null);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!selectedPlacements.length) {
            toast.error('Select at least one placement');
            return;
        }
        if (!editing && !mediaFile) {
            toast.error('Please upload a media file');
            return;
        }
        if (limitReached) {
            toast.error('Ad limit reached for your current plan');
            return;
        }

        const formData = new FormData();
        if (mediaFile) {
            formData.append('media', mediaFile);
        }
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
            if (editing && editingCampaign) {
                await updateCampaign(editingCampaign.id, formData);
                toast.success('Campaign updated');
            } else {
                await createCampaign(formData);
                toast.success('Campaign submitted for approval');
            }
            resetForm();
            await loadCampaigns();
        } catch (error) {
            console.error('Save campaign failed:', error);
            toast.error(error.response?.data?.error || 'Failed to save campaign');
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

    const handleEdit = (campaign) => {
        setEditingCampaign(campaign);
        setForm({
            name: campaign.name || '',
            mediaType: campaign.media_type || 'image',
            dailyBudget: campaign.daily_budget_minor
                ? (campaign.daily_budget_minor / 100).toString()
                : '',
            bidType: campaign.bid_type || 'cpc',
            clickRedirectUrl: campaign.click_redirect_url || '',
            targetLocations: (campaign.target_locations || []).join(', '),
            targetIndustries: (campaign.target_industries || []).join(', '),
            behaviors: campaign.target_behaviors
                ? campaign.target_behaviors.map((entry) => entry).join(', ')
                : ''
        });
        setSelectedPlacements(
            (campaign.placements || []).map((placement) => placement.placement)
        );
        setMediaFile(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        resetForm();
    };

    if (user?.role !== 'business') {
        return null;
    }

    const summaryCards = [
        {
            label: 'Active campaigns',
            value:
                typeof maxActive === 'number'
                    ? `${displayedActive}/${maxActive}`
                    : `${displayedActive}`,
            hint:
                typeof maxActive === 'number'
                    ? 'Includes pending review ads'
                    : 'Unlimited tier'
        },
        {
            label: 'Remaining slots',
            value: slotsRemaining === null ? 'Unlimited' : slotsRemaining,
            hint: slotsRemaining === null ? 'Premium access' : 'Available ad submissions'
        },
        {
            label: 'Lifetime impressions',
            value: analyticsTotals.impressions.toLocaleString(),
            hint: 'All campaigns'
        },
        {
            label: 'Lifetime spend',
            value: `$${analyticsTotals.spend.toFixed(2)}`,
            hint: 'All campaigns'
        }
    ];

    return (
        <section className="advertising-section">
            <header className="advertising-section__header">
                <div>
                    <h2>Advertising</h2>
                    <p>
                        Monitor campaigns, submit new creative, and track analytics tied to your plan.
                    </p>
                </div>
            </header>

            <div className="ads-summary-grid">
                {summaryCards.map((card) => (
                    <div key={card.label} className="ads-summary-card">
                        <span>{card.label}</span>
                        <strong>{card.value}</strong>
                        <p>{card.hint}</p>
                    </div>
                ))}
            </div>

            {(premiumOverride || premiumExceptionActive) && (
                <div className="ads-premium-callout">
                    Premium advertising override active - Welp has lifted standard ad limits.
                </div>
            )}

            {limitReached && (
                <div className="ads-limit-warning">
                    You have reached the active ad limit for your plan. Pause an ad or upgrade to add
                    more campaigns.
                </div>
            )}

            <form className="ads-form" onSubmit={handleSubmit}>
                {editing && (
                    <div className="ads-edit-banner">
                        Editing “{editingCampaign?.name || 'Untitled'}”
                        <button type="button" onClick={handleCancelEdit}>
                            Cancel edit
                        </button>
                    </div>
                )}
                <div className="ads-form-grid">
                    <label>
                        Campaign name
                        <input
                            value={form.name}
                            onChange={handleFieldChange('name')}
                            placeholder="Title for the campaign"
                        />
                    </label>
                    <label>
                        Media type
                        <select value={form.mediaType} onChange={handleFieldChange('mediaType')}>
                            {['image', 'video', 'gif'].map((type) => (
                                <option key={type} value={type}>
                                    {type.toUpperCase()}
                                </option>
                            ))}
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
                            {BID_TYPES.map((type) => (
                                <option key={type} value={type}>
                                    {type.toUpperCase()}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <div className="ads-form-grid">
                    <label>
                        Click redirect URL
                        <input
                            value={form.clickRedirectUrl}
                            onChange={handleFieldChange('clickRedirectUrl')}
                            placeholder="https://..."
                        />
                    </label>
                    <label>
                        Target locations
                        <input
                            value={form.targetLocations}
                            onChange={handleFieldChange('targetLocations')}
                            placeholder="Johannesburg, Cape Town"
                        />
                    </label>
                    <label>
                        Target industries
                        <input
                            value={form.targetIndustries}
                            onChange={handleFieldChange('targetIndustries')}
                            placeholder="tech, finance"
                        />
                    </label>
                    <label>
                        Behavior tags
                        <input
                            value={form.behaviors}
                            onChange={handleFieldChange('behaviors')}
                            placeholder="remote,future-of-work"
                        />
                    </label>
                </div>
                <div className="placements">
                    <span>Placements</span>
                    <div className="placements-grid">
                        {PLACEMENTS.map((placement) => (
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
                    <span>
                        {mediaFile
                            ? mediaFile.name
                            : editing
                                ? 'Current media will be reused unless you upload a new file'
                                : 'Upload media (PNG, JPG, MP4, GIF)'}
                    </span>
                    <input
                        type="file"
                        accept="image/*,video/*,.gif"
                        onChange={(event) => setMediaFile(event.target.files[0])}
                    />
                </label>
                <div className="form-actions">
                    <button
                        type="submit"
                        className="primary"
                        disabled={saving || limitReached}
                        title={limitReached ? 'Upgrade your plan to unlock more ads' : undefined}
                    >
                        {saving ? 'Saving...' : editing ? 'Update campaign' : 'Submit for approval'}
                    </button>
                    <span className="placements-summary">{placementsSummary || 'Select placements'}</span>
                </div>
            </form>

            <section className="campaign-list">
                <div className="campaign-list__header">
                    <h3>Your campaigns</h3>
                    {loading && <span className="loading-chip">Loading...</span>}
                </div>
                {campaigns.length === 0 ? (
                    <p className="campaign-empty">
                        No campaigns yet. Launch your first ad to appear in top placements.
                    </p>
                ) : (
                    <div className="ad-card-grid">
                        {campaigns.map((campaign) => (
                            <AdCard
                                key={campaign.id}
                                ad={campaign}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}
            </section>
        </section>
    );
};

export default AdvertisingSection;
