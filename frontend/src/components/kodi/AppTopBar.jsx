import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { listUserApps, getPortalNavigation } from '../../services/kodiPortalService';

const AppTopBar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [apps, setApps] = useState([]);
    const [nav, setNav] = useState([]);
    const [appMeta, setAppMeta] = useState(null);
    const [switcherOpen, setSwitcherOpen] = useState(false);

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

    return (
        <div className={`kodi-topbar kodi-topbar--${navbarStyle}`} style={styleVars}>
            <button className="kodi-topbar__switcher" onClick={() => setSwitcherOpen(!switcherOpen)}>
                â˜°
            </button>
            {logoUrl && <img className="kodi-topbar__logo" src={logoUrl} alt="App logo" />}
            <div className="kodi-topbar__appname">
                {settings.titleDisplay === 'compact'
                    ? (appMeta?.label || 'App').slice(0, 14)
                    : (appMeta?.label || 'App')}
            </div>
            <nav className="kodi-topbar__tabs">
                {nav.map((item) => (
                    <NavLink
                        key={item.pageId}
                        to={`/kodi/app/${appId}/page/${item.pageId}`}
                        className={({ isActive }) => (isActive ? 'active' : '')}
                    >
                        {item.label}
                    </NavLink>
                ))}
            </nav>
            {switcherOpen && (
                <div className="kodi-topbar__menu">
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
            )}
        </div>
    );
};

export default AppTopBar;
