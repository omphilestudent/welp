import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Loading from '../../../components/common/Loading';
import AppSettingsForm from '../../../components/kodi/portal/AppSettingsForm';
import { getPortalSettings, listPortalPages, updatePortalSettings } from '../../../services/kodiPortalService';

const AppSettings = () => {
    const { appId } = useParams();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState(null);
    const [pages, setPages] = useState([]);

    const load = async () => {
        setLoading(true);
        try {
            const [detail, pageRows] = await Promise.all([getPortalSettings(appId), listPortalPages(appId)]);
            setSettings({
                ...detail,
                themeConfig: detail.themeConfig || {},
                settings: detail.settings || {}
            });
            setPages(pageRows || []);
        } catch (error) {
            toast.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [appId]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updatePortalSettings(appId, {
                name: settings.name,
                label: settings.label,
                description: settings.description,
                icon: settings.icon,
                defaultPageId: settings.defaultPageId || null,
                navigationMode: settings.navigationMode,
                landingBehavior: settings.landingBehavior,
                themeConfig: settings.themeConfig || {},
                settings: settings.settings || {}
            });
            toast.success('Settings saved');
            load();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <Loading />;
    if (!settings) return <p className="kodi-portal-empty">App not found.</p>;

    return (
        <div className="kodi-portal-screen">
            <header className="kodi-portal-header">
                <div>
                    <p className="kodi-portal-eyebrow">Kodi Portal</p>
                    <h1>App Settings</h1>
                </div>
            </header>
            <AppSettingsForm value={settings} pages={pages} onChange={setSettings} onSubmit={handleSave} saving={saving} />
        </div>
    );
};

export default AppSettings;
