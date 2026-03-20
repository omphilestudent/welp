import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Loading from '../../components/common/Loading';
import { getPortalNavigation, listUserApps } from '../../services/kodiPortalService';

const KodiAppShell = () => {
    const { appId } = useParams();
    const navigate = useNavigate();
    const [navigation, setNavigation] = useState([]);
    const [appMeta, setAppMeta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [apps, setApps] = useState([]);

    const load = async () => {
        setLoading(true);
        try {
            const [navData, userApps] = await Promise.all([
                getPortalNavigation(appId),
                listUserApps()
            ]);
            setNavigation(navData?.navigation || []);
            setAppMeta(navData?.app || null);
            setApps(userApps || []);
        } catch (error) {
            toast.error('Failed to load app navigation');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [appId]);

    const defaultPage = useMemo(
        () => navigation.find((item) => item.isDefault) || navigation[0] || null,
        [navigation]
    );

    useEffect(() => {
        if (!loading && defaultPage && window.location.pathname.endsWith(`/kodi/app/${appId}`)) {
            navigate(`/kodi/app/${appId}/page/${defaultPage.pageId}`, { replace: true });
        }
    }, [loading, defaultPage, appId, navigate]);

    if (loading) {
        return (
            <div className="kodi-app-shell">
                <Loading />
            </div>
        );
    }

    const theme = appMeta?.themeConfig || appMeta?.theme_config || {};
    const settings = appMeta?.settings || {};
    const shellStyle = {
        '--kodi-app-primary': theme.primaryColor || '#2563eb',
        '--kodi-app-accent': theme.accentColor || '#38bdf8',
        '--kodi-app-surface': theme.surfaceColor || '#0f172a',
        '--kodi-app-text': theme.textColor || '#e2e8f0'
    };
    const navMode = appMeta?.navigationMode || appMeta?.navigation_mode || 'top';
    const density = settings.layoutDensity || 'comfortable';

    return (
        <div className={`kodi-app-shell kodi-app-shell--${navMode} kodi-app-shell--${density}`} style={shellStyle}>
            <main className="kodi-app-shell__content">
                <Outlet />
            </main>
        </div>
    );
};

export default KodiAppShell;
