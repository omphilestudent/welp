import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { listUserApps, getPortalNavigation } from '../../services/kodiPortalService';

const AppTopBar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [apps, setApps] = useState([]);
    const [nav, setNav] = useState([]);
    const [appMeta, setAppMeta] = useState(null);
    const [switcherOpen, setSwitcherOpen] = useState(false);
    const [openTabs, setOpenTabs] = useState([]);
    const [search, setSearch] = useState('');

    const appId = useMemo(() => {
        const match = location.pathname.match(/\/kodi\/app\/([^/]+)/);
        return match ? match[1] : null;
    }, [location.pathname]);

    useEffect(() => {
        if (!appId) return;
        const load = async () => {
            try {
                const [appsList, navData] = await Promise.all([
                    listUserApps(),
                    getPortalNavigation(appId)
                ]);
                setApps(appsList || []);
                setNav(navData?.navigation || []);
                setAppMeta(navData?.app || null);
            } catch (error) {
                setApps([]);
                setNav([]);
                setAppMeta(null);
            }
        };
        load();
    }, [appId]);

    useEffect(() => {
        if (!appId) return;
        const stored = window.localStorage.getItem(`kodi-open-tabs-${appId}`);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) setOpenTabs(parsed);
            } catch (error) {
                setOpenTabs([]);
            }
        } else {
            setOpenTabs([]);
        }
    }, [appId]);

    useEffect(() => {
        if (!appId) return;
        window.localStorage.setItem(`kodi-open-tabs-${appId}`, JSON.stringify(openTabs));
    }, [appId, openTabs]);

    const activePageId = useMemo(() => {
        const activePageMatch = location.pathname.match(/\/kodi\/app\/[^/]+\/page\/([^/]+)/);
        return activePageMatch ? activePageMatch[1] : null;
    }, [location.pathname]);
    const navMap = useMemo(() => new Map((nav || []).map((item) => [String(item.pageId), item])), [nav]);
    const currentPage = activePageId ? navMap.get(String(activePageId)) : null;
    const defaultPage = (nav || []).find((item) => item.isDefault) || nav[0] || null;

    useEffect(() => {
        if (!activePageId) return;
        setOpenTabs((prev) => (prev.includes(activePageId) ? prev : [...prev, activePageId]));
    }, [activePageId]);

    if (!appId) return null;

    const theme = appMeta?.themeConfig || appMeta?.theme_config || {};
    const settings = appMeta?.settings || {};
    const navbarStyle = settings.navbarStyle || theme.navbarStyle || 'dark';
    const logoUrl = settings.logoUrl || appMeta?.icon;
    const styleVars = {
        '--kodi-app-primary': theme.primaryColor || '#2563eb',
        '--kodi-app-accent': theme.accentColor || '#38bdf8',
        '--kodi-app-surface': theme.surfaceColor || (navbarStyle === 'light' ? '#ffffff' : '#0b1120'),
        '--kodi-app-text': theme.textColor || (navbarStyle === 'light' ? '#0f172a' : '#e2e8f0')
    };

    const handleNavigatePage = (pageId) => {
        if (!pageId) return;
        if (!openTabs.includes(pageId)) {
            setOpenTabs((prev) => [...prev, pageId]);
        }
        navigate(`/kodi/app/${appId}/page/${pageId}`);
    };

    const handleCloseTab = (pageId) => {
        setOpenTabs((prev) => prev.filter((id) => id !== pageId));
        if (String(activePageId) !== String(pageId)) return;
        const remaining = openTabs.filter((id) => id !== pageId);
        const next = remaining[remaining.length - 1] || defaultPage?.pageId;
        if (next) navigate(`/kodi/app/${appId}/page/${next}`);
    };

    return (
        <div className={`kodi-topbar kodi-topbar--${navbarStyle}`} style={styleVars}>
            <div className="kodi-topbar__left">
                <button
                    className="kodi-topbar__switcher"
                    onClick={() => setSwitcherOpen(!switcherOpen)}
                    aria-label="Open page switcher"
                >
                    {currentPage?.label || 'Pages'}
                    <span className="kodi-topbar__chevron">{'\u25BE'}</span>
                </button>
                {logoUrl && <img className="kodi-topbar__logo" src={logoUrl} alt="App logo" />}
                <div className="kodi-topbar__appname">
                    {settings.titleDisplay === 'compact'
                        ? (appMeta?.label || 'App').slice(0, 14)
                        : (appMeta?.label || 'App')}
                </div>
                <nav className="kodi-topbar__tabs">
                    {openTabs.map((tabId) => {
                        const item = navMap.get(String(tabId));
                        if (!item) return null;
                        const isActive = String(activePageId) === String(tabId);
                        return (
                            <div key={tabId} className={`kodi-topbar__tab ${isActive ? 'active' : ''}`}>
                                <button type="button" onClick={() => handleNavigatePage(tabId)}>
                                    {item.label}
                                </button>
                                <button
                                    type="button"
                                    className="kodi-topbar__tab-close"
                                    onClick={() => handleCloseTab(tabId)}
                                    aria-label="Close tab"
                                >
                                    {'\u00D7'}
                                </button>
                            </div>
                        );
                    })}
                </nav>
                {switcherOpen && (
                    <div className="kodi-topbar__menu">
                        <div className="kodi-topbar__menu-section">
                            <p>Apps</p>
                            {apps.map((app) => (
                                <button
                                    key={app.app_id || app.id}
                                    className={String(app.app_id || app.id) === String(appId) ? 'active' : ''}
                                    onClick={() => {
                                        setSwitcherOpen(false);
                                        navigate(`/kodi/app/${app.app_id || app.id}`);
                                    }}
                                >
                                    {app.label || app.name}
                                </button>
                            ))}
                        </div>
                        <div className="kodi-topbar__menu-section">
                            <p>Pages</p>
                            {nav.map((item) => (
                                <button
                                    key={item.pageId}
                                    className={String(item.pageId) === String(activePageId) ? 'active' : ''}
                                    onClick={() => {
                                        setSwitcherOpen(false);
                                        handleNavigatePage(item.pageId);
                                    }}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <div className="kodi-topbar__center">
                <div className="kodi-topbar__search">
                    <input
                        type="search"
                        value={search}
                        placeholder="Search..."
                        onChange={(event) => setSearch(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key !== 'Enter') return;
                            const query = search.trim();
                            if (!query) return;
                            navigate(`/search?q=${encodeURIComponent(query)}`);
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => {
                            const query = search.trim();
                            if (!query) return;
                            navigate(`/search?q=${encodeURIComponent(query)}`);
                        }}
                    >
                        Search
                    </button>
                </div>
            </div>
            <div className="kodi-topbar__right">
                <button type="button" className="kodi-topbar__action">
                    New
                </button>
                <button type="button" className="kodi-topbar__action kodi-topbar__action--ghost">
                    Follow
                </button>
            </div>
        </div>
    );
};

export default AppTopBar;
