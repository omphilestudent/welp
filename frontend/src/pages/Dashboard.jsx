import React, { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import ReviewList from '../components/reviews/ReviewList';
import Loading from '../components/common/Loading';
import AvatarImage from '../components/common/AvatarImage';
import ProfileSettings from '../components/settings/ProfileSettings';
import AdvertisingSection from '../components/ads/AdvertisingSection';
import { resolveMediaUrl } from '../utils/media';
import { getPlanKey, getPlanPermissions, requirePaidBusinessOrRedirect } from '../utils/subscriptionAccess';
import { currencyForCountry } from '../utils/currency';
import Modal from '../components/common/Modal';
import {
    FaCamera, FaUpload, FaBriefcase, FaBuilding, FaEdit,
    FaCalendarAlt, FaEnvelopeOpenText, FaPhoneAlt, FaVideo,
    FaChevronDown, FaChevronUp, FaStar, FaReply, FaCheckCircle,
    FaTimesCircle, FaUserSecret, FaUser, FaChartBar, FaSync,
    FaGlobe, FaMapMarkerAlt, FaEnvelope, FaPhone, FaImage,
    FaCrown, FaShieldAlt, FaExclamationTriangle,
    FaMoneyBillWave, FaWallet, FaFileInvoiceDollar
} from 'react-icons/fa';
import {
    ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart,
    Pie, Cell, CartesianGrid, XAxis, YAxis, Tooltip, Legend
} from 'recharts';
import {
    addDays, addWeeks, endOfWeek, format,
    startOfWeek, subWeeks
} from 'date-fns';
import { useNavigate } from 'react-router-dom';

const BUSINESS_PIE_COLORS = ['#6366f1', '#f59e0b', '#0ea5e9', '#10b981', '#ec4899'];

const VERIFICATION_STEP_LABELS = {
    documents: 'Document verification',
    ownership: 'Ownership confirmation',
    experience: 'Experience verification'
};

const PSY_KYC_DOCUMENTS = [
    { type: 'license', label: 'Professional license or certification' },
    { type: 'government_id', label: 'Government-issued identification' },
    { type: 'qualification', label: 'Proof of qualifications' }
];

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Star Rating Display
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const StarRating = ({ rating, size = 14 }) => {
    return (
        <span className="star-rating" style={{ display: 'inline-flex', gap: 2 }}>
            {[1, 2, 3, 4, 5].map((s) => (
                <FaStar
                    key={s}
                    size={size}
                    style={{ color: s <= Math.round(rating) ? '#f59e0b' : '#d1d5db' }}
                />
            ))}
        </span>
    );
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Review Card â€” with identity, reply, sentiment
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const ReviewCard = ({ review, onReplyAdded, replyEndpoint }) => {
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [existingReply, setExistingReply] = useState(review.business_reply || null);

    const isAnonymous = review.is_anonymous || !review.author_name;
    const authorLabel = isAnonymous ? 'Anonymous Employee' : (review.author_name || 'Employee');
    const occupationLabel = review.author_occupation || review.occupation;
    const workplaceLabel = review.author_workplace || review.workplace_name;
    const sentimentColor = review.sentiment === 'positive'
        ? '#10b981' : review.sentiment === 'negative' ? '#ef4444' : '#6b7280';

    const handleReplySubmit = async (e) => {
        e.preventDefault();
        if (!replyText.trim()) return;
        if (!replyEndpoint) { toast.error('Reply endpoint not configured'); return; }
        setSubmitting(true);
        try {
            const { data } = await api.post(replyEndpoint, { reply: replyText });
            setExistingReply(data.reply || replyText);
            setReplyText('');
            setShowReplyForm(false);
            toast.success('Reply posted');
            onReplyAdded?.();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to post reply');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="biz-review-card">
            <div className="biz-review-card__header">
                <div className="biz-review-author">
                    <div className={`biz-review-avatar ${isAnonymous ? 'biz-review-avatar--anon' : ''}`}>
                        {isAnonymous ? <FaUserSecret size={14} /> : <FaUser size={14} />}
                    </div>
                    <div>
                        <span className="biz-review-author-name">{authorLabel}</span>
                        {(occupationLabel || workplaceLabel) && (
                            <span className="biz-review-author-meta">
                                {occupationLabel && <span><FaBriefcase size={10} /> {occupationLabel}</span>}
                                {workplaceLabel && <span><FaBuilding size={10} /> {workplaceLabel}</span>}
                            </span>
                        )}
                    </div>
                    {isAnonymous && (
                        <span className="biz-review-badge biz-review-badge--anon">Anonymous</span>
                    )}
                    {!isAnonymous && (
                        <span className="biz-review-badge biz-review-badge--verified">Verified Employee</span>
                    )}
                </div>
                <div className="biz-review-meta">
                    <StarRating rating={review.rating} />
                    <span className="biz-review-date">
                        {review.created_at ? format(new Date(review.created_at), 'MMM d, yyyy') : ''}
                    </span>
                    {review.sentiment && (
                        <span
                            className="biz-review-sentiment"
                            style={{ background: `${sentimentColor}18`, color: sentimentColor }}
                        >
                            {review.sentiment}
                        </span>
                    )}
                </div>
            </div>

            {review.title && <h5 className="biz-review-title">{review.title}</h5>}
            <p className="biz-review-body">{review.content || review.body}</p>

            {review.pros && (
                <div className="biz-review-pros-cons">
                    <span className="biz-review-pros"><FaCheckCircle size={11} /> {review.pros}</span>
                    {review.cons && <span className="biz-review-cons"><FaTimesCircle size={11} /> {review.cons}</span>}
                </div>
            )}

            {existingReply && (
                <div className="biz-review-reply">
                    <div className="biz-review-reply__label">
                        <FaCrown size={11} /> Business response
                    </div>
                    <p>{existingReply}</p>
                </div>
            )}

            {!existingReply && replyEndpoint && (
                <div className="biz-review-reply-action">
                    {!showReplyForm ? (
                        <button
                            type="button"
                            className="btn-reply"
                            onClick={() => setShowReplyForm(true)}
                        >
                            <FaReply size={11} /> Reply publicly
                        </button>
                    ) : (
                        <form className="biz-review-reply-form" onSubmit={handleReplySubmit}>
                            <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Write a professional response visible to all usersâ€¦"
                                rows={3}
                            />
                            <div className="biz-review-reply-form__actions">
                                <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
                                    {submitting ? 'Postingâ€¦' : 'Post reply'}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-small"
                                    onClick={() => { setShowReplyForm(false); setReplyText(''); }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Claim Status Banner
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const ClaimStatusBanner = ({ company, onRefresh }) => {
    if (!company) return null;
    const isClaimed = company.is_claimed || company.claimed;
    const isVerified = company.is_verified || company.verified;

    return (
        <div className={`claim-banner ${isClaimed ? 'claim-banner--claimed' : 'claim-banner--unclaimed'}`}>
            <div className="claim-banner__icon">
                {isClaimed
                    ? <FaShieldAlt size={18} />
                    : <FaExclamationTriangle size={18} />}
            </div>
            <div className="claim-banner__text">
                <strong>
                    {isClaimed
                        ? isVerified ? 'Verified Business' : 'Claimed â€” Pending Verification'
                        : 'Unclaimed Business Profile'}
                </strong>
                <span>
                    {isClaimed
                        ? isVerified
                            ? 'Your business is verified. Customers see the verified badge on your profile.'
                            : 'Your claim is being reviewed. You\'ll be notified once verified.'
                        : 'This profile has not been claimed. Search and claim it to manage your presence.'}
                </span>
            </div>
            {isClaimed && (
                <button type="button" className="btn btn-outline btn-small" onClick={onRefresh}>
                    <FaSync size={11} /> Sync
                </button>
            )}
        </div>
    );
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Profile Section
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const ProfileSection = ({ user, company, onUpdate }) => {
    const [uploading, setUploading] = useState(false);
    const [editing, setEditing] = useState(false);
    const [occupation, setOccupation] = useState(user?.occupation || '');
    const [workplace, setWorkplace] = useState(user?.workplace || null);
    const [workplaceSearch, setWorkplaceSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const fileInputRef = useRef(null);

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.match(/image.*/)) { toast.error('Please select an image file'); return; }
        if (file.size > 2 * 1024 * 1024) { toast.error('File size must be less than 2MB'); return; }
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('avatar', file);
            const { data } = await api.post('/users/upload-avatar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            await api.patch('/users/profile', { avatarUrl: data.avatarUrl });
            toast.success('Profile picture updated!');
            onUpdate?.();
        } catch (error) {
            const message = error?.response?.data?.error || 'Failed to upload image';
            toast.error(message);
        } finally {
            setUploading(false);
        }
    };

    const searchWorkplaces = async (query) => {
        if (query.length < 2) { setSearchResults([]); return; }
        setSearching(true);
        try {
            const { data } = await api.get('/companies/search', { params: { search: query, limit: 5 } });
            setSearchResults(data.companies || []);
        } catch { /* silent */ } finally {
            setSearching(false);
        }
    };

    const handleSaveProfile = async () => {
        try {
            await api.patch('/users/profile', { occupation, workplaceId: workplace?.id || null });
            toast.success('Profile updated successfully');
            setEditing(false);
            onUpdate?.();
        } catch {
            toast.error('Failed to update profile');
        }
    };

    return (
        <div className="profile-section">
            <div className="profile-avatar-container">
                <div className="profile-avatar">
                    {user?.avatar_url ? (                        <AvatarImage src={user.avatar_url} alt={user.display_name} />
                    ) : (
                        <div className="avatar-placeholder-large">{user?.display_name?.charAt(0) || 'U'}</div>
                    )}
                    <button className="avatar-upload-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        {uploading ? <FaUpload className="spinning" /> : <FaCamera />}
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" style={{ display: 'none' }} />
                </div>

                <div className="profile-info">
                    <h3>{user?.display_name}</h3>
                    <p className="user-role">{user?.role}</p>
                    {!editing ? (
                        <>
                            {user?.occupation && <p className="user-occupation"><FaBriefcase /> {user.occupation}</p>}
                            {user?.workplace && <p className="user-workplace"><FaBuilding /> {user.workplace.name}</p>}
                            {user?.role === 'business' && company && (
                                <>
                                    <p className="user-workplace"><FaBuilding /> {company.name}</p>
                                    {company.email && <p className="user-email"><FaEnvelope /> {company.email}</p>}
                                    {company.phone && <p className="user-email"><FaPhone /> {company.phone}</p>}
                                    {company.website && <p className="user-email"><FaGlobe /> {company.website}</p>}
                                </>
                            )}
                            {(user?.role === 'employee' || user?.role === 'psychologist') && (
                                <button className="edit-profile-btn" onClick={() => setEditing(true)}>
                                    <FaEdit /> Add Work Info
                                </button>
                            )}
                        </>
                    ) : (
                        <div className="profile-edit-form">
                            <div className="form-group">
                                <label>Occupation</label>
                                <input type="text" value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="e.g., Software Engineer" />
                            </div>
                            <div className="form-group">
                                <label>Workplace</label>
                                <input
                                    type="text"
                                    value={workplaceSearch}
                                    onChange={(e) => { setWorkplaceSearch(e.target.value); searchWorkplaces(e.target.value); }}
                                    placeholder="Search for your company"
                                />
                                {searching && <div className="searching">Searching...</div>}
                                {searchResults.length > 0 && (
                                    <div className="search-results">
                                        {searchResults.map(company => (
                                            <div key={company.id} className="search-result-item"
                                                 onClick={() => { setWorkplace(company); setWorkplaceSearch(company.name); setSearchResults([]); }}>
                                                {company.logo_url && <img src={company.logo_url} alt={company.name} className="company-logo-small" />}
                                                <div>
                                                    <div className="company-name">{company.name}</div>
                                                    <div className="company-industry">{company.industry}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="form-actions">
                                <button onClick={handleSaveProfile} className="btn btn-primary btn-small">Save</button>
                                <button onClick={() => { setEditing(false); setOccupation(user?.occupation || ''); setWorkplace(user?.workplace || null); setWorkplaceSearch(''); }} className="btn btn-secondary btn-small">Cancel</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Custom Tooltip for Charts
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: '#1e1b4b', border: '1px solid #4f46e5', borderRadius: 8,
            padding: '8px 14px', fontSize: 13, color: '#e0e7ff'
        }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{label}</p>
            {payload.map((p) => (
                <p key={p.name} style={{ margin: '2px 0', color: p.color }}>
                    {p.name}: <strong>{p.value}</strong>
                </p>
            ))}
        </div>
    );
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Main Dashboard
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const Dashboard = () => {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const normalizedEmail = (user?.email || '').toLowerCase();
    const premiumExceptionActive = normalizedEmail === 'omphilemohlala@welp.com';
    const subscription = user?.subscription;
    const userRole = user?.role;
    const applicationStatus = user?.applicationStatus || user?.application_status || null;
    const planTier = (subscription?.plan_tier || subscription?.planTier || subscription?.tier || '').toLowerCase();
    const planCode = (subscription?.planCode || subscription?.plan_code || '').toLowerCase();
    const planKey = getPlanKey(user);
    const planPermissions = getPlanPermissions(user);
    const planLabel = planKey
        .replace('business_', '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
    const planTierIsPremium = planTier === 'premium';
    const isBusinessPremiumCode = planCode === 'business_premium' || planCode.startsWith('business_premium');
    const isBusinessFreeTier = user?.role === 'business' && planKey === 'business_free_tier';
    const advertisingUnlocked = user?.role === 'business' && (planPermissions.adsEnabled || planTierIsPremium || isBusinessPremiumCode || premiumExceptionActive);
    const analyticsUnlocked = user?.role === 'business' && (planPermissions.analytics || planTierIsPremium || isBusinessPremiumCode || premiumExceptionActive);
    const [userReviews, setUserReviews] = useState([]);
    const [dailyChecklist, setDailyChecklist] = useState(null);
    const [dailyChecklistLoading, setDailyChecklistLoading] = useState(false);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [myCompanies, setMyCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('reviews');
    const [error, setError] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    // Psychologist state
    const [psychLeads, setPsychLeads] = useState([]);
    const [psychSchedule, setPsychSchedule] = useState([]);
    const [psychEvents, setPsychEvents] = useState([]);
    const [psychPermissions, setPsychPermissions] = useState(null);
    const [psychRatingSummary, setPsychRatingSummary] = useState(null);
    const [calendarIntegrations, setCalendarIntegrations] = useState([]);
    const [externalEvents, setExternalEvents] = useState([]);
    const [recentCalls, setRecentCalls] = useState([]);
    const [psychRates, setPsychRates] = useState([]);
    const [isEditingRates, setIsEditingRates] = useState(false);
    const [psychRateForm, setPsychRateForm] = useState({
        15: '',
        30: '',
        60: ''
    });
    const [savingRate, setSavingRate] = useState(false);
    const [psychPayoutAccount, setPsychPayoutAccount] = useState(null);
    const [payoutForm, setPayoutForm] = useState({
        accountNumber: '',
        accountHolder: '',
        bankName: '',
        notes: '',
        countryCode: 'ZA',
        branchCode: '',
        routingNumber: '',
        swiftCode: ''
    });
    const [payoutRequirements, setPayoutRequirements] = useState(null);
    const [payoutComplete, setPayoutComplete] = useState(false);
    const [payoutProofUploading, setPayoutProofUploading] = useState(false);
    const [payoutProofUrl, setPayoutProofUrl] = useState('');
    const [availabilitySlots, setAvailabilitySlots] = useState([]);
    const [availabilityWeekStart, setAvailabilityWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [availabilitySaving, setAvailabilitySaving] = useState(false);
    const [savingPayout, setSavingPayout] = useState(false);
    const [psychPlanInfo, setPsychPlanInfo] = useState(null);
    const [psychEarnings, setPsychEarnings] = useState(null);
    const [psychStatements, setPsychStatements] = useState([]);
    const [statementGenerating, setStatementGenerating] = useState(false);
    const [calendarIntegrationDraft, setCalendarIntegrationDraft] = useState({ provider: 'google', name: '', icalUrl: '' });
    const [scheduleView, setScheduleView] = useState('week');
    const [availabilityMode, setAvailabilityMode] = useState(false);
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
    const [scheduleSaving, setScheduleSaving] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [scheduleDraft, setScheduleDraft] = useState({
        title: '',
        description: '',
        invitees: '',
        eventType: 'meeting',
        isVideoCall: false,
        date: '',
        startTime: '',
        endTime: '',
        location: ''
    });

    const hasPricingConfigured = psychRates.length > 0;

    useEffect(() => {
        if (!psychRates.length) return;
        const nextForm = { 15: '', 30: '', 60: '' };
        psychRates.forEach((rate) => {
            const minutes = Number(rate.duration_minutes || 0);
            if (!minutes) return;
            nextForm[minutes] = (Number(rate.amount_minor || 0) / 100).toFixed(2);
        });
        setPsychRateForm((prev) => ({ ...prev, ...nextForm }));
    }, [psychRates]);
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [psychCardCollapse, setPsychCardCollapse] = useState({ schedule: false, leads: false, calls: false });
    const [kycDocuments, setKycDocuments] = useState({});
    const [kycUploading, setKycUploading] = useState({});
    const [showKycModal, setShowKycModal] = useState(false);
    const [kycSubmitting, setKycSubmitting] = useState(false);
    const userKey = user ? `${user.id}:${user.role}` : null;

    const dashboardLoadKeyRef = useRef(null);

    // Business state
    const [selectedCompanyId, setSelectedCompanyId] = useState(null);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [companyPanelTab, setCompanyPanelTab] = useState('reviews');
    const [companyReviews, setCompanyReviews] = useState([]);
    const [companyReviewPagination, setCompanyReviewPagination] = useState({ page: 1, pages: 0, total: 0, limit: 10 });
    const [companyAnalytics, setCompanyAnalytics] = useState(null);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [businessSectionError, setBusinessSectionError] = useState('');
    const [companyInfoSaving, setCompanyInfoSaving] = useState(false);
    const [companyInfoMessage, setCompanyInfoMessage] = useState('');
    const [companyLogoUploading, setCompanyLogoUploading] = useState(false);
    const [editCompanyForm, setEditCompanyForm] = useState({
        phone: '',
        email: '',
        address: '',
        city: '',
        country: '',
        logo_url: '',
        website: '',
        registration_number: '',
        description: ''
    });
    const [reviewFilter, setReviewFilter] = useState({ rating: '', type: '', sort: 'newest' });
    const [apiKeys, setApiKeys] = useState([]);
    const [apiKeysLoading, setApiKeysLoading] = useState(false);
    const [apiKeyName, setApiKeyName] = useState('');
    const [newApiKey, setNewApiKey] = useState('');
    const [apiKeyError, setApiKeyError] = useState('');
    const [apiKeyCreating, setApiKeyCreating] = useState(false);
    const [apiUsage, setApiUsage] = useState(null);
    const [apiUsageLoading, setApiUsageLoading] = useState(false);

    useEffect(() => {
        if (activeTab === 'ads' && !advertisingUnlocked) {
            requirePaidBusinessOrRedirect(navigate, user, 'advertising');
            setActiveTab('reviews');
        }
    }, [activeTab, advertisingUnlocked, navigate, user]);

    /* â”€â”€ Helpers â”€â”€ */
    const formatDuration = (seconds = 0) => {
        const total = Number(seconds) || 0;
        const mins = Math.floor(total / 60);
        const secs = total % 60;
        return `${mins}m ${secs}s`;
    };

    /* â”€â”€ Business API calls â”€â”€ */
    const fetchSelectedCompanyProfile = async (companyId, options = {}) => {
        if (!companyId) return;
        try {
            const { data } = await api.get(`/business/${companyId}`, { params: { reviewLimit: 3 } });
            setSelectedCompany(data);
            setCompanyInfoMessage('');
            if (!options.skipFormUpdate) {
                setEditCompanyForm({
                    phone: data.phone || '',
                    email: data.email || '',
                    address: data.address || '',
                    city: data.city || '',
                    country: data.country || '',
                    logo_url: data.logo_url || '',
                    website: data.website || '',
                    registration_number: data.registration_number || '',
                    description: data.description || ''
                });
            }
            setBusinessSectionError('');
        } catch (err) {
            setBusinessSectionError(err.response?.data?.error || 'Failed to load business profile');
        }
    };

    const fetchBusinessReviews = async (companyId, page = 1) => {
        if (!companyId) return;
        setReviewsLoading(true);
        try {
            const params = {
                page,
                limit: companyReviewPagination.limit || 10,
                ...(reviewFilter.rating && { rating: reviewFilter.rating }),
                ...(reviewFilter.type && { type: reviewFilter.type }),
                sort: reviewFilter.sort
            };
            const { data } = await api.get(`/business/${companyId}/reviews`, { params });
            setCompanyReviews(data.reviews || []);
            setCompanyReviewPagination({
                page: data.pagination?.page || 1,
                pages: data.pagination?.pages || 1,
                total: data.pagination?.total || 0,
                limit: data.pagination?.limit || 10,
                lastViewedAt: data.lastViewedAt
            });
            setBusinessSectionError('');
        } catch (err) {
            setBusinessSectionError(err.response?.data?.error || 'Failed to load reviews');
            setCompanyReviews([]);
        } finally {
            setReviewsLoading(false);
        }
    };

    const fetchBusinessAnalytics = async (companyId) => {
        if (!companyId) return;
        setAnalyticsLoading(true);
        try {
            const { data } = await api.get(`/business/${companyId}/analytics`);
            setCompanyAnalytics(data);
            setBusinessSectionError('');
        } catch (err) {
            setBusinessSectionError(err.response?.data?.error || 'Failed to load analytics');
            setCompanyAnalytics(null);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const fetchBusinessApiUsage = async (companyId) => {
        if (!companyId) return;
        setApiUsageLoading(true);
        try {
            const { data } = await api.get(`/business/${companyId}/api-usage`);
            setApiUsage(data);
            setApiKeyError('');
        } catch (err) {
            setApiUsage(null);
            setApiKeyError(err.response?.data?.error || 'Failed to load API usage');
        } finally {
            setApiUsageLoading(false);
        }
    };

    const handleBusinessReviewPageChange = (direction) => {
        const nextPage = (companyReviewPagination.page || 1) + direction;
        if (nextPage < 1 || nextPage > (companyReviewPagination.pages || 1)) return;
        fetchBusinessReviews(selectedCompanyId, nextPage);
    };

    const handleCompanyInfoChange = (field, value) => {
        if (field === 'website') {
            const trimmed = value.trim();
            if (trimmed && !/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('http')) {
                setEditCompanyForm((prev) => ({ ...prev, [field]: trimmed }));
                return;
            }
        }
        setEditCompanyForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleCompanyInfoSubmit = async (event) => {
        event.preventDefault();
        if (!selectedCompanyId) return;
        setCompanyInfoSaving(true);
        setCompanyInfoMessage('');
        try {
            console.log('[BusinessHub] Save attempt', { companyId: selectedCompanyId, payload: editCompanyForm });
            const { data } = await api.put(`/business/${selectedCompanyId}`, editCompanyForm);
            setSelectedCompany(data);
            setMyCompanies((prev) =>
                Array.isArray(prev) ? prev.map((c) => (c.id === data.id ? data : c)) : prev
            );
            setEditCompanyForm({
                phone: data.phone || '',
                email: data.email || '',
                address: data.address || '',
                city: data.city || '',
                country: data.country || '',
                logo_url: data.logo_url || '',
                website: data.website || '',
                registration_number: data.registration_number || '',
                description: data.description || ''
            });
            fetchSelectedCompanyProfile(data.id, { skipFormUpdate: false });
            setCompanyInfoMessage('Business profile updated.');
            toast.success('Business info updated');
        } catch (err) {
            const message = err.response?.data?.error || 'Failed to update business info';
            setCompanyInfoMessage(message);
            console.error('[BusinessHub] Save failed', err);
            toast.error(message);
        } finally {
            setCompanyInfoSaving(false);
        }
    };

    const handleCompanyLogoUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file || !selectedCompanyId) return;
        if (!file.type.match(/image.*/)) { toast.error('Please select an image file'); return; }
        if (file.size > 2 * 1024 * 1024) { toast.error('File size must be less than 2MB'); return; }
        setCompanyLogoUploading(true);
        try {
            const formData = new FormData();
            formData.append('logo', file);
            const { data } = await api.post(`/business/${selectedCompanyId}/logo`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const logoUrl = data.logoUrl || data.company?.logo_url;
            if (logoUrl) {
                setEditCompanyForm((prev) => ({ ...prev, logo_url: logoUrl }));
                setSelectedCompany((prev) => prev ? { ...prev, logo_url: logoUrl } : prev);
                setMyCompanies((prev) =>
                    Array.isArray(prev) ? prev.map((c) => (c.id === selectedCompanyId ? { ...c, logo_url: logoUrl } : c)) : prev
                );
                toast.success('Logo updated');
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to upload logo');
        } finally {
            setCompanyLogoUploading(false);
            event.target.value = '';
        }
    };

    const fetchCompanyApiKeys = async (companyId) => {
        if (!companyId) return;
        setApiKeysLoading(true);
        setApiKeyError('');
        try {
            const { data } = await api.get(`/business/${companyId}/api-keys`);
            setApiKeys(data.keys || []);
        } catch (err) {
            setApiKeyError(err.response?.data?.error || 'Failed to load API keys');
            setApiKeys([]);
        } finally {
            setApiKeysLoading(false);
        }
    };

    const handleCreateApiKey = async (event) => {
        event.preventDefault();
        if (!selectedCompanyId) return;
        setApiKeyCreating(true);
        setApiKeyError('');
        try {
            const { data } = await api.post(`/business/${selectedCompanyId}/api-keys`, { name: apiKeyName });
            if (data.apiKey) {
                setApiKeys((prev) => [data.apiKey, ...prev]);
            }
            setNewApiKey(data.key || '');
            setApiKeyName('');
            toast.success('API key created');
        } catch (err) {
            setApiKeyError(err.response?.data?.error || 'Failed to create API key');
        } finally {
            setApiKeyCreating(false);
        }
    };

    const handleRevokeApiKey = async (keyId) => {
        if (!selectedCompanyId) return;
        try {
            const { data } = await api.delete(`/business/${selectedCompanyId}/api-keys/${keyId}`);
            setApiKeys((prev) => prev.map((k) => (k.id === keyId ? data.apiKey : k)));
            toast.success('API key revoked');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to revoke API key');
        }
    };

    const handleScrapeMissingInfo = async () => {
        if (!selectedCompanyId) return;
        setCompanyInfoSaving(true);
        setCompanyInfoMessage('');
        try {
            const { data } = await api.post(`/companies/${selectedCompanyId}/scrape-missing`);
            const updated = data.company || data;
            setSelectedCompany(updated);
            setEditCompanyForm({
                phone: updated.phone || '',
                email: updated.email || '',
                address: updated.address || '',
                city: updated.city || '',
                country: updated.country || '',
                logo_url: updated.logo_url || '',
                website: updated.website || '',
                registration_number: updated.registration_number || '',
                description: updated.description || ''
            });
            setCompanyInfoMessage('Latest website data applied.');
            toast.success('Company info refreshed from website');
        } catch (err) {
            const message = err.response?.data?.error || 'Unable to refresh company info';
            setCompanyInfoMessage(message);
            toast.error(message);
        } finally {
            setCompanyInfoSaving(false);
        }
    };

    // Sync claim status from backend
    const syncClaimStatus = async (companyId) => {
        if (!companyId) return;
        try {
            const { data } = await api.get(`/companies/${companyId}/claim-status`);
            setMyCompanies((prev) =>
                Array.isArray(prev)
                    ? prev.map((c) =>
                        c.id === companyId
                            ? { ...c, is_claimed: data.is_claimed, is_verified: data.is_verified, claimed: data.claimed, verified: data.verified }
                            : c
                    )
                    : prev
            );
            setSelectedCompany((prev) =>
                prev?.id === companyId
                    ? { ...prev, is_claimed: data.is_claimed, is_verified: data.is_verified }
                    : prev
            );
            toast.success('Claim status synced');
        } catch {
            // Fallback: re-fetch company profile
            fetchSelectedCompanyProfile(companyId, { skipFormUpdate: true });
        }
    };

    const refreshBusinessSections = () => {
        if (!selectedCompanyId) return;
        fetchSelectedCompanyProfile(selectedCompanyId, { skipFormUpdate: true });
        fetchBusinessReviews(selectedCompanyId, companyReviewPagination.page || 1);
        if (analyticsUnlocked) {
            fetchBusinessAnalytics(selectedCompanyId);
        }
        fetchCompanyApiKeys(selectedCompanyId);
        if (companyPanelTab === 'api') {
            fetchBusinessApiUsage(selectedCompanyId);
        }
    };

    /* â”€â”€ Chart data â”€â”€ */
    const ratingChartData = companyAnalytics
        ? Object.entries(companyAnalytics.ratingDistribution || {}).map(([rating, count]) => ({
            rating: `${rating}â˜…`,
            count: Number(count || 0)
        }))
        : [];

    const trendChartData = companyAnalytics
        ? (companyAnalytics.trend || []).map((point) => ({
            label: point.bucket ? format(new Date(point.bucket), 'MMM yy') : 'N/A',
            count: Number(point.count || 0)
        }))
        : [];

    const reviewerBreakdown = companyAnalytics
        ? [
            { name: 'Employee', value: Number(companyAnalytics.employeeVsAnonymous?.employee || 0) },
            { name: 'Anonymous', value: Number(companyAnalytics.employeeVsAnonymous?.anonymous || 0) }
        ]
        : [];

    const sentimentData = companyAnalytics?.sentimentBreakdown
        ? [
            { name: 'Positive', value: Number(companyAnalytics.sentimentBreakdown.positive || 0), color: '#10b981' },
            { name: 'Neutral', value: Number(companyAnalytics.sentimentBreakdown.neutral || 0), color: '#6b7280' },
            { name: 'Negative', value: Number(companyAnalytics.sentimentBreakdown.negative || 0), color: '#ef4444' }
        ]
        : [];
    const availabilityMap = useMemo(() => {
        const map = new Map();
        availabilitySlots.forEach((slot) => {
            map.set(`${slot.dayOfWeek}-${slot.hour}`, slot.isAvailable);
        });
        return map;
    }, [availabilitySlots]);


    useEffect(() => {
        if (user?.role !== 'psychologist') return;
        const weekStart = startOfWeek(calendarDate, { weekStartsOn: 1 });
        if (weekStart.getTime() !== availabilityWeekStart.getTime()) {
            setAvailabilityWeekStart(weekStart);
        }
    }, [calendarDate, user?.role]);
    /* â”€â”€ Lifecycle â”€â”€ */
    useEffect(() => {
        if (!userKey) {
            dashboardLoadKeyRef.current = null;
            return;
        }
        if (dashboardLoadKeyRef.current === userKey) return;
        dashboardLoadKeyRef.current = userKey;
        if (userRole === 'psychologist') setActiveTab('overview');
        else if (userRole === 'business') setActiveTab('companies');
        else setActiveTab('reviews');
        fetchDashboardData();
        // only re-run when the authenticated user identity or role changes
    }, [userKey, userRole]);

    useEffect(() => {
        if (user?.role !== 'psychologist') return;
        api.get('/psychologists/dashboard/availability', {
            params: { weekStart: availabilityWeekStart.toISOString().slice(0, 10) }
        })
            .then((res) => setAvailabilitySlots(res.data?.availability || []))
            .catch(() => setAvailabilitySlots([]));
    }, [availabilityWeekStart, user?.role]);

    useEffect(() => {
        if (user?.role === 'business' && selectedCompanyId) {
            fetchSelectedCompanyProfile(selectedCompanyId);
            fetchBusinessReviews(selectedCompanyId, 1);
            if (analyticsUnlocked) {
                fetchBusinessAnalytics(selectedCompanyId);
            }
            fetchCompanyApiKeys(selectedCompanyId);
            if (companyPanelTab === 'api') {
                fetchBusinessApiUsage(selectedCompanyId);
            }
            setNewApiKey('');
            setApiKeyError('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCompanyId, user?.role]);

    useEffect(() => {
        if (companyPanelTab === 'api' && selectedCompanyId && user?.role === 'business') {
            fetchBusinessApiUsage(selectedCompanyId);
        }
    }, [companyPanelTab, selectedCompanyId, user?.role]);

    // Re-fetch reviews when filter changes
    useEffect(() => {
        if (selectedCompanyId && user?.role === 'business') {
            fetchBusinessReviews(selectedCompanyId, 1);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reviewFilter]);

    const fetchDashboardData = async () => {
        setLoading(true);
        setError('');
        try {
            if (user?.role === 'employee') {
                const [reviewsRes, requestsRes] = await Promise.all([
                    api.get('/reviews/my-reviews'),
                    api.get('/messages/conversations/pending').catch(() => ({ data: [] }))
                ]);
                setUserReviews(reviewsRes.data?.reviews || []);
                setPendingRequests(requestsRes.data || []);
                await fetchDailyChecklist();
            } else if (user?.role === 'business') {
                const companiesRes = await api.get('/companies/my-companies');
                const companies = companiesRes.data || [];
                setMyCompanies(companies);
                if (companies.length) {
                    setSelectedCompanyId((prev) => prev || companies[0].id);
                }
            } else if (user?.role === 'psychologist') {
                const [
                    pendingRes,
                    leadsRes,
                    scheduleRes,
                    eventsRes,
                    permissionsRes,
                    ratesRes,
                    payoutRes,
                    planRes,
                    earningsRes,
                    statementsRes,
                    availabilityRes
                ] = await Promise.all([
                    api.get('/messages/conversations/pending').catch(() => ({ data: [] })),
                    api.get('/psychologists/dashboard/leads').catch(() => ({ data: [] })),
                    api.get('/psychologists/dashboard/schedule').catch(() => ({ data: [] })),
                    api.get(`/psychologists/${user.id}/events`).catch(() => ({ data: { events: [] } })),
                    api.get('/psychologists/dashboard/permissions').catch(() => ({ data: null })),
                    api.get('/psychologists/dashboard/rates').catch(() => ({ data: { rates: [] } })),
                    api.get('/psychologists/dashboard/payout-account').catch(() => ({ data: { account: null } })),
                    api.get('/psychologists/dashboard/plan').catch(() => ({ data: null })),
                    api.get('/psychologists/dashboard/earnings').catch(() => ({ data: null })),
                    api.get('/psychologists/dashboard/statements').catch(() => ({ data: { statements: [] } })),
                    api.get('/psychologists/dashboard/availability', {
                        params: { weekStart: availabilityWeekStart.toISOString().slice(0, 10) }
                    }).catch(() => ({ data: { availability: [] } }))
                ]);
                setPendingRequests(pendingRes.data || []);
                setPsychLeads(leadsRes.data || []);
                setPsychSchedule(scheduleRes.data || []);
                setPsychEvents(eventsRes.data?.events || []);
                setPsychPermissions(permissionsRes.data || null);
                const loadedRates = ratesRes.data?.rates || [];
                setPsychRates(loadedRates);
                const rateMap = loadedRates.reduce((acc, rate) => {
                    const minutes = Number(rate.duration_minutes || rate.durationMinutes);
                    if ([15, 30, 60].includes(minutes)) {
                        acc[minutes] = (Number(rate.amount_minor || 0) / 100).toFixed(2);
                    }
                    return acc;
                }, { 15: '', 30: '', 60: '' });
                setPsychRateForm(rateMap);
                setPsychPayoutAccount(payoutRes.data?.account || null);
                setPayoutRequirements(payoutRes.data?.requirements || null);
                setPayoutComplete(Boolean(payoutRes.data?.isComplete));
                setPayoutProofUrl(payoutRes.data?.account?.proof_document_url || '');
                if (payoutRes.data?.account) {
                    setPayoutForm({
                        accountNumber: payoutRes.data.account.account_number || '',
                        accountHolder: payoutRes.data.account.account_holder || '',
                        bankName: payoutRes.data.account.bank_name || '',
                        notes: payoutRes.data.account.notes || '',
                        countryCode: payoutRes.data.account.country_code || 'ZA',
                        branchCode: payoutRes.data.account.branch_code || '',
                        routingNumber: payoutRes.data.account.routing_number || '',
                        swiftCode: payoutRes.data.account.swift_code || ''
                    });
                }
                setPsychPlanInfo(planRes.data || null);
                setPsychEarnings(earningsRes.data || null);
                setPsychStatements(statementsRes.data?.statements || []);
                const ratingsRes = await api.get('/psychologists/dashboard/ratings/summary').catch(() => ({ data: null }));
                setPsychRatingSummary(ratingsRes.data || null);
                const integrationsRes = await api.get('/psychologists/dashboard/calendar-integrations').catch(() => ({ data: [] }));
                setCalendarIntegrations(integrationsRes.data || []);
                const callsRes = await api.get('/psychologists/dashboard/calls').catch(() => ({ data: [] }));
                setRecentCalls(callsRes.data || []);
                setAvailabilitySlots(availabilityRes.data?.availability || []);
            }
        } catch (err) {
            setError('Failed to load dashboard data');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDailyChecklist = async () => {
        setDailyChecklistLoading(true);
        try {
            const { data } = await api.get('/reviews/daily-checklist');
            setDailyChecklist(data);
        } catch (error) {
            console.error('Failed to load daily checklist', error);
            setDailyChecklist(null);
        } finally {
            setDailyChecklistLoading(false);
        }
    };

    const openDailyReview = () => {
        const workplaceId = user?.workplace?.id || user?.workplace_id || dailyChecklist?.workplaceId;
        if (workplaceId) {
            window.location.href = `/companies/${workplaceId}?reviewTab=daily_work_review`;
        } else {
            toast.error('Add a workplace in your profile to submit daily reviews.');
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            if (typeof refreshUser === 'function') {
                await refreshUser();
            }
            await fetchDashboardData();
            toast.success('Dashboard refreshed!');
        } catch (err) {
            console.error('Dashboard refresh failed:', err);
            toast.error('Unable to refresh dashboard right now');
        } finally {
            setRefreshing(false);
        }
    };

    const handleAcceptRequest = async (conversationId) => {
        try {
            await api.patch(`/messages/conversations/${conversationId}/status`, { status: 'accepted' });
            toast.success('Message request accepted!');
            fetchDashboardData();
        } catch { toast.error('Failed to accept request'); }
    };

    const handleRejectRequest = async (conversationId) => {
        try {
            await api.patch(`/messages/conversations/${conversationId}/status`, { status: 'rejected' });
            toast.success('Message request rejected');
            fetchDashboardData();
        } catch { toast.error('Failed to reject request'); }
    };

    /* â”€â”€ Psychologist schedule handlers â”€â”€ */
    const openScheduleModalForSlot = (day, hour) => {
        const date = format(day, 'yyyy-MM-dd');
        const startTime = `${String(hour).padStart(2, '0')}:00`;
        const endHour = hour + 1;
        const endTime = endHour >= 24 ? '00:00' : `${String(endHour).padStart(2, '0')}:00`;
        setSelectedSlot({ day, hour });
        setScheduleDraft({
            title: '',
            description: '',
            invitees: '',
            eventType: 'meeting',
            isVideoCall: false,
            date,
            startTime,
            endTime,
            location: ''
        });
        setScheduleModalOpen(true);
    };

    const closeScheduleModal = () => {
        setScheduleModalOpen(false);
        setSelectedSlot(null);
        setScheduleDraft({
            title: '',
            description: '',
            invitees: '',
            eventType: 'meeting',
            isVideoCall: false,
            date: '',
            startTime: '',
            endTime: '',
            location: ''
        });
    };

    const handleScheduleSubmit = async (e) => {
        e.preventDefault();
        if (isPsychRestricted) {
            toast.error('Your account is restricted until KYC is approved.');
            return;
        }
        if (!scheduleDraft.title || !scheduleDraft.date || !scheduleDraft.startTime || !scheduleDraft.endTime) {
            toast.error('Please complete title, start, and end time.');
            return;
        }
        const startsAtLocal = new Date(`${scheduleDraft.date}T${scheduleDraft.startTime}`);
        const endsAtLocal = new Date(`${scheduleDraft.date}T${scheduleDraft.endTime}`);
        if (Number.isNaN(startsAtLocal.getTime()) || Number.isNaN(endsAtLocal.getTime())) {
            toast.error('Invalid time selection.');
            return;
        }
        if (endsAtLocal <= startsAtLocal) {
            endsAtLocal.setDate(endsAtLocal.getDate() + 1);
        }
        setScheduleSaving(true);
        try {
            const { data } = await api.post(`/psychologists/${user.id}/events`, {
                title: scheduleDraft.title,
                description: scheduleDraft.description,
                location: scheduleDraft.location,
                startsAt: startsAtLocal.toISOString(),
                endsAt: endsAtLocal.toISOString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Johannesburg',
                eventType: scheduleDraft.eventType,
                isVideoCall: scheduleDraft.isVideoCall,
                invitees: scheduleDraft.invitees
            });
            const nextEvent = data?.event || data;
            if (nextEvent) {
                setPsychEvents((prev) => [...prev, nextEvent].sort((a, b) => new Date(a.starts_at || a.startsAt) - new Date(b.starts_at || b.startsAt)));
            }
            setCalendarDate(startsAtLocal);
            toast.success('Event scheduled and invites sent');
            closeScheduleModal();
        } catch (error) {
            const message = error?.response?.data?.error || 'Failed to schedule event';
            toast.error(message);
        } finally {
            setScheduleSaving(false);
        }
    };

    const handleScheduleRemove = async (itemId) => {
        if (isPsychRestricted) {
            toast.error('Your account is restricted until KYC is approved.');
            return;
        }
        try {
            await api.delete(`/psychologists/dashboard/schedule/${itemId}`);
            setPsychSchedule((prev) => prev.filter((item) => item.id !== itemId));
            toast.success('Schedule item removed');
        } catch { toast.error('Failed to remove schedule item'); }
    };

    const handleRateSubmit = async (durationMinutes) => {
        const amount = psychRateForm[durationMinutes];
        if (!amount) {
            toast.error('Enter a rate amount.');
            return;
        }
        if (Number(amount) <= 0) {
            toast.error('Rate amount must be greater than 0.');
            return;
        }
        setSavingRate(true);
        try {
            const currencyCode = currencyForCountry(payoutForm.countryCode || 'ZA').code;
            await api.post('/psychologists/dashboard/rates', {
                amount,
                durationMinutes,
                currencyCode
            });
            const { data } = await api.get('/psychologists/dashboard/rates');
            setPsychRates(data?.rates || []);
            toast.success('Rate saved');
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to save rate');
        } finally {
            setSavingRate(false);
        }
    };

    const handlePayoutSubmit = async (event) => {
        event.preventDefault();
        setSavingPayout(true);
        try {
            const { data } = await api.post('/psychologists/dashboard/payout-account', {
                accountNumber: payoutForm.accountNumber,
                accountHolder: payoutForm.accountHolder,
                bankName: payoutForm.bankName,
                notes: payoutForm.notes,
                countryCode: payoutForm.countryCode,
                branchCode: payoutForm.branchCode,
                routingNumber: payoutForm.routingNumber,
                swiftCode: payoutForm.swiftCode
            });
            setPsychPayoutAccount(data?.account || null);
            setPayoutRequirements(data?.requirements || null);
            setPayoutComplete(Boolean(data?.isComplete));
            toast.success('Payout details saved');
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to save payout details');
        } finally {
            setSavingPayout(false);
        }
    };

    const handlePayoutProofUpload = async (file) => {
        if (!file) return;
        setPayoutProofUploading(true);
        try {
            const formData = new FormData();
            formData.append('proof', file);
            const { data } = await api.post('/psychologists/dashboard/payout-account/proof', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setPsychPayoutAccount(data?.account || null);
            setPayoutProofUrl(data?.account?.proof_document_url || '');
            setPayoutComplete(Boolean(data?.isComplete));
            toast.success('Proof of account uploaded');
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to upload proof');
        } finally {
            setPayoutProofUploading(false);
        }
    };

    const handleAvailabilityToggle = (dayOfWeek, hour) => {
        if (isPsychRestricted) {
            toast.error('Your account is restricted until KYC is approved.');
            return;
        }
        setAvailabilitySlots((prev) => {
            let updated = false;
            const next = prev.map((slot) => {
                if (slot.dayOfWeek === dayOfWeek && slot.hour === hour) {
                    updated = true;
                    return { ...slot, isAvailable: !slot.isAvailable };
                }
                return slot;
            });
            if (!updated) {
                next.push({ dayOfWeek, hour, isAvailable: true });
            }
            return next;
        });
    };

    const handleAvailabilitySave = async () => {
        setAvailabilitySaving(true);
        try {
            await api.post('/psychologists/dashboard/availability', {
                slots: availabilitySlots
            });
            toast.success('Availability updated');
        } catch (error) {
            toast.error('Failed to save availability');
        } finally {
            setAvailabilitySaving(false);
        }
    };

    const handleGenerateStatement = async () => {
        setStatementGenerating(true);
        try {
            const nowDate = new Date();
            const payload = {
                year: nowDate.getUTCFullYear(),
                month: nowDate.getUTCMonth() + 1
            };
            await api.post('/psychologists/dashboard/statements', payload);
            const { data } = await api.get('/psychologists/dashboard/statements');
            setPsychStatements(data?.statements || []);
            toast.success('Statement generated');
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to generate statement');
        } finally {
            setStatementGenerating(false);
        }
    };

    const handleLeadMessage = async (leadId) => {
        if (isPsychRestricted) {
            toast.error('Your account is restricted until KYC is approved.');
            return;
        }
        try {
            await api.post(`/psychologists/dashboard/leads/${leadId}/message`, {
                message: 'Hello, I am here to support you whenever you are ready to talk.'
            });
            toast.success('Message queued');
        } catch { toast.error('Failed to send lead message'); }
    };

    const handleLeadArchive = async (leadId) => {
        if (isPsychRestricted) {
            toast.error('Your account is restricted until KYC is approved.');
            return;
        }
        try {
            await api.patch(`/psychologists/dashboard/leads/${leadId}/archive`);
            setPsychLeads((prev) => prev.filter((lead) => lead.id !== leadId));
            toast.success('Lead removed');
        } catch { toast.error('Failed to remove lead'); }
    };

    const handleAddCalendarIntegration = async (e) => {
        e.preventDefault();
        if (isPsychRestricted) {
            toast.error('Your account is restricted until KYC is approved.');
            return;
        }
        if (!calendarIntegrationDraft.icalUrl) { toast.error('Please add an iCal URL'); return; }
        try {
            const { data } = await api.post('/psychologists/dashboard/calendar-integrations', {
                provider: calendarIntegrationDraft.provider,
                name: calendarIntegrationDraft.name || calendarIntegrationDraft.provider,
                icalUrl: calendarIntegrationDraft.icalUrl
            });
            setCalendarIntegrations((prev) => [data, ...prev]);
            setCalendarIntegrationDraft({ provider: 'google', name: '', icalUrl: '' });
            toast.success('Calendar connected');
            await handleSyncCalendarIntegration(data.id);
        } catch { toast.error('Failed to connect calendar'); }
    };

    const handleRemoveCalendarIntegration = async (integrationId) => {
        if (isPsychRestricted) {
            toast.error('Your account is restricted until KYC is approved.');
            return;
        }
        try {
            await api.delete(`/psychologists/dashboard/calendar-integrations/${integrationId}`);
            setCalendarIntegrations((prev) => prev.filter((item) => item.id !== integrationId));
            setExternalEvents((prev) => prev.filter((item) => item.integration_id !== integrationId));
            toast.success('Calendar removed');
        } catch { toast.error('Failed to remove calendar'); }
    };

    const handleSyncCalendarIntegration = async (integrationId) => {
        if (isPsychRestricted) {
            toast.error('Your account is restricted until KYC is approved.');
            return;
        }
        try {
            const { data } = await api.post(`/psychologists/dashboard/calendar-integrations/${integrationId}/sync`);
            const events = (data.events || []).map((event) => ({ ...event, integration_id: integrationId }));
            setExternalEvents((prev) => [
                ...prev.filter((item) => item.integration_id !== integrationId),
                ...events
            ]);
            toast.success(`Synced ${data.count || events.length} events`);
        } catch { toast.error('Failed to sync calendar'); }
    };

    const handleDownloadIcs = () => {
        const base = api.defaults.baseURL || '';
        window.open(`${base}/psychologists/dashboard/schedule.ics`, '_blank');
    };

    const handleCallAction = (type) => {
        if (!psychPermissions?.roleFlags?.voice_video_calls) {
            toast.error('Call features are not enabled for your plan.'); return;
        }
        toast(`${type === 'voice' ? 'Voice' : 'Video'} call setup is in progress â€” a link will be emailed shortly.`);
    };

    /* â”€â”€ Calendar helpers â”€â”€ */
    const scheduleEntries = [
        ...psychSchedule.map((item) => {
            const raw = item.scheduled_for || item.scheduledFor || item.scheduled_at;
            const start = raw ? new Date(raw) : null;
            if (!start || Number.isNaN(start.getTime())) return null;
            const end = new Date(start.getTime() + 60 * 60 * 1000);
            return {
                id: item.id,
                title: item.title,
                type: item.type || 'meeting',
                source: 'legacy',
                location: item.location || '',
                startsAt: start,
                endsAt: end
            };
        }),
        ...psychEvents.map((event) => {
            const start = event.starts_at || event.startsAt;
            const end = event.ends_at || event.endsAt;
            const startDate = start ? new Date(start) : null;
            const endDate = end ? new Date(end) : null;
            if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
            return {
                id: event.id,
                title: event.title,
                type: event.event_type || event.eventType || 'meeting',
                source: 'event',
                isVideoCall: Boolean(event.is_video_call ?? event.isVideoCall),
                location: event.location || '',
                startsAt: startDate,
                endsAt: endDate
            };
        }),
        ...externalEvents.map((item, index) => {
            const start = item.starts_at || item.startsAt;
            const end = item.ends_at || item.endsAt;
            const startDate = start ? new Date(start) : null;
            const endDate = end ? new Date(end) : null;
            if (!startDate || !endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
            return {
                id: item.id || `external-${index}`,
                title: item.title || 'External event',
                type: 'external',
                source: 'external',
                location: item.location || '',
                startsAt: startDate,
                endsAt: endDate
            };
        })
    ].filter(Boolean).sort((a, b) => a.startsAt - b.startsAt);

    const weekStartsOn = 1;
    const calendarStart = startOfWeek(calendarDate, { weekStartsOn });
    const calendarEnd = endOfWeek(calendarDate, { weekStartsOn });
    const calendarDays = Array.from({ length: 7 }, (_, idx) => addDays(calendarStart, idx));
    const weekLabel = `${format(calendarStart, 'MMM d')} - ${format(calendarEnd, 'MMM d')}`;
    const agendaItems = scheduleEntries.filter((entry) => entry.startsAt >= calendarStart && entry.startsAt <= calendarEnd);

    const handleCalendarPrev = () => setCalendarDate((prev) => subWeeks(prev, 1));
    const handleCalendarNext = () => setCalendarDate((prev) => addWeeks(prev, 1));
    const handleCalendarToday = () => setCalendarDate(new Date());
    const togglePsychCard = (key) => setPsychCardCollapse((prev) => ({ ...prev, [key]: !prev[key] }));
    const kycStatus = user?.kyc_status || applicationStatus?.kyc_status || (user?.documents_submitted ? 'pending' : 'not_submitted');
    const isPsychApproved = userRole === 'psychologist'
        && user?.can_use_profile === true
        && String(kycStatus || '').toLowerCase() === 'approved';
    const isPsychRestricted = userRole === 'psychologist' && !isPsychApproved;
    const needsKycUpload = userRole === 'psychologist'
        && (!user?.documents_submitted || String(kycStatus || '').toLowerCase() !== 'approved');
    const handleKycUpload = async (type, file) => {
        if (!file) return;
        setKycUploading((prev) => ({ ...prev, [type]: true }));
        try {
            const formData = new FormData();
            formData.append('document', file);
            const { data } = await api.post('/applications/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setKycDocuments((prev) => ({
                ...prev,
                [type]: {
                    type,
                    label: PSY_KYC_DOCUMENTS.find((doc) => doc.type === type)?.label || type,
                    url: data.url,
                    filename: file.name,
                    uploadedAt: new Date().toISOString()
                }
            }));
            toast.success('Document uploaded');
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to upload document');
        } finally {
            setKycUploading((prev) => ({ ...prev, [type]: false }));
        }
    };

    const handleKycSubmit = async () => {
        if (!Object.keys(kycDocuments).length) {
            toast.error('Upload at least one document');
            return;
        }
        setKycSubmitting(true);
        try {
            await api.post('/psychologists/documents', {
                documents: Object.values(kycDocuments)
            });
            toast.success('Documents submitted for review');
            setShowKycModal(false);
            setKycDocuments({});
            await refreshUser();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to submit documents');
        } finally {
            setKycSubmitting(false);
        }
    };

    if (loading) return <Loading />;

    const outgoingRequests = pendingRequests.filter((r) => r.initial_message?.senderId === user?.id);
    const incomingRequests = pendingRequests.filter((r) => r.initial_message?.senderId && r.initial_message?.senderId !== user?.id);
    const shouldShowApplicationBanner = Boolean(
        applicationStatus && ['business', 'psychologist'].includes((userRole || '').toLowerCase())
    );
    const outstandingSteps = shouldShowApplicationBanner && applicationStatus?.checklist
        ? Object.entries(applicationStatus.checklist).filter(([, step]) => !step.verified)
        : [];
    const lastTimelineEvent = applicationStatus?.timeline?.length
        ? applicationStatus.timeline[applicationStatus.timeline.length - 1]
        : null;

    /* â”€â”€ Analytics summary stats â”€â”€ */
    const avgRating = companyAnalytics?.averageRating
        ? parseFloat(companyAnalytics.averageRating).toFixed(1)
        : 'â€”';
    const totalReviews = companyAnalytics?.totalReviews ?? 'â€”';
    const responseRate = companyAnalytics?.responseRate != null
        ? `${(companyAnalytics.responseRate * 100).toFixed(0)}%`
        : 'â€”';
    const anonymousRate = companyAnalytics
        ? (() => {
            const total = (companyAnalytics.employeeVsAnonymous?.employee || 0) +
                (companyAnalytics.employeeVsAnonymous?.anonymous || 0);
            if (!total) return 'â€”';
            return `${((companyAnalytics.employeeVsAnonymous?.anonymous || 0) / total * 100).toFixed(0)}%`;
        })()
        : 'â€”';

    return (
        <>
        <div className="dashboard-page">
            <div className="container">
                {/* Header */}
                <div className="dashboard-header">
                    <h1 className="dashboard-title">Dashboard</h1>
                    <button onClick={handleRefresh} className="refresh-btn" disabled={refreshing}>
                        {refreshing ? 'Refreshingâ€¦' : 'Refresh'}
                    </button>
                </div>

                {error && <div className="alert alert-error">{error}</div>}
                {isPsychRestricted && (
                    <div className="alert alert-warning">
                        Your account is restricted until KYC documents are completed and approved.
                    </div>
                )}
                {shouldShowApplicationBanner && applicationStatus && (
                    <div
                        className="application-status-card"
                        style={{
                            marginBottom: '1.5rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '16px',
                            padding: '1.25rem',
                            background: '#f8fafc'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>Verification status</p>
                                <h3 style={{ margin: '0.25rem 0' }}>{applicationStatus.statusLabel}</h3>
                                <p style={{ margin: 0, color: '#475569' }}>
                                    Submitted {applicationStatus.submittedAt ? format(new Date(applicationStatus.submittedAt), 'MMM d, yyyy') : 'â€”'} Â· {applicationStatus.profile_type}
                                </p>
                            </div>
                            <div style={{ minWidth: '200px' }}>
                                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Checklist progress</span>
                                <div style={{ marginTop: '0.35rem', height: '8px', background: '#e2e8f0', borderRadius: '999px' }}>
                                    <div
                                        style={{
                                            width: `${applicationStatus.verificationProgress || 0}%`,
                                            height: '100%',
                                            borderRadius: '999px',
                                            background: '#2563eb'
                                        }}
                                    />
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                                    {applicationStatus.verificationProgress || 0}% complete
                                </div>
                            </div>
                        </div>
                        {applicationStatus.adminNotes && (
                            <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', borderRadius: '12px', background: '#fff', border: '1px solid #e2e8f0' }}>
                                <strong>Reviewer notes:</strong> {applicationStatus.adminNotes}
                            </div>
                        )}
                        <div style={{ marginTop: '0.75rem' }}>
                            <strong>Next steps:</strong>
                            {outstandingSteps.length > 0 ? (
                                <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.25rem', color: '#475569' }}>
                                    {outstandingSteps.map(([key]) => (
                                        <li key={key}>{VERIFICATION_STEP_LABELS[key] || key}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p style={{ margin: '0.35rem 0 0', color: '#475569' }}>All verification steps are complete. Our team will finalize your application shortly.</p>
                            )}
                        </div>
                        {lastTimelineEvent && (
                            <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                                Last update: {lastTimelineEvent.label} on {lastTimelineEvent.at ? format(new Date(lastTimelineEvent.at), 'MMM d, yyyy HH:mm') : 'â€”'}
                            </p>
                        )}
                    </div>
                )}
                {userRole === 'psychologist' && (
                    <div
                        className="application-status-card"
                        style={{
                            marginBottom: '1.5rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '16px',
                            padding: '1.25rem',
                            background: '#fff'
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>KYC status</p>
                                <h3 style={{ margin: '0.25rem 0' }}>{kycStatus || 'not_submitted'}</h3>
                                <p style={{ margin: 0, color: '#475569' }}>
                                    Documents {user?.documents_submitted ? 'submitted' : 'not submitted'} â€¢ Profile {user?.can_use_profile ? 'active' : 'restricted'}
                                </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {needsKycUpload && (
                                    <button className="btn btn-primary" onClick={() => setShowKycModal(true)}>
                                        {user?.documents_submitted ? 'Update Documents' : 'Upload Documents'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <ProfileSection
                    user={user}
                    company={selectedCompany}
                    onUpdate={async () => {
                        if (typeof refreshUser === 'function') {
                            await refreshUser();
                        }
                        await fetchDashboardData();
                    }}
                />
                {/* Tabs */}
                <div className="dashboard-tabs">
                    {user?.role === 'employee' && (
                        <>
                            <button className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}>
                                My Reviews ({userReviews.length})
                            </button>
                            <button className={`tab-btn ${activeTab === 'messages' ? 'active' : ''}`} onClick={() => setActiveTab('messages')}>
                                Message Requests ({pendingRequests.length})
                            </button>
                            <button className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                                Profile Settings
                            </button>
                        </>
                    )}
                    {user?.role === 'business' && (
                        <>
                            <button className={`tab-btn ${activeTab === 'companies' ? 'active' : ''}`} onClick={() => setActiveTab('companies')}>
                                My Companies ({myCompanies.length})
                            </button>
                            <button className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}>
                                Business Hub
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'ads' ? 'active' : ''} ${!advertisingUnlocked ? 'tab-btn--locked' : ''}`}
                                onClick={() => {
                                    if (advertisingUnlocked) {
                                        setActiveTab('ads');
                                    } else {
                                        requirePaidBusinessOrRedirect(navigate, user, 'advertising');
                                    }
                                }}
                                title={!advertisingUnlocked ? 'Upgrade required for advertising' : undefined}
                            >
                                Advertising
                                {!advertisingUnlocked && <span className="tab-btn__lock">Locked</span>}
                            </button>
                        </>
                    )}
                    {user?.role === 'psychologist' && (
                        <>
                            <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
                                Dashboard
                            </button>
                            <button className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>
                                Pending Requests ({pendingRequests.length})
                            </button>
                            <button className={`tab-btn ${activeTab === 'payouts' ? 'active' : ''}`} onClick={() => setActiveTab('payouts')}>
                                Rates &amp; Payouts
                            </button>
                            <button className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                                Profile Settings
                            </button>
                        </>
                    )}
                </div>

                {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
                    TAB CONTENT
                â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
                <div className="tab-content">

                    {/* â”€â”€ Employee: Reviews â”€â”€ */}
                    {user?.role === 'employee' && activeTab === 'reviews' && (
                        <div className="my-reviews-section">
                            <div className="daily-checklist-card">
                                <div className="daily-checklist-header">
                                    <div>
                                        <h3>Daily work review checklist</h3>
                                        <p>Track your daily work experience submissions for this week.</p>
                                    </div>
                                    <button type="button" className="btn btn-outline btn-small" onClick={openDailyReview}>
                                        Submit daily review
                                    </button>
                                </div>
                                {dailyChecklistLoading ? (
                                    <p className="empty-message">Loading checklistÃ¢â‚¬Â¦</p>
                                ) : dailyChecklist?.days?.length ? (
                                    <div className="daily-checklist-grid">
                                        {dailyChecklist.days.map((day) => (
                                            <button
                                                key={day.date || day.label}
                                                type="button"
                                                className={`daily-checklist-day ${day.completed ? 'is-complete' : ''} ${day.isToday ? 'is-today' : ''}`}
                                                onClick={() => {
                                                    if (!day.completed) {
                                                        openDailyReview();
                                                    }
                                                }}
                                            >
                                                <span className="daily-checklist-label">{day.label}</span>
                                                <span className="daily-checklist-date">
                                                    {day.date ? format(new Date(day.date), 'MMM d') : '--'}
                                                </span>
                                                <span className="daily-checklist-status">
                                                    {day.completed ? 'Done' : 'Missing'}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="empty-message">
                                        Add your workplace to unlock daily review tracking.
                                    </p>
                                )}
                            </div>
                            <h3>My Reviews</h3>
                            {userReviews.length > 0
                                ? <ReviewList reviews={userReviews} />
                                : <p className="empty-message">You haven't written any reviews yet. <a href="/search">Search for companies</a> to review.</p>}
                        </div>
                    )}

                    {/* â”€â”€ Employee: Messages â”€â”€ */}
                    {user?.role === 'employee' && activeTab === 'messages' && (
                        <div className="message-requests-section">
                            <h3>Message Requests</h3>
                            {outgoingRequests.length > 0 && (
                                <>
                                    <p className="section-subtitle">Requests you sent</p>
                                    <div className="requests-list">
                                        {outgoingRequests.map(request => (
                                            <div key={request.id} className="request-card">
                                                <div className="request-avatar">{request.psychologist?.display_name?.charAt(0) || 'P'}</div>
                                                <div className="request-info">
                                                    <h4>{request.psychologist?.display_name || 'Unknown'}</h4>
                                                    <p className="request-message">{request.initial_message?.content || 'No message provided.'}</p>
                                                    <p className="request-status">Status: {request.status}</p>
                                                    <p className="request-date">Sent: {new Date(request.created_at).toLocaleDateString()}</p>
                                                </div>
                                                <div className="request-actions">
                                                    <button onClick={() => window.location.href = `/messages?conversation=${request.id}`} className="btn btn-outline btn-small">Open Chat</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                            {incomingRequests.length > 0 && (
                                <>
                                    <p className="section-subtitle">Requests sent to you</p>
                                    <div className="requests-list">
                                        {incomingRequests.map(request => (
                                            <div key={request.id} className="request-card">
                                                <div className="request-avatar">{request.psychologist?.display_name?.charAt(0) || 'P'}</div>
                                                <div className="request-info">
                                                    <h4>{request.psychologist?.display_name || 'Unknown'}</h4>
                                                    <p className="request-message">{request.initial_message?.content || 'No message provided.'}</p>
                                                    <p className="request-date">Received: {new Date(request.created_at).toLocaleDateString()}</p>
                                                </div>
                                                <div className="request-actions">
                                                    <button onClick={() => handleAcceptRequest(request.id)} className="btn btn-primary btn-small">Accept</button>
                                                    <button onClick={() => handleRejectRequest(request.id)} className="btn btn-secondary btn-small">Decline</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                            {pendingRequests.length === 0 && <p className="empty-message">No pending message requests.</p>}
                        </div>
                    )}

                    {/* â”€â”€ Employee / Psychologist: Profile Settings â”€â”€ */}
                    {(user?.role === 'employee' || user?.role === 'psychologist') && activeTab === 'profile' && (
                        <div className="profile-tab">
                            <ProfileSettings onUpdate={fetchDashboardData} />
                        </div>
                    )}

                    {user?.role === 'psychologist' && activeTab === 'payouts' && (
                        <div className="psych-payout-tab">
                            <section className="psych-card psych-card--wide">
                                <header className="psych-card__header">
                                    <div>
                                        <h3><FaMoneyBillWave /> Rates &amp; Payouts</h3>
                                        <p>Manage your session rates, payout details, and statements.</p>
                                    </div>
                                </header>
                                <div className="psych-card__body">
                                    <div className="psych-rate-summary">
                                        <span className="badge badge-primary">
                                            Plan: {psychPlanInfo?.plan?.tier || 'free'}
                                        </span>
                                        <span className="badge badge-secondary">
                                            Lead access: {psychPlanInfo?.leadAccess ? 'Enabled' : 'Not available'}
                                        </span>
                                        <span className={`badge ${payoutComplete ? 'badge-success' : 'badge-warning'}`}>
                                            Payout profile: {payoutComplete ? 'Complete' : 'Incomplete'}
                                        </span>
                                    </div>

                                    {!hasPricingConfigured || isEditingRates ? (
                                        <div className="psych-rate-grid">
                                            {[15, 30, 60].map((minutes) => (
                                                <div key={minutes} className="psych-rate-card">
                                                    <div>
                                                        <h4>{minutes === 60 ? '60 minutes / 1 hour' : `${minutes} minutes`}</h4>
                                                        <p>Set your session price for this duration.</p>
                                                    </div>
                                                    <div className="psych-rate-card__input">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            placeholder="0.00"
                                                            value={psychRateForm[minutes]}
                                                            onChange={(e) => setPsychRateForm({ ...psychRateForm, [minutes]: e.target.value })}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="btn btn-primary btn-small"
                                                            onClick={() => handleRateSubmit(minutes)}
                                                            disabled={savingRate}
                                                        >
                                                            {savingRate ? 'Saving...' : 'Save rate'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="psych-rate-grid">
                                            {psychRates.map((rate) => (
                                                <div key={rate.id} className="psych-rate-card">
                                                    <div>
                                                        <h4>{rate.label || `${rate.duration_minutes} minutes`}</h4>
                                                        <p>{rate.duration_minutes === 60 ? '60 minutes / 1 hour' : `${rate.duration_minutes} minutes`} session</p>
                                                    </div>
                                                    <div className="psych-rate-card__input">
                                                        <span className={`badge ${rate.is_active ? 'badge-success' : 'badge-secondary'}`}>
                                                            {rate.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div style={{ marginTop: '0.75rem' }}>
                                        {hasPricingConfigured && !isEditingRates && (
                                            <button
                                                type="button"
                                                className="btn btn-outline btn-small"
                                                onClick={() => setIsEditingRates(true)}
                                            >
                                                Edit pricing
                                            </button>
                                        )}
                                        {hasPricingConfigured && isEditingRates && (
                                            <button
                                                type="button"
                                                className="btn btn-outline btn-small"
                                                onClick={() => setIsEditingRates(false)}
                                            >
                                                Done
                                            </button>
                                        )}
                                    </div>

                                    <form className="psych-payout-form" onSubmit={handlePayoutSubmit}>
                                        <h4><FaWallet /> Payout account</h4>
                                        <div className="psych-payout-grid">
                                            <label>
                                                Country
                                                <select
                                                    value={payoutForm.countryCode}
                                                    onChange={(e) => setPayoutForm({ ...payoutForm, countryCode: e.target.value })}
                                                >
                                                    <option value="ZA">South Africa</option>
                                                    <option value="US">United States</option>
                                                    <option value="GB">United Kingdom</option>
                                                    <option value="EU">Europe</option>
                                                    <option value="OTHER">Other</option>
                                                </select>
                                            </label>
                                            <label>
                                                Account number
                                                <input
                                                    type="text"
                                                    value={payoutForm.accountNumber}
                                                    onChange={(e) => setPayoutForm({ ...payoutForm, accountNumber: e.target.value })}
                                                />
                                            </label>
                                            {payoutForm.countryCode === 'ZA' && (
                                                <label>
                                                    Branch code
                                                    <input
                                                        type="text"
                                                        value={payoutForm.branchCode}
                                                        onChange={(e) => setPayoutForm({ ...payoutForm, branchCode: e.target.value })}
                                                    />
                                                </label>
                                            )}
                                            {payoutForm.countryCode === 'US' && (
                                                <label>
                                                    Routing number
                                                    <input
                                                        type="text"
                                                        value={payoutForm.routingNumber}
                                                        onChange={(e) => setPayoutForm({ ...payoutForm, routingNumber: e.target.value })}
                                                    />
                                                </label>
                                            )}
                                            {payoutForm.countryCode !== 'ZA' && payoutForm.countryCode !== 'US' && (
                                                <label>
                                                    Swift code
                                                    <input
                                                        type="text"
                                                        value={payoutForm.swiftCode}
                                                        onChange={(e) => setPayoutForm({ ...payoutForm, swiftCode: e.target.value })}
                                                    />
                                                </label>
                                            )}
                                            <label>
                                                Account holder
                                                <input
                                                    type="text"
                                                    value={payoutForm.accountHolder}
                                                    onChange={(e) => setPayoutForm({ ...payoutForm, accountHolder: e.target.value })}
                                                />
                                            </label>
                                            <label>
                                                Bank / provider
                                                <input
                                                    type="text"
                                                    value={payoutForm.bankName}
                                                    onChange={(e) => setPayoutForm({ ...payoutForm, bankName: e.target.value })}
                                                />
                                            </label>
                                            <label>
                                                Notes
                                                <textarea
                                                    value={payoutForm.notes}
                                                    onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                                                />
                                            </label>
                                        </div>
                                        <div className="psych-proof-upload">
                                            <label>
                                                Proof of account (required)
                                                <input
                                                    type="file"
                                                    accept=".pdf,image/*"
                                                    onChange={(e) => handlePayoutProofUpload(e.target.files?.[0])}
                                                    disabled={payoutProofUploading}
                                                />
                                            </label>
                                            {payoutProofUploading && <span className="empty-message">Uploading proofÃ¢â‚¬Â¦</span>}
                                            {!payoutProofUploading && payoutProofUrl ? (
                                                <a href={payoutProofUrl} target="_blank" rel="noreferrer">View uploaded proof</a>
                                            ) : null}
                                            {!payoutProofUploading && !payoutProofUrl ? (
                                                <span className="empty-message">No proof uploaded yet.</span>
                                            ) : null}
                                        </div>
                                        <button type="submit" className="btn btn-primary btn-small" disabled={savingPayout}>
                                            {savingPayout ? 'Saving...' : 'Save payout details'}
                                        </button>
                                    </form>

                                    <div className="psych-earnings-summary">
                                        <h4><FaChartBar /> Earnings</h4>
                                        <div className="psych-earnings-grid">
                                            <div>
                                                <span>Gross</span>
                                                <strong>{psychEarnings?.totalsFormatted?.gross ?? 0}</strong>
                                            </div>
                                            <div>
                                                <span>Fees</span>
                                                <strong>{psychEarnings?.totalsFormatted?.fee ?? 0}</strong>
                                            </div>
                                            <div>
                                                <span>Net</span>
                                                <strong>{psychEarnings?.totalsFormatted?.net ?? 0}</strong>
                                            </div>
                                            <div>
                                                <span>Unpaid</span>
                                                <strong>{psychEarnings?.totalsFormatted?.unpaid ?? 0}</strong>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="psych-statement-list">
                                        <div className="psych-statement-header">
                                            <h4><FaFileInvoiceDollar /> Monthly statements</h4>
                                            <button type="button" className="btn btn-outline btn-small" onClick={handleGenerateStatement} disabled={statementGenerating}>
                                                {statementGenerating ? 'Generating...' : 'Generate current month'}
                                            </button>
                                        </div>
                                        {psychStatements.length === 0 ? (
                                            <p className="empty-message">No statements yet.</p>
                                        ) : (
                                            psychStatements.map((statement) => (
                                                <div key={statement.id} className="psych-statement-row">
                                                    <span>{statement.period_start} â€“ {statement.period_end}</span>
                                                    <a className="btn btn-secondary btn-small" href={`/api/psychologists/dashboard/statements/${statement.id}/download`}>
                                                        Download
                                                    </a>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {/* â”€â”€ Business: My Companies â”€â”€ */}
                    {user?.role === 'business' && activeTab === 'companies' && (
                        <div className="my-companies-section">
                            <h3>My Companies</h3>
                            {myCompanies.length > 0 ? (
                                <div className="companies-list">
                                    {myCompanies.map(company => (
                                        <div key={company.id} className="company-dashboard-card">
                                            <div className="company-logo">
                                                {company.logo_url
                                                    ? <img src={resolveMediaUrl(company.logo_url)} alt={company.name} />
                                                    : <div className="logo-placeholder">{company.name.charAt(0)}</div>}
                                            </div>
                                            <div className="company-info">
                                                <h4>
                                                    {company.name}
                                                </h4>
                                                <p>Industry: {company.industry || 'Not specified'}</p>
                                                <p>Total Reviews: {company.review_count || 0}</p>
                                                <p>Average Rating: {company.avg_rating ? parseFloat(company.avg_rating).toFixed(1) : 'N/A'}</p>
                                            </div>
                                            <div className="company-actions">
                                                <button onClick={() => syncClaimStatus(company.id)} className="btn btn-outline btn-small">
                                                    <FaSync size={11} /> Sync Status
                                                </button>
                                                <button onClick={() => window.location.href = `/companies/${company.id}`} className="btn btn-secondary btn-small">
                                                    View Page
                                                </button>
                                                <button onClick={() => { setSelectedCompanyId(company.id); setCompanyPanelTab('reviews'); setActiveTab('reviews'); }} className="btn btn-primary btn-small">
                                                    Business Hub
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="empty-message">You haven't claimed any companies yet. <a href="/search">Search for your company</a> to claim it.</p>
                            )}
                        </div>
                    )}

                    {/* â”€â”€ Business: Hub (Reviews + Analytics + Edit) â”€â”€ */}
                    {user?.role === 'business' && activeTab === 'reviews' && (
                        <div className="business-dashboard-panel">
                            <div className="business-panel-header">
                                <div>
                                    <h3>Business Hub</h3>
                                    <p>Monitor reviews, analyse sentiment, and keep your public profile accurate.</p>
                                    <div className="business-plan-badge">
                                        <span>Plan</span>
                                        <strong>{planLabel}</strong>
                                    </div>
                                    {isBusinessFreeTier && (
                                        <button type="button" className="btn btn-outline btn-small" onClick={() => window.location.href = '/pricing?role=business'}>
                                            Upgrade
                                        </button>
                                    )}
                                </div>
                                {myCompanies.length > 0 && (
                                    <div className="business-company-selector">
                                        <label htmlFor="business-company-select">Company</label>
                                        <select
                                            id="business-company-select"
                                            value={selectedCompanyId || ''}
                                            onChange={(e) => setSelectedCompanyId(e.target.value || null)}
                                        >
                                            <option value="" disabled>Choose a company</option>
                                            {myCompanies.map((company) => (
                                                <option key={company.id} value={company.id}>{company.name}</option>
                                            ))}
                                        </select>
                                        <button type="button" className="btn btn-secondary btn-small" onClick={refreshBusinessSections} disabled={!selectedCompanyId || reviewsLoading || analyticsLoading}>
                                            <FaSync size={11} /> Refresh
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="business-about-card">
                                <h4>Advertising</h4>
                                <p>Launch campaigns, manage spend, and download ad invoices.</p>
                                <button
                                    type="button"
                                    className="btn btn-primary btn-small"
                                    onClick={() => {
                                        if (advertisingUnlocked) {
                                            setActiveTab('ads');
                                        } else {
                                            requirePaidBusinessOrRedirect(navigate, user, 'advertising');
                                        }
                                    }}
                                >
                                    {advertisingUnlocked ? 'Open Advertising' : 'Upgrade to advertise'}
                                </button>
                            </div>

                            {/* Claim Status Banner */}
                            {selectedCompany && (
                                <ClaimStatusBanner
                                    company={selectedCompany}
                                    onRefresh={() => syncClaimStatus(selectedCompanyId)}
                                />
                            )}

                            {businessSectionError && <div className="alert alert-error">{businessSectionError}</div>}

                            {(!myCompanies || myCompanies.length === 0) ? (
                                <p className="empty-message">You don't have any companies yet. <a href="/search">Search for your profile</a> to claim it.</p>
                            ) : (
                                <>
                                      {selectedCompany && (
                                          <div className="business-about-card">
                                              <h4>About {selectedCompany.name}</h4>
                                              <p>{selectedCompany.description || 'Add a short company description to appear here.'}</p>
                                              {selectedCompany.account_number && (
                                                  <p className="business-account-number">
                                                      <strong>Account Number:</strong> {selectedCompany.account_number}
                                                  </p>
                                              )}
                                          </div>
                                      )}
                                    <div className="business-panel-tabs">
                                        {[
                                            { id: 'reviews', label: 'Reviews' },
                                            { id: 'analytics', label: 'Analytics', locked: !analyticsUnlocked },
                                            { id: 'edit', label: 'Edit Profile' },
                                            { id: 'api', label: 'API Keys' }
                                        ].map((tab) => (
                                            <button
                                                key={tab.id}
                                                className={`business-panel-tab ${companyPanelTab === tab.id ? 'active' : ''} ${tab.locked ? 'business-panel-tab--locked' : ''}`}
                                                onClick={() => !tab.locked && setCompanyPanelTab(tab.id)}
                                                disabled={tab.locked}
                                                title={tab.locked ? 'Available on subscription plans' : undefined}
                                            >
                                                {tab.label}
                                                {tab.locked && <span className="tab-lock-pill">Locked</span>}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="business-panel-body">

                                        {/* â”€â”€â”€ Reviews Tab â”€â”€â”€ */}
                                        {companyPanelTab === 'reviews' && (
                                            <div className="business-reviews-panel">
                                                {/* Filters */}
                                                <div className="biz-review-filters">
                                                    <select
                                                        value={reviewFilter.rating}
                                                        onChange={(e) => setReviewFilter((f) => ({ ...f, rating: e.target.value }))}
                                                    >
                                                        <option value="">All ratings</option>
                                                        {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} â˜…</option>)}
                                                    </select>
                                                    <select
                                                        value={reviewFilter.type}
                                                        onChange={(e) => setReviewFilter((f) => ({ ...f, type: e.target.value }))}
                                                    >
                                                        <option value="">All reviewers</option>
                                                        <option value="employee">Named employees</option>
                                                        <option value="anonymous">Anonymous</option>
                                                    </select>
                                                    <select
                                                        value={reviewFilter.sort}
                                                        onChange={(e) => setReviewFilter((f) => ({ ...f, sort: e.target.value }))}
                                                    >
                                                        <option value="newest">Newest first</option>
                                                        <option value="oldest">Oldest first</option>
                                                        <option value="highest">Highest rating</option>
                                                        <option value="lowest">Lowest rating</option>
                                                    </select>
                                                    {companyReviewPagination.total > 0 && (
                                                        <span className="biz-review-total">
                                                            {companyReviewPagination.total} review{companyReviewPagination.total !== 1 ? 's' : ''}
                                                        </span>
                                                    )}
                                                </div>

                                                {reviewsLoading ? <Loading /> : companyReviews.length > 0 ? (
                                                    <>
                                                        {companyReviewPagination.lastViewedAt && (
                                                            <p className="business-last-seen">
                                                                Last checked {new Date(companyReviewPagination.lastViewedAt).toLocaleString()}
                                                            </p>
                                                        )}
                                                        {companyReviews.map((review) => (
                                                            <ReviewCard
                                                                key={review.id}
                                                                review={review}
                                                                onReplyAdded={() => fetchBusinessReviews(selectedCompanyId, companyReviewPagination.page || 1)}
                                                                replyEndpoint={selectedCompanyId ? `/business/${selectedCompanyId}/review/${review.id}/reply` : undefined}
                                                            />
                                                        ))}
                                                        <div className="business-pagination">
                                                            <button type="button" onClick={() => handleBusinessReviewPageChange(-1)} disabled={(companyReviewPagination.page || 1) <= 1 || reviewsLoading}>Previous</button>
                                                            <span>Page {companyReviewPagination.page || 1} of {companyReviewPagination.pages || 1}</span>
                                                            <button type="button" onClick={() => handleBusinessReviewPageChange(1)} disabled={(companyReviewPagination.page || 1) >= (companyReviewPagination.pages || 1) || reviewsLoading}>Next</button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <p className="empty-message">No reviews match your filters.</p>
                                                )}
                                            </div>
                                        )}

                                        {/* â”€â”€â”€ Analytics Tab â”€â”€â”€ */}
                                        {companyPanelTab === 'analytics' && (
                                            <div className="business-analytics-panel">
                                                {!analyticsUnlocked && (
                                                    <div className="locked-panel">
                                                        <h4>Analytics locked</h4>
                                                        <p>Upgrade your business plan to unlock analytics dashboards and sentiment insights.</p>
                                                        <button type="button" className="btn btn-primary" onClick={() => window.location.href = '/pricing?role=business'}>
                                                            Upgrade plan
                                                        </button>
                                                    </div>
                                                )}
                                                {analyticsUnlocked && (analyticsLoading ? <Loading /> : companyAnalytics ? (
                                                    <>
                                                        {/* Summary cards */}
                                                        <div className="business-analytics-cards">
                                                            <div className="analytics-card analytics-card--highlight">
                                                                <p>Average rating</p>
                                                                <strong>{avgRating}</strong>
                                                                <StarRating rating={parseFloat(avgRating) || 0} size={12} />
                                                            </div>
                                                            <div className="analytics-card">
                                                                <p>Total reviews</p>
                                                                <strong>{totalReviews}</strong>
                                                            </div>
                                                            <div className="analytics-card">
                                                                <p>Response rate</p>
                                                                <strong>{responseRate}</strong>
                                                            </div>
                                                            <div className="analytics-card">
                                                                <p>Anonymous reviews</p>
                                                                <strong>{anonymousRate}</strong>
                                                            </div>
                                                        </div>

                                                        {/* Charts grid */}
                                                        <div className="business-analytics-grid">
                                                            {/* Rating distribution */}
                                                            <div className="analytics-chart">
                                                                <h4><FaChartBar size={13} /> Rating Distribution</h4>
                                                                <ResponsiveContainer width="100%" height={220}>
                                                                    <BarChart data={ratingChartData} barCategoryGap="30%">
                                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff20" />
                                                                        <XAxis dataKey="rating" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                                                        <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                                                        <Tooltip content={<ChartTooltip />} />
                                                                        <Bar dataKey="count" name="Reviews" fill="#6366f1" radius={[6, 6, 0, 0]} />
                                                                    </BarChart>
                                                                </ResponsiveContainer>
                                                            </div>

                                                            {/* Employee vs Anonymous */}
                                                            <div className="analytics-chart">
                                                                <h4><FaUserSecret size={13} /> Reviewer Breakdown</h4>
                                                                <ResponsiveContainer width="100%" height={220}>
                                                                    <PieChart>
                                                                        <Pie data={reviewerBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                                                                            {reviewerBreakdown.map((entry, index) => (
                                                                                <Cell key={`cell-${entry.name}`} fill={BUSINESS_PIE_COLORS[index % BUSINESS_PIE_COLORS.length]} />
                                                                            ))}
                                                                        </Pie>
                                                                        <Tooltip content={<ChartTooltip />} />
                                                                        <Legend iconType="circle" iconSize={10} />
                                                                    </PieChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        </div>

                                                        {/* Sentiment */}
                                                        {sentimentData.length > 0 && (
                                                            <div className="business-analytics-grid">
                                                                <div className="analytics-chart">
                                                                    <h4>Sentiment Breakdown</h4>
                                                                    <ResponsiveContainer width="100%" height={220}>
                                                                        <PieChart>
                                                                            <Pie data={sentimentData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                                                                                {sentimentData.map((entry) => (
                                                                                    <Cell key={entry.name} fill={entry.color} />
                                                                                ))}
                                                                            </Pie>
                                                                            <Tooltip content={<ChartTooltip />} />
                                                                            <Legend iconType="circle" iconSize={10} />
                                                                        </PieChart>
                                                                    </ResponsiveContainer>
                                                                </div>

                                                                {/* Review volume trend */}
                                                                <div className="analytics-chart">
                                                                    <h4>Review Volume Trend</h4>
                                                                    <ResponsiveContainer width="100%" height={220}>
                                                                        <LineChart data={trendChartData}>
                                                                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff20" />
                                                                            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                                                            <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                                                            <Tooltip content={<ChartTooltip />} />
                                                                            <Line type="monotone" dataKey="count" name="Reviews" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4, fill: '#0ea5e9' }} />
                                                                        </LineChart>
                                                                    </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                                                        {/* Full-width trend if no sentiment */}
                                                        {sentimentData.length === 0 && trendChartData.length > 0 && (
                                                            <div className="analytics-chart">
                                                                <h4>Review Volume Trend</h4>
                                                                <ResponsiveContainer width="100%" height={260}>
                                                                    <LineChart data={trendChartData}>
                                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff20" />
                                                                        <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                                                        <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                                                        <Tooltip content={<ChartTooltip />} />
                                                                        <Line type="monotone" dataKey="count" name="Reviews" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4, fill: '#0ea5e9' }} />
                                                                    </LineChart>
                                                                </ResponsiveContainer>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <p className="empty-message">Analytics will appear once reviews start rolling in.</p>
                                                ))}
                                            </div>
                                        )}

                                        {/* â”€â”€â”€ Edit Profile Tab â”€â”€â”€ */}
                                        {companyPanelTab === 'edit' && selectedCompany && (
                                            <form className="business-edit-panel" onSubmit={handleCompanyInfoSubmit}>
                                                <p className="business-edit-intro">
                                                    This information is shown publicly on your company profile. Keep it accurate so customers can reach you.
                                                </p>

                                                <div className="form-grid-two">
                                                    <label>
                                                        <span className="form-label-text"><FaPhone size={11} /> Public phone</span>
                                                        <input type="text" value={editCompanyForm.phone} onChange={(e) => handleCompanyInfoChange('phone', e.target.value)} placeholder="+27 11 123 4567" />
                                                    </label>
                                                    <label>
                                                        <span className="form-label-text"><FaEnvelope size={11} /> Public email</span>
                                                        <input type="email" value={editCompanyForm.email} onChange={(e) => handleCompanyInfoChange('email', e.target.value)} placeholder="press@company.com" />
                                                    </label>
                                                    <label>
                                                        <span className="form-label-text"><FaGlobe size={11} /> Website</span>
                                                        <input type="url" value={editCompanyForm.website} onChange={(e) => handleCompanyInfoChange('website', e.target.value)} placeholder="https://yourcompany.com" />
                                                    </label>
                                                    <label>
                                                        <span className="form-label-text"><FaImage size={11} /> Logo URL</span>
                                                        <input type="url" value={editCompanyForm.logo_url} onChange={(e) => handleCompanyInfoChange('logo_url', e.target.value)} placeholder="https://example.com/logo.png" />
                                                    </label>
                                                    <label>
                                                        <span className="form-label-text"><FaImage size={11} /> Upload logo</span>
                                                        <input type="file" accept="image/*" onChange={handleCompanyLogoUpload} disabled={companyLogoUploading} />
                                                        {companyLogoUploading && <span className="form-hint">Uploadingâ€¦</span>}
                                                    </label>
                                                    <label>
                                                        <span className="form-label-text"><FaShieldAlt size={11} /> Registration number</span>
                                                        <input type="text" value={editCompanyForm.registration_number} onChange={(e) => handleCompanyInfoChange('registration_number', e.target.value)} placeholder="e.g., 2012/123456/07" />
                                                    </label>
                                                    <label>
                                                        <span className="form-label-text"><FaMapMarkerAlt size={11} /> Street address</span>
                                                        <input type="text" value={editCompanyForm.address} onChange={(e) => handleCompanyInfoChange('address', e.target.value)} placeholder="123 Main Road" />
                                                    </label>
                                                    <label>
                                                        <span className="form-label-text"><FaMapMarkerAlt size={11} /> City</span>
                                                        <input type="text" value={editCompanyForm.city} onChange={(e) => handleCompanyInfoChange('city', e.target.value)} placeholder="Johannesburg" />
                                                    </label>
                                                    <label className="form-grid-two__full">
                                                        <span className="form-label-text"><FaGlobe size={11} /> Country</span>
                                                        <input type="text" value={editCompanyForm.country} onChange={(e) => handleCompanyInfoChange('country', e.target.value)} placeholder="South Africa" />
                                                    </label>
                                                    <label className="form-grid-two__full">
                                                        <span className="form-label-text"><FaBuilding size={11} /> Company description</span>
                                                        <textarea
                                                            value={editCompanyForm.description}
                                                            onChange={(e) => handleCompanyInfoChange('description', e.target.value)}
                                                            placeholder="Short description shown on your public profile"
                                                            rows={4}
                                                        />
                                                    </label>
                                                </div>

                                                {/* Logo preview */}
                                                {editCompanyForm.logo_url && (
                                                    <div className="business-logo-preview">
                                                        <span>Logo preview:</span>
                                                        <img
                                                            src={resolveMediaUrl(editCompanyForm.logo_url)}
                                                            alt="Logo preview"
                                                            onError={(e) => { e.target.style.display = 'none'; }}
                                                        />
                                                    </div>
                                                )}

                                                {companyInfoMessage && <p className="form-hint">{companyInfoMessage}</p>}

                                                <div className="business-edit-actions">
                                                    <button
                                                        type="button"
                                                        className="btn btn-secondary"
                                                        onClick={handleScrapeMissingInfo}
                                                        disabled={companyInfoSaving || !editCompanyForm.website}
                                                        title={!editCompanyForm.website ? 'Add a website URL above to enable auto-fill' : undefined}
                                                    >
                                                        {editCompanyForm.website ? 'Auto-fill from website' : 'Enter website to auto-fill'}
                                                    </button>
                                                    <button type="submit" className="btn btn-primary" disabled={companyInfoSaving}>
                                                        {companyInfoSaving ? 'Savingâ€¦' : 'Save changes'}
                                                    </button>
                                                </div>
                                            </form>
                                        )}

                                        {/* â€” API Keys Tab â€” */}
                                        {companyPanelTab === 'api' && (
                                            <div className="business-api-panel">
                                                <p className="business-edit-intro">
                                                    Generate API keys to connect your CRM or BI tools. Keep keys private â€” they grant access to your business data.
                                                </p>

                                                <div className="api-usage-card">
                                                    <div>
                                                        <h4>API usage today</h4>
                                                        <p className="form-hint">Plan: {planLabel}</p>
                                                    </div>
                                                    {apiUsageLoading ? (
                                                        <span className="form-hint">Loading usageâ€¦</span>
                                                    ) : (
                                                        <div className="api-usage-metrics">
                                                            <div>
                                                                <span>Limit</span>
                                                                <strong>{apiUsage?.dailyLimit ?? planPermissions.apiLimit ?? 'â€”'}</strong>
                                                            </div>
                                                            <div>
                                                                <span>Used</span>
                                                                <strong>{apiUsage?.usedToday ?? 0}</strong>
                                                            </div>
                                                            <div>
                                                                <span>Remaining</span>
                                                                <strong>{apiUsage?.remainingToday ?? 'â€”'}</strong>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {isBusinessFreeTier && (
                                                        <button type="button" className="btn btn-outline btn-small" onClick={() => window.location.href = '/pricing?role=business'}>
                                                            Upgrade for more
                                                        </button>
                                                    )}
                                                </div>

                                                {newApiKey && (
                                                    <div className="api-key-reveal">
                                                        <div>
                                                            <strong>New API key</strong>
                                                            <p className="api-key-value">{newApiKey}</p>
                                                            <p className="form-hint">Copy and store this key now. You wonâ€™t see it again.</p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="btn btn-secondary btn-small"
                                                            onClick={() => navigator.clipboard?.writeText(newApiKey)}
                                                        >
                                                            Copy key
                                                        </button>
                                                    </div>
                                                )}

                                                <form className="api-key-create" onSubmit={handleCreateApiKey}>
                                                    <input
                                                        type="text"
                                                        value={apiKeyName}
                                                        onChange={(e) => setApiKeyName(e.target.value)}
                                                        placeholder="Key label (e.g., HubSpot, Salesforce)"
                                                    />
                                                    <button type="submit" className="btn btn-primary" disabled={apiKeyCreating}>
                                                        {apiKeyCreating ? 'Creatingâ€¦' : 'Create key'}
                                                    </button>
                                                </form>

                                                {apiKeyError && <p className="form-hint">{apiKeyError}</p>}

                                                {apiKeysLoading ? (
                                                    <Loading />
                                                ) : apiKeys.length > 0 ? (
                                                    <div className="api-key-list">
                                                        {apiKeys.map((key) => (
                                                            <div key={key.id} className="api-key-item">
                                                                <div>
                                                                    <strong>{key.name || `Key ${key.key_prefix}`}</strong>
                                                                    <p className="api-key-meta">
                                                                        Prefix: {key.key_prefix} â€¢ Created {new Date(key.created_at).toLocaleDateString()}
                                                                    </p>
                                                                    {key.revoked_at && (
                                                                        <span className="api-key-revoked">Revoked</span>
                                                                    )}
                                                                </div>
                                                                {!key.revoked_at && (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-outline btn-small"
                                                                        onClick={() => handleRevokeApiKey(key.id)}
                                                                    >
                                                                        Revoke
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="empty-message">No API keys yet. Create one to start integrating.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* â”€â”€ Business: Advertising Tab â”€â”€ */}
                    {user?.role === 'business' && activeTab === 'ads' && (
                        <AdvertisingSection premiumExceptionActive={premiumExceptionActive} />
                    )}

                    {/* â”€â”€ Psychologist: Pending Requests â”€â”€ */}
                    {user?.role === 'psychologist' && activeTab === 'requests' && (
                        <div className="pending-requests-section">
                            <h3>Pending Message Requests</h3>
                            {pendingRequests.length > 0 ? (
                                <div className="requests-list">
                                    {pendingRequests.map(request => (
                                        <div key={request.id} className="request-card">
                                            <div className="request-info">
                                                <h4>{request.employee?.is_anonymous ? 'Anonymous Employee' : request.employee?.display_name || 'Unknown'}</h4>
                                                {request.employee?.occupation && <p className="user-occupation-small"><FaBriefcase /> {request.employee.occupation}</p>}
                                                {request.employee?.workplace && <p className="user-workplace-small"><FaBuilding /> {request.employee.workplace.name}</p>}
                                                {request.initial_message?.content && <p className="request-message">{request.initial_message.content}</p>}
                                                <p className="request-status">Status: {request.status}</p>
                                                <p className="request-date">Sent: {new Date(request.created_at).toLocaleDateString()}</p>
                                            </div>
                                            <div className="request-actions">
                                                <button onClick={() => handleAcceptRequest(request.id)} className="btn btn-primary btn-small">Accept</button>
                                                <button onClick={() => handleRejectRequest(request.id)} className="btn btn-secondary btn-small">Decline</button>
                                                <button onClick={() => window.location.href = `/messages?conversation=${request.id}`} className="btn btn-outline btn-small">View Details</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="empty-message">No pending message requests.</p>
                            )}
                        </div>
                    )}

                    {/* â”€â”€ Psychologist: Overview â”€â”€ */}
                    {user?.role === 'psychologist' && activeTab === 'overview' && (
                        <div className="psych-dashboard-grid">
                            {/* Schedule card */}
                            <section className="psych-card psych-card--schedule">
                                <header className="psych-card__header">
                                    <div>
                                        <h3><FaCalendarAlt /> Schedule</h3>
                                        <p>Plan meetings and activities with a live calendar view.</p>
                                    </div>
                                    <button type="button" className="btn btn-outline btn-small psych-card__toggle" onClick={() => togglePsychCard('schedule')}>
                                        {psychCardCollapse.schedule ? <FaChevronDown /> : <FaChevronUp />}
                                        {psychCardCollapse.schedule ? 'Maximize' : 'Minimize'}
                                    </button>
                                </header>
                                {!psychCardCollapse.schedule && (
                                    <div className="psych-card__body">
                                        <div className="psych-calendar-header">
                                            <div className="psych-calendar-nav">
                                                <button type="button" className="btn btn-outline btn-small" onClick={handleCalendarPrev}>Prev</button>
                                                <button type="button" className="btn btn-outline btn-small" onClick={handleCalendarToday}>Today</button>
                                                <button type="button" className="btn btn-outline btn-small" onClick={handleCalendarNext}>Next</button>
                                            </div>
                                            <div className="psych-calendar-title">
                                                <h4>{format(calendarDate, 'MMMM yyyy')}</h4>
                                                <span>{weekLabel}</span>
                                            </div>
                                            <div className="psych-calendar-view">
                                                <button
                                                    type="button"
                                                    className={`btn btn-small ${scheduleView === 'week' ? 'btn-primary' : 'btn-outline'}`}
                                                    onClick={() => setScheduleView('week')}
                                                >
                                                    Week
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`btn btn-small ${scheduleView === 'agenda' ? 'btn-primary' : 'btn-outline'}`}
                                                    onClick={() => setScheduleView('agenda')}
                                                >
                                                    Agenda
                                                </button>
                                            </div>
                                            <div className="psych-calendar-actions">
                                                <button
                                                    type="button"
                                                    className={`btn btn-small ${availabilityMode ? 'btn-primary' : 'btn-outline'}`}
                                                    onClick={() => setAvailabilityMode((prev) => !prev)}
                                                >
                                                    {availabilityMode ? 'Availability mode' : 'Edit availability'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-primary btn-small"
                                                    onClick={handleAvailabilitySave}
                                                    disabled={availabilitySaving || isPsychRestricted}
                                                >
                                                    {availabilitySaving ? 'Saving…' : 'Save availability'}
                                                </button>
                                            </div>
                                        </div>
                                        {scheduleView === 'week' ? (
                                            <div className={`psych-calendar-grid-shell ${availabilityMode ? 'is-editing' : ''}`}>
                                                <div className="psych-calendar-grid-head">
                                                    <span className="psych-calendar-time-label" />
                                                    {calendarDays.map((day) => (
                                                        <div key={day.toISOString()} className="psych-calendar-day-label">
                                                            <span>{format(day, 'EEE')}</span>
                                                            <strong>{format(day, 'd')}</strong>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="psych-calendar-grid-body">
                                                    {Array.from({ length: 24 }, (_, hour) => (
                                                        <div key={hour} className="psych-calendar-row">
                                                            <span className="psych-calendar-time">{String(hour).padStart(2, '0')}:00</span>
                                                            {calendarDays.map((day) => {
                                                                const dayOfWeek = day.getDay();
                                                                const key = `${dayOfWeek}-${hour}`;
                                                                const isAvailable = availabilityMap.get(key);
                                                                const slotStart = new Date(day);
                                                                slotStart.setHours(hour, 0, 0, 0);
                                                                const slotEnd = new Date(slotStart);
                                                                slotEnd.setHours(slotEnd.getHours() + 1);
                                                                const slotEvents = scheduleEntries.filter(
                                                                    (entry) => entry.startsAt < slotEnd && entry.endsAt > slotStart
                                                                );
                                                                const isSelected = selectedSlot
                                                                    ? format(selectedSlot.day, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd') && selectedSlot.hour === hour
                                                                    : false;
                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        key={`${key}-${day.toISOString()}`}
                                                                        className={`psych-calendar-slot ${isAvailable ? 'is-available' : 'is-unavailable'} ${isSelected ? 'is-selected' : ''}`}
                                                                        onClick={() => (availabilityMode
                                                                            ? handleAvailabilityToggle(dayOfWeek, hour)
                                                                            : openScheduleModalForSlot(day, hour))}
                                                                        disabled={isPsychRestricted}
                                                                        title={availabilityMode ? 'Toggle availability' : 'Create event'}
                                                                    >
                                                                        {slotEvents.map((entry) => (
                                                                            <div
                                                                                key={entry.id}
                                                                                className={`psych-calendar-event psych-calendar-event--${entry.type} psych-calendar-event--${entry.source}`}
                                                                            >
                                                                                <span>{entry.title}</span>
                                                                                <small>{format(entry.startsAt, 'HH:mm')}</small>
                                                                            </div>
                                                                        ))}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="psych-calendar-agenda">
                                                {agendaItems.length === 0 && <p className="empty-message">No items for this week.</p>}
                                                {agendaItems.map((entry) => (
                                                    <div key={entry.id} className="psych-calendar-agenda-item">
                                                        <div>
                                                            <strong>{entry.title}</strong>
                                                            <span>{format(entry.startsAt, 'EEE, MMM d · HH:mm')}</span>
                                                            <span className="psych-calendar-agenda-meta">
                                                                {entry.source === 'external' ? 'External' : entry.type}
                                                                {entry.isVideoCall ? ' · Video' : ''}
                                                            </span>
                                                        </div>
                                                        <div className="psych-calendar-agenda-actions">
                                                            {entry.source === 'legacy' && (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-secondary btn-small"
                                                                    onClick={() => handleScheduleRemove(entry.id)}
                                                                    disabled={isPsychRestricted}
                                                                >
                                                                    Remove
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {/* Calendar integrations */}
                                        <div className="psych-schedule-list">
                                            <div className="psych-schedule-list__header">
                                                <h4>Calendar integrations</h4>
                                                <span>{calendarIntegrations.length} connected</span>
                                            </div>
                                            <button type="button" className="btn btn-outline btn-small" onClick={handleDownloadIcs}>Download iCal</button>
                                            <form className="psych-schedule-form" onSubmit={handleAddCalendarIntegration}>
                                                <select value={calendarIntegrationDraft.provider} onChange={(e) => setCalendarIntegrationDraft({ ...calendarIntegrationDraft, provider: e.target.value })}>
                                                    <option value="google">Google Calendar</option>
                                                    <option value="outlook">Outlook</option>
                                                    <option value="ical">iCal</option>
                                                </select>
                                                <input type="text" placeholder="Calendar name" value={calendarIntegrationDraft.name} onChange={(e) => setCalendarIntegrationDraft({ ...calendarIntegrationDraft, name: e.target.value })} />
                                                <input type="url" placeholder="Public iCal URL" value={calendarIntegrationDraft.icalUrl} onChange={(e) => setCalendarIntegrationDraft({ ...calendarIntegrationDraft, icalUrl: e.target.value })} />
                                                <button type="submit" className="btn btn-primary btn-small" disabled={isPsychRestricted}>Connect</button>
                                            </form>
                                            {calendarIntegrations.length > 0 ? (
                                                <div className="psych-schedule-list__items">
                                                    {calendarIntegrations.map((integration) => (
                                                        <div key={integration.id} className="psych-schedule-list__item">
                                                            <div>
                                                                <strong>{integration.name || integration.provider}</strong>
                                                                <span>{integration.provider}</span>
                                                            </div>
                                                            <div className="psych-calendar-actions">
                                                                <button type="button" className="btn btn-outline btn-small" onClick={() => handleSyncCalendarIntegration(integration.id)} disabled={isPsychRestricted}>Sync</button>
                                                                <button type="button" className="btn btn-secondary btn-small" onClick={() => handleRemoveCalendarIntegration(integration.id)} disabled={isPsychRestricted}>Remove</button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="empty-message">No external calendars connected.</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </section>

                            {/* Session ratings card */}
                            <section className="psych-card psych-card--compact">
                                <header className="psych-card__header">
                                    <div>
                                        <h3>Session Ratings</h3>
                                        <p>Weekly and monthly feedback averages.</p>
                                    </div>
                                </header>
                                <div className="psych-card__body">
                                    {psychRatingSummary ? (
                                        <div className="psych-rating-grid">
                                            <div className="psych-rating-metric">
                                                <span className="psych-rating-label">This week</span>
                                                <strong>{Number(psychRatingSummary.weekly_avg || 0).toFixed(1)}</strong>
                                                <span className="psych-rating-count">
                                                    {psychRatingSummary.weekly_count || 0} ratings
                                                </span>
                                            </div>
                                            <div className="psych-rating-metric">
                                                <span className="psych-rating-label">This month</span>
                                                <strong>{Number(psychRatingSummary.monthly_avg || 0).toFixed(1)}</strong>
                                                <span className="psych-rating-count">
                                                    {psychRatingSummary.monthly_count || 0} ratings
                                                </span>
                                            </div>
                                            {Array.isArray(psychRatingSummary.recent_comments) && psychRatingSummary.recent_comments.length > 0 && (
                                                <div className="psych-rating-comments">
                                                    <h4>Recent feedback</h4>
                                                    {psychRatingSummary.recent_comments.map((comment, index) => (
                                                        <div key={`${comment.created_at}-${index}`} className="psych-rating-comment">
                                                            <span>{comment.review_text}</span>
                                                            <small>{new Date(comment.created_at).toLocaleDateString()}</small>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="empty-message">No ratings yet.</p>
                                    )}
                                </div>
                            </section>

                            {/* Rates & Payouts card */}
                            {false && (
                            <section className="psych-card psych-card--compact">
                                <header className="psych-card__header">
                                    <div>
                                        <h3><FaMoneyBillWave /> Rates &amp; Payouts</h3>
                                        <p>Manage session pricing, payout account, and statements.</p>
                                    </div>
                                </header>
                                <div className="psych-card__body">
                                    <div className="psych-rate-summary">
                                        <span className="badge badge-primary">
                                            Plan: {psychPlanInfo?.plan?.tier || 'free'}
                                        </span>
                                        <span className="badge badge-secondary">
                                            Lead access: {psychPlanInfo?.leadAccess ? 'Enabled' : 'Not available'}
                                        </span>
                                    </div>
                                    <form className="psych-rate-form" onSubmit={handleRateSubmit}>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="Rate amount"
                                            value={psychRateForm.amount}
                                            onChange={(e) => setPsychRateForm({ ...psychRateForm, amount: e.target.value })}
                                        />
                                        <select
                                            value={psychRateForm.durationType}
                                            onChange={(e) => setPsychRateForm({ ...psychRateForm, durationType: e.target.value })}
                                        >
                                            <option value="per_hour">Per hour</option>
                                            <option value="per_minute">Per minute</option>
                                        </select>
                                        <input
                                            type="text"
                                            placeholder="Label (optional)"
                                            value={psychRateForm.label}
                                            onChange={(e) => setPsychRateForm({ ...psychRateForm, label: e.target.value })}
                                        />
                                        <button type="submit" className="btn btn-primary btn-small" disabled={savingRate}>
                                            {savingRate ? 'Saving...' : 'Save rate'}
                                        </button>
                                    </form>
                                    <div className="psych-rate-list">
                                        {psychRates.length === 0 ? (
                                            <p className="empty-message">No rates yet.</p>
                                        ) : (
                                            psychRates.map((rate) => (
                                                <div key={rate.id} className={`psych-rate-row ${rate.is_active ? 'is-active' : ''}`}>
                                                    <div>
                                                        <strong>{rate.label || 'Session rate'}</strong>
                                                        <span>
                                                            {rate.currency_code || 'USD'} {(Number(rate.amount_minor || 0) / 100).toFixed(2)} {rate.duration_type === 'per_minute' ? '/ min' : '/ hour'}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline btn-small"
                                                        onClick={() => handleActivateRate(rate.id)}
                                                        disabled={savingRate || rate.is_active}
                                                    >
                                                        {rate.is_active ? 'Active' : 'Make active'}
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <form className="psych-payout-form" onSubmit={handlePayoutSubmit}>
                                        <h4><FaWallet /> Payout account</h4>
                                        <input
                                            type="text"
                                            placeholder="Account number"
                                            value={payoutForm.accountNumber}
                                            onChange={(e) => setPayoutForm({ ...payoutForm, accountNumber: e.target.value })}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Account holder"
                                            value={payoutForm.accountHolder}
                                            onChange={(e) => setPayoutForm({ ...payoutForm, accountHolder: e.target.value })}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Bank / provider"
                                            value={payoutForm.bankName}
                                            onChange={(e) => setPayoutForm({ ...payoutForm, bankName: e.target.value })}
                                        />
                                        <textarea
                                            placeholder="Notes (optional)"
                                            value={payoutForm.notes}
                                            onChange={(e) => setPayoutForm({ ...payoutForm, notes: e.target.value })}
                                        />
                                        <button type="submit" className="btn btn-primary btn-small" disabled={savingPayout}>
                                            {savingPayout ? 'Saving...' : 'Save payout details'}
                                        </button>
                                    </form>
                                    <div className="psych-earnings-summary">
                                        <h4><FaChartBar /> Earnings</h4>
                                        <div className="psych-earnings-grid">
                                            <div>
                                                <span>Gross</span>
                                                <strong>{psychEarnings?.totalsFormatted?.gross ?? 0}</strong>
                                            </div>
                                            <div>
                                                <span>Fees</span>
                                                <strong>{psychEarnings?.totalsFormatted?.fee ?? 0}</strong>
                                            </div>
                                            <div>
                                                <span>Net</span>
                                                <strong>{psychEarnings?.totalsFormatted?.net ?? 0}</strong>
                                            </div>
                                            <div>
                                                <span>Unpaid</span>
                                                <strong>{psychEarnings?.totalsFormatted?.unpaid ?? 0}</strong>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="psych-statement-list">
                                        <div className="psych-statement-header">
                                            <h4><FaFileInvoiceDollar /> Monthly statements</h4>
                                            <button type="button" className="btn btn-outline btn-small" onClick={handleGenerateStatement} disabled={statementGenerating}>
                                                {statementGenerating ? 'Generating...' : 'Generate current month'}
                                            </button>
                                        </div>
                                        {psychStatements.length === 0 ? (
                                            <p className="empty-message">No statements yet.</p>
                                        ) : (
                                            psychStatements.map((statement) => (
                                                <div key={statement.id} className="psych-statement-row">
                                                    <span>{statement.period_start} â€“ {statement.period_end}</span>
                                                    <a className="btn btn-secondary btn-small" href={`/api/psychologists/dashboard/statements/${statement.id}/download`}>
                                                        Download
                                                    </a>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </section>
                            )}

                            {/* Leads card */}
                            <section className="psych-card psych-card--compact">
                                <header className="psych-card__header">
                                    <div>
                                        <h3><FaEnvelopeOpenText /> Leads</h3>
                                        <p>Individuals flagged as potentially stressed or depressed.</p>
                                    </div>
                                    <button type="button" className="btn btn-outline btn-small psych-card__toggle" onClick={() => togglePsychCard('leads')}>
                                        {psychCardCollapse.leads ? <FaChevronDown /> : <FaChevronUp />}
                                        {psychCardCollapse.leads ? 'Maximize' : 'Minimize'}
                                    </button>
                                </header>
                                {!psychCardCollapse.leads && (
                                    <div className="psych-card__body">
                                        <div className="psych-leads-list">
                                            {psychLeads.length > 0 ? psychLeads.map(lead => (
                                                <div key={lead.id} className="psych-lead-card">
                                                    <div>
                                                        <h4>{lead.display_name}</h4>
                                                        <p>{lead.summary}</p>
                                                        <span className={`lead-badge lead-${lead.risk_level}`}>{lead.risk_level} risk</span>
                                                    </div>
                                                    <button type="button" className="btn btn-secondary btn-small" onClick={() => handleLeadMessage(lead.id)} disabled={isPsychRestricted}>Send message</button>
                                                    <button type="button" className="btn btn-outline btn-small" onClick={() => handleLeadArchive(lead.id)} disabled={isPsychRestricted}>Remove</button>
                                                </div>
                                            )) : (
                                                <p className="empty-message">No new leads right now.</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </section>

                            {/* Recent calls card */}
                            <section className="psych-card psych-card--compact">
                                <header className="psych-card__header">
                                    <div>
                                        <h3><FaVideo /> Recent Calls</h3>
                                        <p>Previous voice/video sessions with employees.</p>
                                    </div>
                                    <button type="button" className="btn btn-outline btn-small psych-card__toggle" onClick={() => togglePsychCard('calls')}>
                                        {psychCardCollapse.calls ? <FaChevronDown /> : <FaChevronUp />}
                                        {psychCardCollapse.calls ? 'Maximize' : 'Minimize'}
                                    </button>
                                </header>
                                {!psychCardCollapse.calls && (
                                    <div className="psych-card__body">
                                        {recentCalls.length === 0 ? (
                                            <p className="empty-message">No previous calls yet.</p>
                                        ) : (
                                            <div className="psych-call-summary">
                                                {recentCalls.map((call) => (
                                                    <div key={call.id} className="psych-call-row">
                                                        <strong>{call.employee_name || 'Employee'}</strong>
                                                        <span>{call.media_type || 'call'}</span>
                                                        <span>{formatDuration(call.duration_seconds)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </section>
                        </div>
                    )}
                </div>
            </div>
        </div>
                                    

            <Modal
                isOpen={scheduleModalOpen}
                onClose={closeScheduleModal}
                title="Schedule a session"
                size="large"
                className="psych-schedule-modal"
            >
                <form onSubmit={handleScheduleSubmit} className="psych-schedule-modal__form">
                    <div className="psych-schedule-modal__header">
                        <h4>
                            {scheduleDraft.date && scheduleDraft.startTime
                                ? format(new Date(`${scheduleDraft.date}T${scheduleDraft.startTime}`), 'EEE, MMM d - HH:mm')
                                : 'Select a time'}
                        </h4>
                        <span>{availabilityMode ? 'Availability edit is active' : 'Create a new event'}</span>
                    </div>
                    <div className="psych-schedule-modal__grid">
                        <label>
                            Title
                            <input
                                type="text"
                                value={scheduleDraft.title}
                                onChange={(e) => setScheduleDraft({ ...scheduleDraft, title: e.target.value })}
                                placeholder="Session title"
                                required
                            />
                        </label>
                        <label>
                            Description
                            <textarea
                                value={scheduleDraft.description}
                                onChange={(e) => setScheduleDraft({ ...scheduleDraft, description: e.target.value })}
                                placeholder="Optional notes or agenda"
                                rows={3}
                            />
                        </label>
                        <label>
                            Invitee emails
                            <input
                                type="text"
                                value={scheduleDraft.invitees}
                                onChange={(e) => setScheduleDraft({ ...scheduleDraft, invitees: e.target.value })}
                                placeholder="name@example.com, name2@example.com"
                            />
                        </label>
                        <label>
                            Event type
                            <select
                                value={scheduleDraft.eventType}
                                onChange={(e) => setScheduleDraft({ ...scheduleDraft, eventType: e.target.value })}
                            >
                                <option value="meeting">Meeting</option>
                                <option value="consultation">Consultation</option>
                                <option value="checkin">Check-in</option>
                                <option value="followup">Follow-up</option>
                            </select>
                        </label>
                        <label>
                            Video call
                            <select
                                value={scheduleDraft.isVideoCall ? 'yes' : 'no'}
                                onChange={(e) => setScheduleDraft({ ...scheduleDraft, isVideoCall: e.target.value === 'yes' })}
                            >
                                <option value="no">No</option>
                                <option value="yes">Yes</option>
                            </select>
                        </label>
                        <label>
                            Date
                            <input
                                type="date"
                                value={scheduleDraft.date}
                                onChange={(e) => setScheduleDraft({ ...scheduleDraft, date: e.target.value })}
                                required
                            />
                        </label>
                        <label>
                            Start time
                            <input
                                type="time"
                                value={scheduleDraft.startTime}
                                onChange={(e) => setScheduleDraft({ ...scheduleDraft, startTime: e.target.value })}
                                required
                            />
                        </label>
                        <label>
                            End time
                            <input
                                type="time"
                                value={scheduleDraft.endTime}
                                onChange={(e) => setScheduleDraft({ ...scheduleDraft, endTime: e.target.value })}
                                required
                            />
                        </label>
                        <label>
                            Location / link
                            <input
                                type="text"
                                value={scheduleDraft.location}
                                onChange={(e) => setScheduleDraft({ ...scheduleDraft, location: e.target.value })}
                                placeholder="Zoom, Meet, or room"
                            />
                        </label>
                    </div>
                    <div className="psych-schedule-modal__footer">
                        <button type="button" className="btn btn-outline" onClick={closeScheduleModal}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={scheduleSaving}>
                            {scheduleSaving ? 'Saving...' : 'Save event'}
                        </button>
                    </div>
                </form>
            </Modal>

            {showKycModal && (
                <div className="reg-modal-backdrop">
                    <div className="reg-modal">
                        <h3>Upload verification documents</h3>
                        <p>Complete KYC to unlock psychologist actions.</p>
                        <div className="reg-doc-grid">
                            {PSY_KYC_DOCUMENTS.map((doc) => {
                                const current = kycDocuments[doc.type];
                                return (
                                    <div key={doc.type} className="reg-doc-card">
                                        <strong className="reg-doc-card-title">{doc.label}</strong>
                                        {current ? (
                                            <div className="reg-doc-body">
                                                <span className="reg-field-hint">{current.filename || 'Uploaded document'}</span>
                                                <div className="reg-doc-actions">
                                                    <a
                                                        href={resolveMediaUrl(current.url)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="reg-btn-ghost reg-btn-pill"
                                                    >
                                                        Preview
                                                    </a>
                                                    <button
                                                        type="button"
                                                        className="reg-btn-ghost reg-btn-pill"
                                                        onClick={() => setKycDocuments((prev) => ({ ...prev, [doc.type]: undefined }))}
                                                    >
                                                        Replace
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <label className="reg-btn-ghost reg-upload-btn">
                                                <input
                                                    type="file"
                                                    accept=".pdf,.png,.jpg,.jpeg"
                                                    onChange={(event) => {
                                                        const file = event.target.files?.[0];
                                                        if (file) handleKycUpload(doc.type, file);
                                                        event.target.value = '';
                                                    }}
                                                    disabled={!!kycUploading[doc.type]}
                                                    className="reg-upload-input"
                                                />
                                                {kycUploading[doc.type] ? 'Uploadingâ€¦' : 'Upload file'}
                                            </label>
                                        )}
</div>
                                );
                            })}
                        </div>
                        <div className="reg-modal-actions">
                            <button type="button" className="reg-btn-ghost" onClick={() => setShowKycModal(false)}>
                                Cancel
                            </button>
                            <button type="button" className="reg-submit-btn" onClick={handleKycSubmit} disabled={kycSubmitting}>
                                {kycSubmitting ? 'Submittingâ€¦' : 'Submit documents'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Dashboard;






