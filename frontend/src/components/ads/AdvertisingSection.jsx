import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { formatAmountMinor, resolveUserCurrency } from '../../utils/currency';
import {
    createCampaign,
    deleteCampaign,
    getMyCampaigns,
    updateCampaign,
    getAdPricing,
    getMyAdInvoices,
    downloadAdInvoice
} from '../../services/adService';
import AdCard from './AdCard';
import './AdvertisingSection.css';

const PLACEMENTS = ['business_profile', 'search_results', 'category', 'recommended'];
const BID_TYPES = ['cpc', 'cpm'];
const MAX_MEDIA_BYTES = 15 * 1024 * 1024;
const MAX_MEDIA_MB = Math.round(MAX_MEDIA_BYTES / (1024 * 1024));

const INITIAL_FORM = {
    name: '',
    mediaType: 'image',
    dailyBudget: '',
    bidType: 'cpc',
    clickRedirectUrl: '',
    targetLocations: '',
    targetIndustries: '',
    behaviors: '',
    startsAt: '',
    endsAt: '',
    priorityLevel: '1',
    adOption: 'standard'
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

const resolveCampaignError = (error) => {
    if (!error) {
        return 'We were unable to create your advertisement due to a server issue. Please try again later.';
    }
    if (error.response) {
        const { status, data } = error.response;
        const backendMessage = data?.error || data?.message;
        const detailList = Array.isArray(data?.details) && data.details.length ? `: ${data.details.join(', ')}` : '';
        if (status === 400) {
            return (
                backendMessage ||
                'Please complete all required fields before submitting your advertisement.'
            ) + detailList;
        }
        if (status === 403) {
            return (
                backendMessage ||
                'Advertising features are available in the Premium Plan. Please upgrade your subscription to create campaigns.'
            );
        }
        if (status === 413 || backendMessage?.toLowerCase().includes('file too large')) {
            return `The selected file is too large. Please upload a file under ${MAX_MEDIA_MB}MB.`;
        }
        if (status >= 500) {
            return backendMessage || 'We were unable to create your advertisement due to a server issue. Please try again later.';
        }
        return backendMessage || 'Unable to save campaign.';
    }
    if (error.message?.toLowerCase().includes('network')) {
        return 'Network error while saving the campaign. Please check your connection and try again.';
    }
    return 'We were unable to create your advertisement due to a server issue. Please try again later.';
};

const AdvertisingSection = ({ premiumExceptionActive = false }) => {
    const { user } = useAuth();
    const [campaigns, setCampaigns] = useState([]);
    const [form, setForm] = useState(INITIAL_FORM);
    const [selectedPlacements, setSelectedPlacements] = useState(['business_profile']);
    const [mediaFiles, setMediaFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [capabilities, setCapabilities] = useState(null);
    const [editingCampaign, setEditingCampaign] = useState(null);
    const [formMessage, setFormMessage] = useState(null);
    const [formMessageType, setFormMessageType] = useState('info');
    const [pricing, setPricing] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [invoiceLoading, setInvoiceLoading] = useState(false);
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

    const loadPricing = useCallback(async () => {
        try {
            const preference = resolveUserCurrency(user);
            const { data } = await getAdPricing({
                currency: preference.currency?.code,
                country: preference.countryCode
            });
            setPricing(data.pricing || null);
        } catch {
            setPricing(null);
        }
    }, [user]);

    const loadInvoices = useCallback(async () => {
        setInvoiceLoading(true);
        try {
            const { data } = await getMyAdInvoices();
            setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
        } catch {
            setInvoices([]);
        } finally {
            setInvoiceLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isBusinessUser || !userId) {
            setCampaigns([]);
            setCapabilities(null);
            return;
        }
        loadCampaigns();
        loadPricing();
        loadInvoices();
    }, [isBusinessUser, userId, loadCampaigns, loadPricing, loadInvoices]);

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
    const requiresPremiumTier =
        !premiumOverride && capabilities?.tier && capabilities.tier !== 'premium';

    const placementsSummary = useMemo(() => selectedPlacements.join(', '), [selectedPlacements]);
    const pricingSummary = useMemo(() => {
        if (!pricing) return null;
        const optionMultiplier = pricing.options?.[form.adOption] || 1;
        const priorityMultiplier = pricing.priorityMultipliers?.[form.priorityLevel] || 1;
        const placementTotals = selectedPlacements.map((placement) => {
            const base = pricing.placements?.[placement] || pricing.placements?.business_profile || 0;
            const baseAdjusted = Math.round(base * optionMultiplier);
            const total = Math.round(baseAdjusted * priorityMultiplier);
            return { placement, base: baseAdjusted, total };
        });
        const total = placementTotals.reduce((sum, entry) => sum + entry.total, 0);
        return { placementTotals, total };
    }, [pricing, selectedPlacements, form.adOption, form.priorityLevel]);
    const editing = Boolean(editingCampaign);

    const resetForm = () => {
        setForm(INITIAL_FORM);
        setSelectedPlacements(['business_profile']);
        setMediaFiles([]);
        setEditingCampaign(null);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (saving) {
            return;
        }
        setFormMessage(null);
        setFormMessageType('info');
        if (!selectedPlacements.length) {
            toast.error('Select at least one placement');
            return;
        }
        if (!editing && mediaFiles.length === 0) {
            toast.error('Please upload a media file');
            return;
        }
        if (mediaFiles.some((file) => file && file.size > MAX_MEDIA_BYTES)) {
            toast.error(`Media file exceeds ${MAX_MEDIA_MB}MB limit`);
            return;
        }
        if (requiresPremiumTier) {
            const message = 'Advertising features are available in the Premium Plan. Please upgrade your subscription.';
            setFormMessage(message);
            setFormMessageType('error');
            toast.error(message);
            return;
        }
        if (limitReached) {
            const message = 'Ad limit reached for your current plan. Pause an existing campaign or upgrade to continue.';
            setFormMessage(message);
            setFormMessageType('error');
            toast.error(message);
            return;
        }

        const formData = new FormData();
        if (mediaFiles.length) {
            mediaFiles.forEach((file) => {
                formData.append('media', file);
            });
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
        formData.append('startsAt', form.startsAt || '');
        formData.append('endsAt', form.endsAt || '');
        formData.append('priorityLevel', form.priorityLevel || '1');
        formData.append('adOption', form.adOption || 'standard');

        setSaving(true);
        try {
            if (editing && editingCampaign) {
                await updateCampaign(editingCampaign.id, formData);
                toast.success('Campaign updated');
                setFormMessage('Campaign updated successfully.');
                setFormMessageType('success');
            } else {
                await createCampaign(formData);
                toast.success('Campaign submitted for approval');
                setFormMessage('Campaign submitted for review successfully.');
                setFormMessageType('success');
            }
            resetForm();
            await loadCampaigns();
        } catch (error) {
            console.error('Save campaign failed:', error);
            const friendly = resolveCampaignError(error);
            setFormMessage(friendly);
            setFormMessageType('error');
            toast.error(friendly);
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

    const handleDownloadInvoice = async (invoice) => {
        try {
            const response = await downloadAdInvoice(invoice.id);
            const blob = new Blob([response.data], { type: response.headers['content-type'] || 'text/html' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${invoice.invoice_number || 'ad-invoice'}.html`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast.error('Unable to download invoice');
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
                : '',
            startsAt: campaign.starts_at ? new Date(campaign.starts_at).toISOString().slice(0, 16) : '',
            endsAt: campaign.ends_at ? new Date(campaign.ends_at).toISOString().slice(0, 16) : '',
            priorityLevel: String(campaign.priority_level || '1'),
            adOption: campaign.ad_option || 'standard'
        });
        setSelectedPlacements(
            (campaign.placements || []).map((placement) => placement.placement)
        );
        setMediaFiles([]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        resetForm();
        setFormMessage(null);
        setFormMessageType('info');
    };

    if (user?.role !== 'business') {
        return null;
    }

    const currencyCode = pricing?.currency?.code;
    const currencySymbol = pricing?.currency?.symbol;

    const formatMoney = (minor) =>
        formatAmountMinor(minor, currencyCode || undefined, currencySymbol || undefined);

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
            value: formatMoney(Math.round(analyticsTotals.spend * 100)) || '—',
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

            {requiresPremiumTier && (
                <div className="ads-limit-warning">
                    Advertising features are available in the Premium Plan. Upgrade your subscription to submit campaigns.
                </div>
            )}

            <form className="ads-form" onSubmit={handleSubmit}>
                {formMessage && (
                    <div className={`ads-form-message ads-form-message--${formMessageType}`}>
                        {formMessage}
                    </div>
                )}
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
                        Daily budget ({currencyCode || 'USD'})
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
                        Start date/time
                        <input
                            type="datetime-local"
                            value={form.startsAt}
                            onChange={handleFieldChange('startsAt')}
                        />
                    </label>
                    <label>
                        End date/time
                        <input
                            type="datetime-local"
                            value={form.endsAt}
                            onChange={handleFieldChange('endsAt')}
                        />
                    </label>
                    <label>
                        Priority level
                        <select value={form.priorityLevel} onChange={handleFieldChange('priorityLevel')}>
                            <option value="1">Standard</option>
                            <option value="2">Boosted</option>
                            <option value="3">Priority</option>
                        </select>
                    </label>
                    <label>
                        Ad option
                        <select value={form.adOption} onChange={handleFieldChange('adOption')}>
                            <option value="standard">Standard</option>
                            <option value="spotlight">Spotlight</option>
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
                {pricingSummary && (
                    <div className="ads-pricing-summary">
                        <h4>Estimated 30-day charge</h4>
                        <div className="ads-pricing-grid">
                            {pricingSummary.placementTotals.map((entry) => (
                                <div key={entry.placement}>
                                    <span>{entry.placement.replace('_', ' ')}</span>
                                    <strong>{formatMoney(entry.total)}</strong>
                                </div>
                            ))}
                        </div>
                        <p className="ads-pricing-total">
                            Total: <strong>{formatMoney(pricingSummary.total)}</strong>
                        </p>
                    </div>
                )}
                <label className="media-upload">
                    <span>
                        {mediaFiles.length
                            ? `${mediaFiles.length} file(s) selected`
                            : editing
                                ? 'Current media will be reused unless you upload new files'
                                : 'Upload media (PNG, JPG, MP4, GIF)'}
                    </span>
                    <input
                        type="file"
                        accept="image/*,video/*,.gif"
                        multiple
                        onChange={(event) => setMediaFiles(Array.from(event.target.files || []))}
                    />
                </label>
                <div className="form-actions">
                    <button
                        type="submit"
                        className="primary"
                        disabled={saving || limitReached || requiresPremiumTier}
                        title={
                            limitReached
                                ? 'Upgrade your plan to unlock more ads'
                                : requiresPremiumTier
                                    ? 'Premium plan required for advertising'
                                    : undefined
                        }
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

            <section className="ads-invoices">
                <div className="campaign-list__header">
                    <h3>Ad invoices</h3>
                    {invoiceLoading && <span className="loading-chip">Loading...</span>}
                </div>
                {invoices.length === 0 ? (
                    <p className="campaign-empty">No invoices have been issued yet.</p>
                ) : (
                    <div className="ads-invoice-grid">
                        {invoices.map((invoice) => (
                            <div key={invoice.id} className="ads-invoice-card">
                                <div>
                                    <h4>{invoice.invoice_number}</h4>
                                    <p className="text-secondary">
                                        {invoice.period_start ? new Date(invoice.period_start).toLocaleDateString() : '—'} —{' '}
                                        {invoice.period_end ? new Date(invoice.period_end).toLocaleDateString() : '—'}
                                    </p>
                                </div>
                                <div className="ads-invoice-meta">
                                    <strong>{formatMoney(invoice.total_minor || 0)}</strong>
                                    <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        onClick={() => handleDownloadInvoice(invoice)}
                                    >
                                        Download
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </section>
    );
};

export default AdvertisingSection;
