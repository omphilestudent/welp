import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Loading from '../../components/common/Loading';
import RuntimeRenderer from '../../components/kodi/RuntimeRenderer';
import PanelHighlight from '../../components/kodi/components/PanelHighlight';
import { fetchRuntimePage } from '../../services/kodiPageService';
import { useAuth } from '../../hooks/useAuth';
import './KodiRuntime.css';

const KodiRuntimePage = () => {
    const { pageId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [payload, setPayload] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [record, setRecord] = useState({});

    useEffect(() => {
        if (!pageId) {
            setError('Missing page id.');
            setLoading(false);
            return;
        }
        const load = async () => {
            setLoading(true);
            try {
                const data = await fetchRuntimePage(pageId);
                setPayload(data);
                setRecord(data?.record || {});
            } catch (err) {
                setError(err?.response?.data?.error || 'Failed to load runtime page');
                toast.error(err?.response?.data?.error || 'Failed to load runtime page');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [pageId]);

    const role = payload?.effectiveRole || user?.role;
    const hasAccess = useMemo(() => {
        if (!role) return true;
        const map = payload?.permissions || {};
        if (!Object.keys(map).length) return role === 'admin';
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
                    <button className="btn-primary" onClick={() => navigate('/kodi/times')}>
                        Go back to builder
                    </button>
                </div>
            </div>
        );
    }

    if (!hasAccess) {
        return (
            <div className="kodi-runtime">
                <div className="kodi-runtime__error">
                    <p>Access denied. Contact your admin for permissions.</p>
                </div>
            </div>
        );
    }

    const hasComponents =
        (payload?.layout?.rows || []).some((row) =>
            (row.columns || []).some((col) => (col.components || []).length > 0)
        );

    const recordTitle = record?.name || record?.title || payload?.page?.label;
    const recordType = payload?.metadata?.object?.label || payload?.page?.page_type || 'Record';

    return (
        <div className="kodi-runtime">
            <div className="kodi-runtime-shell">
                <PanelHighlight
                    props={{
                        title: recordTitle,
                        subtitle: recordType,
                        fields: Object.keys(record || {}).filter((key) => key !== 'id').slice(0, 4).map((key) => ({
                            key,
                            label: key.replace(/_/g, ' ')
                        })),
                        actions: ['Submit for Approval', 'New Event', 'Change Owner']
                    }}
                    record={record}
                />
                {hasComponents ? (
                    <RuntimeRenderer
                        layout={payload?.layout}
                        context={{
                            ...(payload?.metadata || {}),
                            record,
                            activity: payload?.activity || [],
                            related: payload?.related || {}
                        }}
                        role={role}
                    />
                ) : (
                    <div className="kodi-runtime__empty">No components configured for this page yet.</div>
                )}
            </div>
        </div>
    );
};

export default KodiRuntimePage;
