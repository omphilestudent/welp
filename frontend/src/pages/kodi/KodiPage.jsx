import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Loading from '../../components/common/Loading';
import DynamicRenderer from '../../components/kodi/DynamicRenderer';
import { fetchKodiPageBundle, getKodiPageToken, setKodiPageToken } from '../../services/kodiPageService';

const KodiPage = () => {
    const { slug } = useParams();
    const pageSlug = useMemo(() => String(slug || '').trim(), [slug]);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [bundle, setBundle] = useState(null);

    const load = async () => {
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
    };

    useEffect(() => {
        load();
    }, [pageSlug]);

    if (loading) return <Loading />;
    if (!bundle?.page) return <div style={{ padding: 16 }}>Page not available.</div>;

    return (
        <div style={{ padding: 16, maxWidth: 1200, margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                    <h1 style={{ margin: 0 }}>{bundle.page.name}</h1>
                    {bundle.page.description ? (
                        <p style={{ opacity: 0.8, marginTop: 6 }}>{bundle.page.description}</p>
                    ) : null}
                </div>
                <button onClick={() => { setKodiPageToken(null); navigate(`/kodi/page/${pageSlug}/login`, { replace: true }); }}>
                    Sign out
                </button>
            </header>

            <div style={{ marginTop: 16 }}>
                <DynamicRenderer layout={bundle.page.layout || {}} components={bundle.components || []} />
            </div>
        </div>
    );
};

export default KodiPage;

