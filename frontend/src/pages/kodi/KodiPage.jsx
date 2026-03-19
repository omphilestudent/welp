import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
    FiBell,
    FiCalendar,
    FiDownload,
    FiEdit,
    FiLayout,
    FiLogOut,
    FiMaximize2,
    FiMenu,
    FiMinimize2,
    FiMoon,
    FiPrinter,
    FiRefreshCw,
    FiSearch,
    FiShare2,
    FiStar,
    FiSun,
    FiUsers,
    FiX
} from 'react-icons/fi';

import Loading from '../../components/common/Loading';
import DynamicRenderer from '../../components/kodi/DynamicRenderer';
import { fetchKodiPageBundle, getKodiPageToken, setKodiPageToken } from '../../services/kodiPageService';

import './KodiPage.css';

const toUiComponents = (bundleComponents) => {
    if (!Array.isArray(bundleComponents)) return [];
    return bundleComponents
        .map((entry) => {
            const component = entry?.component || entry;
            const id = component?.id || entry?.id;
            const component_name = component?.name || component?.component_name || entry?.component_name || entry?.name;
            const component_type = component?.type || component?.component_type || entry?.component_type;
            const version = component?.version || entry?.version;
            return id && component_name ? {
                id,
                component_name,
                component_type: component_type || 'component',
                version
            } : null;
        })
        .filter(Boolean);
};

const KodiPage = () => {
    const { slug } = useParams();
    const pageSlug = useMemo(() => String(slug || '').trim(), [slug]);
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [bundle, setBundle] = useState(null);
    const [theme, setTheme] = useState('light');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [bookmarked, setBookmarked] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [recentActivity, setRecentActivity] = useState([]);
    const [pageSettings, setPageSettings] = useState({
        compactMode: false,
        showBreadcrumbs: true,
        animations: true
    });

    const uiComponents = useMemo(() => toUiComponents(bundle?.components), [bundle?.components]);

    const filteredComponents = useMemo(() => {
        if (!searchTerm) return uiComponents;
        const q = searchTerm.toLowerCase();
        return uiComponents.filter((comp) => (
            (comp.component_name || '').toLowerCase().includes(q)
            || (comp.component_type || '').toLowerCase().includes(q)
        ));
    }, [uiComponents, searchTerm]);

    const load = useCallback(async () => {
        if (!pageSlug) return;

        const token = getKodiPageToken();
        if (!token) {
            navigate(`/kodi/page/${pageSlug}/login`, { replace: true });
            return;
        }

        setLoading(true);
        try {
            const res = await fetchKodiPageBundle(pageSlug);
            setBundle(res?.data || null);

            const savedTheme = localStorage.getItem(`kodi_theme_${pageSlug}`);
            if (savedTheme) setTheme(savedTheme);

            const bookmarks = JSON.parse(localStorage.getItem('kodi_bookmarks') || '[]');
            setBookmarked(bookmarks.includes(pageSlug));

            // UI-only: placeholders until we hook an API.
            setNotifications([
                { id: 1, type: 'info', message: 'New component available', time: '5 min ago' },
                { id: 2, type: 'success', message: 'Page loaded successfully', time: 'just now' }
            ]);
            setRecentActivity([
                { id: 1, action: 'Page viewed', user: 'You', time: 'just now' }
            ]);
        } catch (error) {
            const status = error?.response?.status;
            if (status === 401) {
                setKodiPageToken(null);
                navigate(`/kodi/page/${pageSlug}/login`, { replace: true });
                return;
            }
            toast.error(error?.response?.data?.error || 'Failed to load page');
        } finally {
            setLoading(false);
        }
    }, [pageSlug, navigate]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(`kodi_theme_${pageSlug}`, theme);
    }, [theme, pageSlug]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    const toggleBookmark = () => {
        const bookmarks = JSON.parse(localStorage.getItem('kodi_bookmarks') || '[]');
        if (bookmarked) {
            const updated = bookmarks.filter((b) => b !== pageSlug);
            localStorage.setItem('kodi_bookmarks', JSON.stringify(updated));
            toast.success('Removed from bookmarks');
        } else {
            bookmarks.push(pageSlug);
            localStorage.setItem('kodi_bookmarks', JSON.stringify(bookmarks));
            toast.success('Added to bookmarks');
        }
        setBookmarked((prev) => !prev);
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.();
            setFullscreen(true);
        } else {
            document.exitFullscreen?.();
            setFullscreen(false);
        }
    };

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            toast.success('Link copied to clipboard');
        } catch {
            toast.error('Failed to copy link');
        }
    };

    const handlePrint = () => window.print();

    const handleExport = () => {
        const data = {
            page: bundle?.page,
            components: bundle?.components,
            exportedAt: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${pageSlug}_export.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Page exported');
    };

    const signOut = () => {
        setKodiPageToken(null);
        navigate(`/kodi/page/${pageSlug}/login`, { replace: true });
    };

    if (loading) return <Loading />;

    if (!bundle?.page) {
        return (
            <div className="kodi-page-error">
                <FiLayout size={64} />
                <h2>Page Not Found</h2>
                <p>The page you’re looking for doesn’t exist or you don’t have access.</p>
                <button className="btn-primary" onClick={() => navigate('/kodi')}>
                    Return to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className={`kodi-page-container theme-${theme} ${fullscreen ? 'fullscreen' : ''}`}>
            <nav className="kodi-navbar">
                <div className="navbar-left">
                    <button className="kodi-back-button" onClick={() => navigate('/kodi/times')} type="button">
                        ← Back
                    </button>
                    <button className="nav-icon" onClick={() => setSidebarOpen((p) => !p)} type="button">
                        {sidebarOpen ? <FiX /> : <FiMenu />}
                    </button>
                    <Link to="/kodi" className="nav-logo">
                        <FiLayout className="logo-icon" />
                        <span>Kodi</span>
                    </Link>
                    <div className="nav-breadcrumbs">
                        <Link to="/kodi">Dashboard</Link>
                        <span>/</span>
                        <span className="current">{bundle.page.name}</span>
                    </div>
                </div>

                <div className="navbar-center">
                    <div className="search-box">
                        <FiSearch className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search components..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm ? (
                            <button className="clear-search" onClick={() => setSearchTerm('')} type="button">
                                <FiX />
                            </button>
                        ) : null}
                    </div>
                </div>

                <div className="navbar-right">
                    <button
                        className={`nav-icon ${bookmarked ? 'active' : ''}`}
                        onClick={toggleBookmark}
                        title={bookmarked ? 'Remove bookmark' : 'Bookmark page'}
                        type="button"
                    >
                        <FiStar />
                    </button>

                    <div className="notification-dropdown">
                        <button className="nav-icon" onClick={() => setShowNotifications((p) => !p)} type="button">
                            <FiBell />
                            {notifications.length > 0 ? (
                                <span className="notification-badge">{notifications.length}</span>
                            ) : null}
                        </button>

                        {showNotifications ? (
                            <div className="notification-panel">
                                <div className="notification-header">
                                    <h4>Notifications</h4>
                                    <button onClick={() => setNotifications([])} type="button">Clear all</button>
                                </div>
                                <div className="notification-list">
                                    {notifications.map((n) => (
                                        <div key={n.id} className={`notification-item type-${n.type}`}>
                                            <div className="notification-content">
                                                <p>{n.message}</p>
                                                <span className="notification-time">{n.time}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <button className="nav-icon" onClick={toggleTheme} title="Toggle theme" type="button">
                        {theme === 'light' ? <FiMoon /> : <FiSun />}
                    </button>

                    <button className="nav-icon" onClick={toggleFullscreen} title="Toggle fullscreen" type="button">
                        {fullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
                    </button>

                    <div className="user-menu">
                        <button className="user-avatar" type="button">
                            <FiUsers />
                        </button>
                        <div className="user-dropdown">
                            <button onClick={signOut} type="button">
                                <FiLogOut /> Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <aside className={`kodi-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <h3>Page Info</h3>
                    <span className="page-status">Live</span>
                </div>

                <div className="sidebar-stats">
                    <div className="stat-item">
                        <FiCalendar />
                        <div>
                            <span className="stat-label">Created</span>
                            <span className="stat-value">{new Date(bundle.page.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <div className="stat-item">
                        <FiLayout />
                        <div>
                            <span className="stat-label">Components</span>
                            <span className="stat-value">{uiComponents.length}</span>
                        </div>
                    </div>
                </div>

                <div className="sidebar-section">
                    <h4>Recent Activity</h4>
                    <div className="activity-list">
                        {recentActivity.map((activity) => (
                            <div key={activity.id} className="activity-item">
                                <div className="activity-dot" />
                                <div className="activity-content">
                                    <p className="activity-action">{activity.action}</p>
                                    <p className="activity-meta">{activity.user} • {activity.time}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="sidebar-section">
                    <h4>Quick Actions</h4>
                    <div className="action-buttons">
                        <button className="action-btn" onClick={handleShare} type="button">
                            <FiShare2 /> Share
                        </button>
                        <button className="action-btn" onClick={handleExport} type="button">
                            <FiDownload /> Export
                        </button>
                        <button className="action-btn" onClick={handlePrint} type="button">
                            <FiPrinter /> Print
                        </button>
                    </div>
                </div>

                <div className="sidebar-section">
                    <h4>Settings</h4>
                    <div className="settings-list">
                        <label className="setting-item">
                            <span>Compact Mode</span>
                            <input
                                type="checkbox"
                                checked={pageSettings.compactMode}
                                onChange={(e) => setPageSettings((prev) => ({ ...prev, compactMode: e.target.checked }))}
                            />
                        </label>
                        <label className="setting-item">
                            <span>Show Breadcrumbs</span>
                            <input
                                type="checkbox"
                                checked={pageSettings.showBreadcrumbs}
                                onChange={(e) => setPageSettings((prev) => ({ ...prev, showBreadcrumbs: e.target.checked }))}
                            />
                        </label>
                        <label className="setting-item">
                            <span>Animations</span>
                            <input
                                type="checkbox"
                                checked={pageSettings.animations}
                                onChange={(e) => setPageSettings((prev) => ({ ...prev, animations: e.target.checked }))}
                            />
                        </label>
                    </div>
                </div>

                <div className="sidebar-footer">
                    <button className="edit-page-btn" onClick={() => navigate(`/kodi/builder?page=${pageSlug}`)} type="button">
                        <FiEdit /> Edit in Builder
                    </button>
                </div>
            </aside>

            <main className={`kodi-main ${sidebarOpen ? 'sidebar-open' : ''} ${pageSettings.compactMode ? 'compact' : ''}`}>
                {pageSettings.showBreadcrumbs ? (
                    <div className="page-breadcrumbs">
                        <Link to="/kodi">Dashboard</Link>
                        <span>/</span>
                        <span>{bundle.page.name}</span>
                    </div>
                ) : null}

                <div className="page-header">
                    <div>
                        <h1 className="page-title">{bundle.page.name}</h1>
                        {bundle.page.description ? <p className="page-description">{bundle.page.description}</p> : null}
                    </div>
                    <div className="page-actions">
                        <button className="btn-icon" onClick={load} title="Refresh" type="button">
                            <FiRefreshCw />
                        </button>
                        <button className="btn-icon" onClick={handleShare} title="Share" type="button">
                            <FiShare2 />
                        </button>
                        <button className="btn-primary" onClick={() => navigate(`/kodi/builder?page=${pageSlug}`)} type="button">
                            <FiEdit /> Edit Page
                        </button>
                    </div>
                </div>

                {searchTerm && filteredComponents.length > 0 ? (
                    <div className="search-results">
                        <h3>Search Results ({filteredComponents.length})</h3>
                        <div className="search-results-grid">
                            {filteredComponents.map((comp) => (
                                <div key={comp.id} className="search-result-item">
                                    <div className="result-icon" />
                                    <div className="result-details">
                                        <div className="result-name">{comp.component_name}</div>
                                        <div className="result-type">{comp.component_type}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                <div className={`page-content ${pageSettings.animations ? 'animated' : ''}`}>
                    <DynamicRenderer
                        layout={bundle.page.layout || {}}
                        components={bundle.components || []}
                        context={{ page: bundle.page }}
                    />
                </div>
            </main>

            <footer className="kodi-footer">
                <div className="footer-left">
                    <span>© {new Date().getFullYear()} Kodi Platform</span>
                </div>
                <div className="footer-right">
                    <span className="footer-status">
                        <span className="status-dot" />
                        Connected
                    </span>
                </div>
            </footer>
        </div>
    );
};

export default KodiPage;
