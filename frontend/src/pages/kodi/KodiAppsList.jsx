import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Loading from '../../components/common/Loading';
import { listUserApps } from '../../services/kodiPortalService';

const KodiAppsList = () => {
    const navigate = useNavigate();
    const [apps, setApps] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const rows = await listUserApps();
                setApps(rows || []);
            } catch (error) {
                toast.error('Failed to load apps');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) return <Loading />;

    return (
        <div className="kodi-runtime">
            <header className="kodi-runtime__header">
                <h1>Your Kodi Apps</h1>
            </header>
            <div className="kodi-portal-grid">
                {apps.map((app) => (
                    <div key={app.app_id || app.id} className="kodi-portal-card">
                        <h3>{app.label || app.name}</h3>
                        <button className="btn-primary" onClick={() => navigate(`/kodi/app/${app.app_id || app.id}`)}>
                            Open App
                        </button>
                    </div>
                ))}
                {!apps.length && <p className="kodi-portal-empty">No apps assigned.</p>}
            </div>
        </div>
    );
};

export default KodiAppsList;
