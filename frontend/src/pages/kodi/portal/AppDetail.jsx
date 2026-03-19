import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Loading from '../../../components/common/Loading';
import AppSummaryCard from '../../../components/kodi/portal/AppSummaryCard';
import { getPortalApp } from '../../../services/kodiPortalService';

const AppDetail = () => {
    const { appId } = useParams();
    const navigate = useNavigate();
    const [app, setApp] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const data = await getPortalApp(appId);
            setApp(data);
        } catch (error) {
            toast.error('Failed to load app detail');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [appId]);

    if (loading) return <Loading />;
    if (!app) return <p className="kodi-portal-empty">App not found.</p>;

    return (
        <div className="kodi-portal-screen">
            <header className="kodi-portal-header">
                <div>
                    <p className="kodi-portal-eyebrow">Kodi Portal</p>
                    <h1>{app.label || app.name}</h1>
                </div>
                <div className="kodi-portal-header-actions">
                    <button className="btn-secondary" onClick={() => navigate(`/kodi/portal/apps/${app.id}/users`)}>Manage Users</button>
                    <button className="btn-secondary" onClick={() => navigate(`/kodi/portal/apps/${app.id}/pages`)}>Manage Pages</button>
                    <button className="btn-secondary" onClick={() => navigate(`/kodi/portal/apps/${app.id}/settings`)}>Settings</button>
                </div>
            </header>

            <AppSummaryCard app={app} />

            <section className="kodi-portal-section">
                <h3>Navigation Preview</h3>
                {(app.navigation || []).length ? (
                    <ul className="kodi-portal-nav-preview">
                        {(app.navigation || []).map((item) => (
                            <li key={item.pageId}>
                                {item.label} {item.isDefault ? '(default)' : ''}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="kodi-portal-empty">No navigation configured.</p>
                )}
            </section>
        </div>
    );
};

export default AppDetail;
