import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Loading from '../../components/common/Loading';
import RuntimeRenderer from '../../components/kodi/RuntimeRenderer';
import { fetchRuntimePage } from '../../services/kodiPageService';

const KodiAppRuntimePage = () => {
    const { appId, pageId } = useParams();
    const [payload, setPayload] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!pageId) return;
        const load = async () => {
            setLoading(true);
            try {
                const data = await fetchRuntimePage(pageId, { appId });
                setPayload(data);
            } catch (err) {
                setError(err?.response?.data?.error || 'Failed to load runtime page');
                toast.error(err?.response?.data?.error || 'Failed to load runtime page');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [pageId, appId]);

    const role = payload?.effectiveRole;
    const hasAccess = useMemo(() => {
        const map = payload?.permissions || {};
        if (!Object.keys(map).length) return true;
        return Boolean(map?.[role]?.can_view);
    }, [payload, role]);

    if (loading) {
        return (
            <div className="kodi-runtime">
                <Loading />
            </div>
        );
    }

    if (error) {
        return (
            <div className="kodi-runtime">
                <div className="kodi-runtime__error">
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    if (!hasAccess) {
        return (
            <div className="kodi-runtime">
                <div className="kodi-runtime__error">
                    <p>Access denied.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="kodi-runtime">
            <header className="kodi-runtime__header">
                <h1>{payload?.page?.label || payload?.metadata?.label || 'Kodi Page'}</h1>
                <p>Type: {payload?.page?.page_type || payload?.metadata?.pageType || 'record'}</p>
            </header>
            <RuntimeRenderer layout={payload?.layout} context={payload?.metadata || {}} role={role} />
        </div>
    );
};

export default KodiAppRuntimePage;
