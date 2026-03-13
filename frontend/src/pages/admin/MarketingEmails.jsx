import React, { useEffect, useMemo, useState } from 'react';
import { FaPlus, FaEdit, FaTrash, FaPaperPlane, FaImage, FaEye, FaListUl } from 'react-icons/fa';
import api from '../../services/api';
import Loading from '../../components/common/Loading';

const STATUS_LABELS = {
    scheduled: 'Scheduled',
    processing: 'Sending',
    retrying: 'Retrying',
    sent: 'Sent',
    failed: 'Failed'
};

const formatDateInput = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
};

const formatTimeInput = (value) => {
    if (!value) return '14:00';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value?.slice(11, 16) || '14:00';
    return date.toISOString().slice(11, 16);
};

const defaultForm = () => {
    const date = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    return {
        name: '',
        subject: '',
        audience: 'user',
        scheduleDate: date.toISOString().split('T')[0],
        scheduleTime: '14:00',
        recurrence: 'none',
        requireSubscription: false,
        payload: {
            intro: 'We have refreshed our pricing plans to give Welp users more value at every tier.',
            previewText: 'Fresh pricing, clearer value, delivered to your inbox.',
            ctaLabel: 'View Pricing',
            ctaUrl: '/pricing'
        },
        assetUrls: []
    };
};

/* ─── Shared input focus handlers ─── */
const onFocusStyle = (e) => {
    e.target.style.borderColor = '#6366f1';
    e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)';
    e.target.style.background = '#fff';
};
const onBlurStyle = (e) => {
    e.target.style.borderColor = '#d1d5db';
    e.target.style.boxShadow = 'none';
    e.target.style.background = '#f9fafb';
};

const inputStyle = {
    width: '100%',
    padding: '9px 13px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '0.875rem',
    color: '#111827',
    background: '#f9fafb',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
};

const textareaStyle = {
    ...inputStyle,
    resize: 'vertical',
    fontFamily: "'Fira Code', 'Consolas', monospace",
    fontSize: '0.8rem',
    lineHeight: 1.6,
};

const labelStyle = {
    display: 'block',
    fontSize: '0.72rem',
    fontWeight: 700,
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '5px',
};

const fieldStyle = {
    display: 'flex',
    flexDirection: 'column',
};

const s = {
    page: {
        fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
        padding: '2rem 2.5rem',
        maxWidth: '1100px',
        margin: '0 auto',
        color: '#1a1d23',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '2rem',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid #e8eaed',
    },
    headerTitle: { margin: 0, fontSize: '1.6rem', fontWeight: 700, color: '#0f1117', letterSpacing: '-0.3px' },
    headerSub: { margin: '4px 0 0', fontSize: '0.875rem', color: '#6b7280' },
    btnPrimary: {
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '10px 20px', background: '#1a1d23', color: '#fff',
        border: 'none', borderRadius: '8px', fontSize: '0.875rem',
        fontWeight: 600, cursor: 'pointer', letterSpacing: '0.01em',
        transition: 'background 0.15s', whiteSpace: 'nowrap',
    },
    btnSecondary: {
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        padding: '9px 16px', background: '#fff', color: '#374151',
        border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.875rem',
        fontWeight: 500, cursor: 'pointer', transition: 'background 0.15s',
    },
    btnIndigoSm: {
        display: 'inline-flex', alignItems: 'center', gap: '7px',
        padding: '9px 18px', background: '#6366f1', color: '#fff',
        border: 'none', borderRadius: '8px', fontSize: '0.875rem',
        fontWeight: 600, cursor: 'pointer', transition: 'background 0.15s',
    },
    alert: {
        padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca',
        borderRadius: '8px', color: '#b91c1c', fontSize: '0.875rem',
        marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px',
    },
    overlay: {
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(2px)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    },
    modal: {
        background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '680px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        maxHeight: '92vh',
    },
    modalHeader: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1.25rem 1.5rem', borderBottom: '1px solid #f3f4f6', flexShrink: 0,
    },
    modalTitle: { margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f1117' },
    modalClose: {
        width: '32px', height: '32px', background: '#f3f4f6', border: 'none',
        borderRadius: '8px', cursor: 'pointer', fontSize: '18px', color: '#6b7280',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        lineHeight: 1, transition: 'background 0.15s',
    },
    modalBody: {
        padding: '1.5rem', overflowY: 'auto', flex: 1,
        display: 'flex', flexDirection: 'column', gap: '1.1rem',
    },
    modalFooter: {
        display: 'flex', justifyContent: 'flex-end', gap: '10px',
        padding: '1rem 1.5rem', borderTop: '1px solid #f3f4f6',
        background: '#fafafa', flexShrink: 0,
    },
    sectionDivider: {
        fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        borderBottom: '1px solid #f3f4f6', paddingBottom: '6px',
        marginBottom: '2px',
    },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
    toggleRow: {
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', background: '#f9fafb',
        border: '1px solid #e5e7eb', borderRadius: '8px',
        padding: '10px 14px',
    },
    toggleLabel: { fontSize: '0.875rem', fontWeight: 500, color: '#374151' },
    toggleSub: { fontSize: '0.78rem', color: '#9ca3af', marginTop: '1px' },
    uploadBox: {
        border: '1.5px dashed #d1d5db', borderRadius: '8px',
        padding: '14px 16px', background: '#fafafa',
        display: 'flex', flexDirection: 'column', gap: '10px',
    },
    uploadBtn: {
        display: 'inline-flex', alignItems: 'center', gap: '7px',
        padding: '7px 14px', background: '#fff', color: '#374151',
        border: '1px solid #d1d5db', borderRadius: '7px',
        fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
        alignSelf: 'flex-start',
    },
    chipRow: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' },
    chip: {
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '4px 10px', background: '#eff6ff', color: '#1d4ed8',
        borderRadius: '20px', fontSize: '0.75rem', fontWeight: 500,
    },
    chipRemove: {
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#93c5fd', fontSize: '13px', padding: '0 0 0 3px',
        lineHeight: 1, display: 'flex', alignItems: 'center',
    },
    hint: { fontSize: '0.78rem', color: '#9ca3af', fontStyle: 'italic' },
    pillBase: {
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '3px 10px', borderRadius: '20px',
        fontSize: '0.75rem', fontWeight: 600,
    },
};

const STATUS_STYLES = {
    scheduled: { background: '#eff6ff', color: '#1d4ed8' },
    processing: { background: '#fef9c3', color: '#92400e' },
    retrying:   { background: '#fff7ed', color: '#c2410c' },
    sent:       { background: '#dcfce7', color: '#15803d' },
    failed:     { background: '#fef2f2', color: '#b91c1c' },
};

const TOGGLE_CSS = `
.ec-switch{position:relative;display:inline-block;width:40px;height:22px}
.ec-switch input{opacity:0;width:0;height:0}
.ec-slider{position:absolute;cursor:pointer;inset:0;background:#d1d5db;border-radius:22px;transition:.2s}
.ec-slider:before{content:'';position:absolute;height:16px;width:16px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s}
input:checked+.ec-slider{background:#6366f1}
input:checked+.ec-slider:before{transform:translateX(18px)}
`;

const MarketingEmails = () => {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [form, setForm] = useState(defaultForm());
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [preview, setPreview] = useState(null);
    const [logs, setLogs] = useState([]);
    const [logCampaign, setLogCampaign] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => { fetchCampaigns(); }, []);

    const fetchCampaigns = async () => {
        setLoading(true); setError('');
        try {
            const { data } = await api.get('/admin/emailCampaigns');
            setCampaigns(data.campaigns || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load email campaigns');
        } finally { setLoading(false); }
    };

    const openNew = () => { setEditingId(null); setForm(defaultForm()); setModalOpen(true); };
    const openEdit = (c) => {
        setEditingId(c.id);
        setForm({
            name: c.name, subject: c.subject, audience: c.audience,
            scheduleDate: formatDateInput(c.scheduled_for),
            scheduleTime: formatTimeInput(c.scheduled_for),
            recurrence: c.recurrence || 'none',
            requireSubscription: Boolean(c.require_subscription),
            payload: {
                intro: c.payload?.intro || '',
                previewText: c.payload?.previewText || '',
                ctaLabel: c.payload?.ctaLabel || 'View Pricing',
                ctaUrl: c.payload?.ctaUrl || '/pricing',
            },
            assetUrls: c.asset_urls || [],
        });
        setModalOpen(true);
    };

    const handleInputChange = (field, value) => {
        if (field.startsWith('payload.')) {
            const key = field.split('.')[1];
            setForm(prev => ({ ...prev, payload: { ...prev.payload, [key]: value } }));
        } else {
            setForm(prev => ({ ...prev, [field]: value }));
        }
    };

    const handleSave = async () => {
        setSaving(true); setError('');
        try {
            if (editingId) await api.put(`/admin/emailCampaigns/${editingId}`, form);
            else await api.post('/admin/emailCampaigns', form);
            setModalOpen(false); setForm(defaultForm()); setEditingId(null);
            await fetchCampaigns();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save campaign');
        } finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this campaign?')) return;
        try { await api.delete(`/admin/emailCampaigns/${id}`); await fetchCampaigns(); }
        catch (err) { setError(err.response?.data?.error || 'Failed to delete campaign'); }
    };

    const handleSendNow = async (id) => {
        try { await api.post(`/admin/emailCampaigns/${id}/send`); await fetchCampaigns(); }
        catch (err) { setError(err.response?.data?.error || 'Failed to trigger campaign'); }
    };

    const handlePreview = async (id) => {
        try {
            const { data } = id
                ? await api.get(`/admin/emailCampaigns/${id}/preview`)
                : await api.post('/admin/emailCampaigns/preview', form);
            setPreview(data);
        } catch (err) { setError(err.response?.data?.error || 'Failed to load preview'); }
    };

    const handleLogs = async (campaign) => {
        try {
            const { data } = await api.get(`/admin/emailCampaigns/${campaign.id}/logs`);
            setLogCampaign(campaign); setLogs(data.logs || []);
        } catch (err) { setError(err.response?.data?.error || 'Failed to load logs'); }
    };

    const handleUpload = async (files) => {
        if (!files?.length) return;
        setUploading(true);
        try {
            const fd = new FormData();
            Array.from(files).forEach(f => fd.append('assets', f));
            const { data } = await api.post('/admin/emailCampaigns/assets', fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const newUrls = (data.assets || []).map(a => a.url);
            setForm(prev => ({ ...prev, assetUrls: [...prev.assetUrls, ...newUrls] }));
        } catch (err) { setError(err.response?.data?.error || 'Failed to upload'); }
        finally { setUploading(false); }
    };

    const removeAsset = (url) =>
        setForm(prev => ({ ...prev, assetUrls: prev.assetUrls.filter(u => u !== url) }));

    const filteredCampaigns = useMemo(() =>
            statusFilter === 'all' ? campaigns : campaigns.filter(c => c.status === statusFilter),
        [campaigns, statusFilter]);

    const statusSummary = useMemo(() => [
        { key: 'scheduled', label: 'Scheduled', count: campaigns.filter(c => c.status === 'scheduled').length },
        { key: 'sent',      label: 'Sent',      count: campaigns.filter(c => c.status === 'sent').length },
        { key: 'failed',    label: 'Failed',    count: campaigns.filter(c => c.status === 'failed').length },
    ], [campaigns]);

    const formatDateTime = (v) => {
        if (!v) return '--';
        const d = new Date(v);
        return isNaN(d) ? '--' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    };

    return (
        <div style={s.page}>
            <style>{TOGGLE_CSS}</style>

            {/* Header */}
            <div style={s.header}>
                <div>
                    <h1 style={s.headerTitle}>Email Marketing</h1>
                    <p style={s.headerSub}>Schedule pricing campaigns with inline logos, recurrence options, and delivery logs.</p>
                </div>
                <button style={s.btnPrimary} onClick={openNew}
                        onMouseEnter={e => e.currentTarget.style.background = '#2d3139'}
                        onMouseLeave={e => e.currentTarget.style.background = '#1a1d23'}>
                    <FaPlus style={{ fontSize: '11px' }} /> New Campaign
                </button>
            </div>

            {error && <div style={s.alert}><span>⚠</span> {error}</div>}

            {/* Status filter pills */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {[...statusSummary, { key: 'all', label: 'All', count: campaigns.length }].map(item => (
                    <button key={item.key} onClick={() => setStatusFilter(item.key)} style={{
                        padding: '7px 16px', border: '1px solid',
                        borderColor: statusFilter === item.key ? '#6366f1' : '#e5e7eb',
                        borderRadius: '20px', background: statusFilter === item.key ? '#eef2ff' : '#fff',
                        color: statusFilter === item.key ? '#4338ca' : '#6b7280',
                        fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s',
                    }}>
                        {item.label}
                        <span style={{
                            background: statusFilter === item.key ? '#c7d2fe' : '#f3f4f6',
                            color: statusFilter === item.key ? '#4338ca' : '#9ca3af',
                            borderRadius: '10px', padding: '1px 7px', fontSize: '0.72rem', fontWeight: 700,
                        }}>{item.count}</span>
                    </button>
                ))}
            </div>

            {/* Campaign list */}
            {loading ? <Loading /> : filteredCampaigns.length === 0 ? (
                <div style={{
                    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
                    padding: '3rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem',
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.3 }}>✉</div>
                    No campaigns match this filter.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filteredCampaigns.map(campaign => (
                        <div key={campaign.id} style={{
                            background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
                            padding: '1.25rem 1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f1117' }}>{campaign.name}</h3>
                                    <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: '#6b7280' }}>{campaign.subject}</p>
                                </div>
                                <span style={{ ...s.pillBase, ...(STATUS_STYLES[campaign.status] || { background: '#f3f4f6', color: '#374151' }) }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }} />
                                    {STATUS_LABELS[campaign.status] || campaign.status}
                                </span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                                {[
                                    ['Audience', campaign.audience],
                                    ['Scheduled', formatDateTime(campaign.scheduled_for)],
                                    ['Recurrence', campaign.recurrence || 'none'],
                                    ['Delivery', `${campaign.sent_count || 0} sent / ${campaign.failed_count || 0} failed`],
                                ].map(([label, val]) => (
                                    <div key={label} style={{ background: '#f9fafb', borderRadius: '8px', padding: '8px 12px' }}>
                                        <div style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>{label}</div>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#111827' }}>{val}</div>
                                    </div>
                                ))}
                            </div>
                            {campaign.asset_urls?.length ? (
                                <div style={s.chipRow}>
                                    {campaign.asset_urls.map(url => (
                                        <span key={url} style={s.chip}><FaImage style={{ fontSize: '11px' }} /> {url.split('/').slice(-1)[0]}</span>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ ...s.hint, marginBottom: '10px' }}>Default Welp logos included automatically.</p>
                            )}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f3f4f6' }}>
                                {[
                                    { icon: <FaEdit />, label: 'Edit', action: () => openEdit(campaign) },
                                    { icon: <FaEye />, label: 'Preview', action: () => handlePreview(campaign.id) },
                                    { icon: <FaListUl />, label: 'Logs', action: () => handleLogs(campaign) },
                                ].map(btn => (
                                    <button key={btn.label} style={s.btnSecondary} onClick={btn.action}
                                            onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                                            onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                                        {btn.icon} {btn.label}
                                    </button>
                                ))}
                                <button style={{ ...s.btnIndigoSm, marginLeft: 'auto' }} onClick={() => handleSendNow(campaign.id)}
                                        onMouseEnter={e => e.currentTarget.style.background = '#4f46e5'}
                                        onMouseLeave={e => e.currentTarget.style.background = '#6366f1'}>
                                    <FaPaperPlane style={{ fontSize: '12px' }} /> Send Now
                                </button>
                                <button style={{ ...s.btnSecondary, color: '#ef4444', borderColor: '#fecaca' }}
                                        onClick={() => handleDelete(campaign.id)}
                                        onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                                    <FaTrash /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ─── New / Edit Campaign Modal ─── */}
            {modalOpen && (
                <div style={s.overlay} onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
                    <div style={s.modal}>
                        <div style={s.modalHeader}>
                            <div>
                                <h3 style={s.modalTitle}>{editingId ? 'Edit Campaign' : 'New Campaign'}</h3>
                                <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#9ca3af' }}>
                                    {editingId ? 'Update the settings below.' : 'Fill in the details to schedule a new email campaign.'}
                                </p>
                            </div>
                            <button style={s.modalClose} onClick={() => setModalOpen(false)}
                                    onMouseEnter={e => e.currentTarget.style.background = '#e5e7eb'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#f3f4f6'}>×</button>
                        </div>

                        <div style={s.modalBody}>
                            {/* Basics */}
                            <div style={s.sectionDivider}>Campaign basics</div>
                            <div style={s.grid2}>
                                <div style={fieldStyle}>
                                    <label style={labelStyle}>Campaign Name</label>
                                    <input style={inputStyle} value={form.name} placeholder="March pricing drop"
                                           onChange={e => handleInputChange('name', e.target.value)}
                                           onFocus={onFocusStyle} onBlur={onBlurStyle} />
                                </div>
                                <div style={fieldStyle}>
                                    <label style={labelStyle}>Subject Line</label>
                                    <input style={inputStyle} value={form.subject} placeholder="New pricing plans are live"
                                           onChange={e => handleInputChange('subject', e.target.value)}
                                           onFocus={onFocusStyle} onBlur={onBlurStyle} />
                                </div>
                            </div>

                            {/* Audience & Schedule */}
                            <div style={s.sectionDivider}>Audience & schedule</div>
                            <div style={s.grid2}>
                                <div style={fieldStyle}>
                                    <label style={labelStyle}>Audience</label>
                                    <select style={inputStyle} value={form.audience}
                                            onChange={e => handleInputChange('audience', e.target.value)}
                                            onFocus={onFocusStyle} onBlur={onBlurStyle}>
                                        <option value="user">Users</option>
                                        <option value="psychologist">Psychologists</option>
                                        <option value="business">Businesses</option>
                                    </select>
                                </div>
                                <div style={fieldStyle}>
                                    <label style={labelStyle}>Recurrence</label>
                                    <select style={inputStyle} value={form.recurrence}
                                            onChange={e => handleInputChange('recurrence', e.target.value)}
                                            onFocus={onFocusStyle} onBlur={onBlurStyle}>
                                        <option value="none">One-off</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                </div>
                                <div style={fieldStyle}>
                                    <label style={labelStyle}>Schedule Date (SAST)</label>
                                    <input type="date" style={inputStyle} value={form.scheduleDate}
                                           onChange={e => handleInputChange('scheduleDate', e.target.value)}
                                           onFocus={onFocusStyle} onBlur={onBlurStyle} />
                                </div>
                                <div style={fieldStyle}>
                                    <label style={labelStyle}>Schedule Time (SAST)</label>
                                    <input type="time" style={inputStyle} value={form.scheduleTime}
                                           onChange={e => handleInputChange('scheduleTime', e.target.value)}
                                           onFocus={onFocusStyle} onBlur={onBlurStyle} />
                                </div>
                            </div>

                            {/* Subscription toggle */}
                            <div style={s.toggleRow}>
                                <div>
                                    <div style={s.toggleLabel}>Require active subscription</div>
                                    <div style={s.toggleSub}>Only send to users with a current paid plan</div>
                                </div>
                                <label className="ec-switch">
                                    <input type="checkbox" checked={form.requireSubscription}
                                           onChange={e => handleInputChange('requireSubscription', e.target.checked)} />
                                    <span className="ec-slider" />
                                </label>
                            </div>

                            {/* Email content */}
                            <div style={s.sectionDivider}>Email content</div>
                            <div style={fieldStyle}>
                                <label style={labelStyle}>Intro Message</label>
                                <textarea style={{ ...textareaStyle, minHeight: '90px' }} rows={3}
                                          value={form.payload.intro}
                                          placeholder="Highlight what is changing in this pricing update."
                                          onChange={e => handleInputChange('payload.intro', e.target.value)}
                                          onFocus={onFocusStyle} onBlur={onBlurStyle} />
                            </div>
                            <div style={fieldStyle}>
                                <label style={labelStyle}>
                                    Preview Text
                                    <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 400, marginLeft: '6px', textTransform: 'none', letterSpacing: 0 }}>shown in inbox</span>
                                </label>
                                <input style={inputStyle} value={form.payload.previewText}
                                       placeholder="Appears in inbox previews."
                                       onChange={e => handleInputChange('payload.previewText', e.target.value)}
                                       onFocus={onFocusStyle} onBlur={onBlurStyle} />
                            </div>
                            <div style={s.grid2}>
                                <div style={fieldStyle}>
                                    <label style={labelStyle}>CTA Label</label>
                                    <input style={inputStyle} value={form.payload.ctaLabel}
                                           onChange={e => handleInputChange('payload.ctaLabel', e.target.value)}
                                           onFocus={onFocusStyle} onBlur={onBlurStyle} />
                                </div>
                                <div style={fieldStyle}>
                                    <label style={labelStyle}>CTA URL</label>
                                    <input style={inputStyle} value={form.payload.ctaUrl}
                                           placeholder="https://..."
                                           onChange={e => handleInputChange('payload.ctaUrl', e.target.value)}
                                           onFocus={onFocusStyle} onBlur={onBlurStyle} />
                                </div>
                            </div>

                            {/* Assets */}
                            <div style={s.sectionDivider}>Logos & media</div>
                            <div style={s.uploadBox}>
                                <label style={s.uploadBtn}>
                                    <FaImage style={{ fontSize: '12px', color: '#6b7280' }} />
                                    {uploading ? 'Uploading…' : 'Upload images'}
                                    <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                                           onChange={e => { handleUpload(e.target.files); e.target.value = ''; }} />
                                </label>
                                {form.assetUrls.length === 0
                                    ? <span style={s.hint}>No uploads yet — default Welp logos will be embedded automatically.</span>
                                    : (
                                        <div style={s.chipRow}>
                                            {form.assetUrls.map(url => (
                                                <span key={url} style={s.chip}>
                                                    <FaImage style={{ fontSize: '11px' }} />
                                                    {url.split('/').slice(-1)[0]}
                                                    <button style={s.chipRemove} onClick={() => removeAsset(url)}>×</button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                            </div>
                        </div>

                        <div style={s.modalFooter}>
                            <button style={s.btnSecondary} onClick={() => setModalOpen(false)}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}>Cancel</button>
                            <button style={s.btnSecondary} onClick={() => handlePreview(editingId)}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                                <FaEye style={{ fontSize: '12px' }} /> Preview
                            </button>
                            <button style={{ ...s.btnIndigoSm, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
                                    onClick={handleSave} disabled={saving}
                                    onMouseEnter={e => !saving && (e.currentTarget.style.background = '#4f46e5')}
                                    onMouseLeave={e => (e.currentTarget.style.background = '#6366f1')}>
                                {saving ? 'Saving…' : 'Save Campaign'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview modal */}
            {preview && (
                <div style={s.overlay} onClick={e => e.target === e.currentTarget && setPreview(null)}>
                    <div style={{ ...s.modal, maxWidth: '800px' }}>
                        <div style={s.modalHeader}>
                            <h3 style={s.modalTitle}>Email Preview</h3>
                            <button style={s.modalClose} onClick={() => setPreview(null)}
                                    onMouseEnter={e => e.currentTarget.style.background = '#e5e7eb'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#f3f4f6'}>×</button>
                        </div>
                        <div style={{ ...s.modalBody, gap: '1rem' }}>
                            <iframe title="campaign-preview" srcDoc={preview.html} style={{
                                width: '100%', minHeight: '420px',
                                border: '1px solid #e5e7eb', borderRadius: '8px',
                            }} />
                            <div>
                                <div style={s.sectionDivider}>Plain text</div>
                                <pre style={{
                                    background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px',
                                    padding: '12px 16px', fontSize: '0.78rem', color: '#374151',
                                    whiteSpace: 'pre-wrap', fontFamily: "'Fira Code', monospace", margin: 0,
                                }}>{preview.text}</pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Logs modal */}
            {logCampaign && (
                <div style={s.overlay} onClick={e => e.target === e.currentTarget && setLogCampaign(null)}>
                    <div style={{ ...s.modal, maxWidth: '620px' }}>
                        <div style={s.modalHeader}>
                            <h3 style={s.modalTitle}>{logCampaign.name} — Delivery Logs</h3>
                            <button style={s.modalClose} onClick={() => setLogCampaign(null)}
                                    onMouseEnter={e => e.currentTarget.style.background = '#e5e7eb'}
                                    onMouseLeave={e => e.currentTarget.style.background = '#f3f4f6'}>×</button>
                        </div>
                        <div style={s.modalBody}>
                            {logs.length === 0 ? (
                                <p style={{ color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>No delivery logs yet.</p>
                            ) : logs.map(log => (
                                <div key={log.id} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '10px 14px', background: '#f9fafb', borderRadius: '8px',
                                    border: '1px solid #e5e7eb',
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>{log.recipient_email}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }}>{new Date(log.sent_at).toLocaleString()}</div>
                                        {log.error_message && <div style={{ fontSize: '0.75rem', color: '#b91c1c', marginTop: '2px' }}>{log.error_message}</div>}
                                    </div>
                                    <span style={{ ...s.pillBase, ...(STATUS_STYLES[log.status] || { background: '#f3f4f6', color: '#374151' }) }}>
                                        {log.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MarketingEmails;