import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Loading from '../../../components/common/Loading';
import AppForm from '../../../components/kodi/portal/AppForm';
import PortalNav from '../../../components/kodi/portal/PortalNav';
import { activatePortalApp, createPortalApp, deactivatePortalApp, listPortalApps } from '../../../services/kodiPortalService';

const AppsList = () => {
    const navigate = useNavigate();
    const [apps, setApps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState({ name: '', label: '', description: '', icon: '' });

    const load = async () => {
        setLoading(true);
        try {
            const rows = await listPortalApps();
            setApps(rows);
        } catch (error) {
            toast.error('Failed to load apps');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handleCreate = async () => {
        if (!form.name.trim()) {
            toast.error('App name is required');
            return;
        }
        setCreating(true);
        try {
            await createPortalApp(form);
            toast.success('App created');
            setFormOpen(false);
            setForm({ name: '', label: '', description: '', icon: '' });
            load();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to create app');
        } finally {
            setCreating(false);
        }
    };

    const handleToggle = async (app) => {
        try {
            if (app.status === 'active') {
                await deactivatePortalApp(app.id);
                toast.success('App deactivated');
            } else {
                await activatePortalApp(app.id);
                toast.success('App activated');
            }
            load();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to update app status');
        }
    };

    return (
        <div className="kodi-portal-screen">
            <header className="kodi-portal-header">
                <div>
                    <p className="kodi-portal-eyebrow">Kodi Portal</p>
                    <h1>Apps</h1>
                </div>
                <button className="btn-primary" onClick={() => setFormOpen(true)}>Create App</button>
            </header>
            <PortalNav />
            {loading ? (
                <Loading />
            ) : (
                <div className="kodi-portal-grid">
                    {apps.map((app) => (
                        <div key={app.id} className="kodi-portal-card">
                            <div>
                                <h3>{app.label || app.name}</h3>
                                <p>{app.description || 'No description'}</p>
                            </div>
                            <div className="kodi-portal-card-meta">
                                <span>Status: {app.status}</span>
                                <span>Users: {app.userCount ?? 0}</span>
                                <span>Pages: {app.pageCount ?? 0}</span>
                            </div>
                            <div className="kodi-portal-card-actions">
                                <button className="btn-text" onClick={() => navigate(`/kodi/portal/apps/${app.id}`)}>
                                    Open
                                </button>
                                <button className="btn-text" onClick={() => handleToggle(app)}>
                                    {app.status === 'active' ? 'Deactivate' : 'Activate'}
                                </button>
                            </div>
                        </div>
                    ))}
                    {!apps.length && <p className="kodi-portal-empty">No apps yet.</p>}
                </div>
            )}

            {formOpen && (
                <div className="kodi-portal-modal">
                    <div className="kodi-portal-modal__content">
                        <div className="kodi-portal-modal__header">
                            <h2>Create App</h2>
                            <button className="btn-text" onClick={() => setFormOpen(false)}>Close</button>
                        </div>
                        <AppForm value={form} onChange={setForm} />
                        <button className="btn-primary" onClick={handleCreate} disabled={creating}>
                            {creating ? 'Creating...' : 'Create App'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AppsList;
