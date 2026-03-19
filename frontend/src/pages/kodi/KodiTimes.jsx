import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Loading from '../../components/common/Loading';
import {
    activatePlatformPage,
    createPlatformPage,
    linkPlatformPage,
    listPlatformPages
} from '../../services/kodiPageService';
import { listPortalApps } from '../../services/kodiPortalService';
import './KodiTimes.css';

const PAGE_TYPES = [
    { value: 'record', label: 'Record Page' },
    { value: 'app', label: 'App Page' },
    { value: 'home', label: 'Home Page' }
];

const statusStyles = {
    draft: { label: 'Draft', className: 'status-chip draft' },
    built: { label: 'Built', className: 'status-chip built' },
    activated: { label: 'Activated', className: 'status-chip activated' }
};

const formatDateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return '—';
    return date.toLocaleString();
};

const KodiTimes = () => {
    const navigate = useNavigate();
    const [pages, setPages] = useState([]);
    const [apps, setApps] = useState([]);
    const [loadingPages, setLoadingPages] = useState(true);
    const [loadingApps, setLoadingApps] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [linkModal, setLinkModal] = useState({ open: false, page: null });
    const [form, setForm] = useState({ label: '', pageType: 'record' });
    const [creating, setCreating] = useState(false);
    const [activatingId, setActivatingId] = useState(null);
    const [selectedAppId, setSelectedAppId] = useState('');

    const fetchPages = async () => {
        setLoadingPages(true);
        try {
            const data = await listPlatformPages();
            setPages(data);
        } catch (error) {
            toast.error('Failed to load Kodi pages');
        } finally {
            setLoadingPages(false);
        }
    };

    const fetchApps = async () => {
        setLoadingApps(true);
        try {
            const data = await listPortalApps();
            setApps(data);
        } catch (error) {
            toast.error('Cannot load Kodi apps');
        } finally {
            setLoadingApps(false);
        }
    };

    useEffect(() => {
        fetchPages();
        fetchApps();
    }, []);

    const unactivatedPages = useMemo(
        () => pages.filter((page) => page.status !== 'activated' || !page.linked_app_id),
        [pages]
    );

    const openCreateModal = () => {
        setForm({ label: '', pageType: 'record' });
        setModalOpen(true);
    };

    const handleCreate = async (event) => {
        event.preventDefault();
        if (!form.label.trim()) {
            toast.error('Enter a page label');
            return;
        }
        setCreating(true);
        try {
            const page = await createPlatformPage({
                label: form.label.trim(),
                pageType: form.pageType
            });
            toast.success('Page created — loading builder');
            navigate(`/kodi/builder/${page.id}`);
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to create page');
        } finally {
            setCreating(false);
            setModalOpen(false);
            fetchPages();
        }
    };

    const handleActivate = async (page) => {
        setActivatingId(page.id);
        try {
            await activatePlatformPage(page.id);
            toast.success('Page activated');
            fetchPages();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Activation failed');
        } finally {
            setActivatingId(null);
        }
    };

    const openLinkModal = (page) => {
        setSelectedAppId('');
        setLinkModal({ open: true, page });
    };

    const handleLinkSubmit = async () => {
        if (!selectedAppId) {
            toast.error('Select an app to link');
            return;
        }
        try {
            await linkPlatformPage(linkModal.page.id, selectedAppId);
            toast.success('Page linked to Kodi app');
            setLinkModal({ open: false, page: null });
            fetchPages();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to link page');
        }
    };

    return (
        <div className="kodi-times">
            <header className="kodi-times__header">
                <div className="kodi-page-header">
                    <button className="kodi-back-button" onClick={() => navigate('/admin/dashboard')}>
                        â† Back
                    </button>
                    <div>
                    <p className="kodi-times__eyebrow">Times Builder</p>
                    <h1>Kodi Pages</h1>
                    </div>
                </div>
                <button className="btn-primary" onClick={openCreateModal}>
                    + Add New Kodi Page
                </button>
            </header>

            <section className="kodi-times__table-wrapper">
                <header className="kodi-times__section-header">
                    <h2>Times</h2>
                    <p className="kodi-times__subtitle">Built pages, statuses, linked apps, and ownership.</p>
                </header>
                {loadingPages ? (
                    <div className="kodi-times__loader">
                        <Loading />
                    </div>
                ) : (
                    <div className="kodi-times__table">
                        <div className="kodi-times__row kodi-times__row--header">
                            <span>Label</span>
                            <span>Type</span>
                            <span>Status</span>
                            <span>Linked App</span>
                            <span>Created By</span>
                            <span>Created At</span>
                            <span>Actions</span>
                        </div>
                        {pages.map((page) => {
                            const statusKey = page.status?.toLowerCase() || 'draft';
                            const status = statusStyles[statusKey] || statusStyles.draft;
                            return (
                                <div key={page.id} className="kodi-times__row">
                                    <span>{page.label}</span>
                                    <span>{page.page_type}</span>
                                    <span>
                                        <span className={status.className}>{status.label}</span>
                                    </span>
                                    <span>{page.app_name || '—'}</span>
                                    <span>{page.created_by_name || '—'}</span>
                                    <span>{formatDateTime(page.created_at)}</span>
                                    <span className="kodi-times__actions">
                                        <button
                                            className="btn-text"
                                            onClick={() => navigate(`/kodi/builder/${page.id}`)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className="btn-text"
                                            onClick={() => handleActivate(page)}
                                            disabled={page.status === 'activated' || activatingId === page.id}
                                        >
                                            Activate
                                        </button>
                                        <button
                                            className="btn-text"
                                            onClick={() => openLinkModal(page)}
                                            disabled={page.status !== 'activated'}
                                        >
                                            Link to App
                                        </button>
                                        <button
                                            className="btn-text"
                                            onClick={() => navigate(`/kodi/runtime/${page.id}`)}
                                            disabled={page.status !== 'activated'}
                                        >
                                            View Runtime
                                        </button>
                                    </span>
                                </div>
                            );
                        })}
                        {pages.length === 0 && (
                            <div className="kodi-times__empty">
                                No Kodi pages yet. Create one to begin building experiences.
                            </div>
                        )}
                    </div>
                )}
            </section>

            {unactivatedPages.length > 0 && (
                <section className="kodi-times__unactivated">
                    <div className="kodi-times__section-header">
                        <h3>Unassigned / Not Activated Pages</h3>
                    </div>
                    <div className="kodi-times__cards">
                        {unactivatedPages.map((page) => (
                            <div key={page.id} className="kodi-times__card">
                                <div>
                                    <strong>{page.label}</strong>
                                    <p>{page.page_type}</p>
                                </div>
                                <div className="kodi-times__card-status">
                                    <span className="status-chip" aria-label={page.status}>
                                        {page.status?.toUpperCase() || 'DRAFT'}
                                    </span>
                                    <span>{page.app_name ? 'Linked' : 'App pending'}</span>
                                </div>
                                <div className="kodi-times__card-actions">
                                    <button
                                        className="btn-text"
                                        onClick={() => navigate(`/kodi/builder/${page.id}`)}
                                    >
                                        Open Builder
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {modalOpen && (
                <div className="kodi-times__modal-backdrop">
                    <div className="kodi-times__modal">
                        <h3>Create Kodi Page</h3>
                        <form onSubmit={handleCreate}>
                            <label>
                                Label
                                <input
                                    value={form.label}
                                    onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                                    required
                                />
                            </label>
                            <label>
                                Page Type
                                <select
                                    value={form.pageType}
                                    onChange={(e) => setForm((prev) => ({ ...prev, pageType: e.target.value }))}
                                >
                                    {PAGE_TYPES.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <div className="kodi-times__modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={creating}>
                                    {creating ? 'Creating…' : 'Create page'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {linkModal.open && (
                <div className="kodi-times__modal-backdrop">
                    <div className="kodi-times__modal">
                        <h3>Link Page to App</h3>
                        <p>
                            <strong>{linkModal.page?.label}</strong>
                            <span className="kodi-times__modal-subtext">Select the app that will expose this page.</span>
                        </p>
                        {loadingApps ? (
                            <Loading />
                        ) : apps.length === 0 ? (
                            <p>No Kodi apps available. Create one in the portal first.</p>
                        ) : (
                            <label>
                                Select App
                                <select value={selectedAppId} onChange={(e) => setSelectedAppId(e.target.value)}>
                                    <option value="">Select an app</option>
                                    {apps.map((app) => (
                                        <option key={app.id} value={app.id}>
                                            {app.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                        <div className="kodi-times__modal-actions">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setLinkModal({ open: false, page: null })}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={handleLinkSubmit}
                                disabled={!apps.length || !selectedAppId}
                            >
                                Link Page
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KodiTimes;
