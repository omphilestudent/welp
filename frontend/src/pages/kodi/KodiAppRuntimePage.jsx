import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Loading from '../../components/common/Loading';
import RuntimeRenderer from '../../components/kodi/RuntimeRenderer';
import PanelHighlight from '../../components/kodi/components/PanelHighlight';
import { fetchRuntimePage } from '../../services/kodiPageService';
import api from '../../services/api';
import './KodiRuntime.css';

const KodiAppRuntimePage = () => {
    const { appId, pageId } = useParams();
    const navigate = useNavigate();
    const [payload, setPayload] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [record, setRecord] = useState({});

    useEffect(() => {
        if (!pageId) return;
        const load = async () => {
            setLoading(true);
            try {
                const data = await fetchRuntimePage(pageId, { appId });
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
    }, [pageId, appId]);

    const role = payload?.effectiveRole;
    const hasAccess = useMemo(() => {
        const map = payload?.permissions || {};
        if (!Object.keys(map).length) return true;
        return Boolean(map?.[role]?.can_view);
    }, [payload, role]);
    const canEdit = useMemo(() => {
        const map = payload?.permissions || {};
        if (!Object.keys(map).length) return true;
        return Boolean(map?.[role]?.can_edit);
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

    const handleAction = async (action = {}) => {
        const destination = action.navigateTo || action.route || action.href || action.url;
        if (destination) {
            if (destination.startsWith('http')) {
                window.location.href = destination;
            } else {
                navigate(destination);
            }
            return;
        }
        if (action.apiEndpoint) {
            try {
                const method = String(action.method || 'post').toLowerCase();
                await api.request({ url: action.apiEndpoint, method, data: action.payload || {} });
                toast.success(action.successMessage || 'Action completed');
            } catch (err) {
                toast.error(err?.response?.data?.error || 'Action failed');
            }
            return;
        }
        toast.error('Action not configured');
    };

    const normalizeActions = (raw) => {
        if (!raw) return [];
        if (Array.isArray(raw)) {
            return raw.map((action) => {
                if (typeof action === 'string') return { label: action };
                if (typeof action === 'object' && action) return { label: action.label || action.title || action.name || 'Action', ...action };
                return null;
            }).filter(Boolean);
        }
        return [];
    };

    const setValueByPath = (obj, path, value) => {
        const parts = path.split('.');
        const next = { ...(obj || {}) };
        let cursor = next;
        parts.forEach((part, index) => {
            if (index === parts.length - 1) {
                cursor[part] = value;
            } else {
                cursor[part] = { ...(cursor[part] || {}) };
                cursor = cursor[part];
            }
        });
        return next;
    };

    const handleRecordUpdate = async (path, value) => {
        if (!path) return;
        const previous = record;
        const nextRecord = setValueByPath(record || {}, path, value);
        setRecord(nextRecord);
        try {
            await api.request({
                url: `/kodi/platform/runtime/${pageId}/record`,
                method: 'put',
                data: { record: nextRecord }
            });
            toast.success('Record updated');
        } catch (err) {
            toast.error(err?.response?.data?.error || 'Failed to update record');
            setRecord(previous);
        }
    };

    const extractHighlight = (layout) => {
        if (!layout?.rows) return { layout, highlight: null };
        let highlight = null;
        const nextRows = layout.rows.map((row) => ({
            ...row,
            columns: (row.columns || []).map((column) => {
                const components = (column.components || []).filter((component) => {
                    if (component.component_type === 'HighlightsPanel') {
                        if (!highlight) highlight = component;
                        return false;
                    }
                    return true;
                });
                return { ...column, components };
            })
        }));
        return { layout: { ...layout, rows: nextRows }, highlight };
    };

    const { layout: sanitizedLayout, highlight } = extractHighlight(payload?.layout);
    const recordTitle = record?.name || record?.title || record?.full_name || record?.company || payload?.page?.label;
    const recordType = payload?.metadata?.object?.label || payload?.metadata?.object?.name || payload?.page?.page_type || 'Record';
    const fallbackHighlight = {
        props: {
            title: recordTitle || 'Highlights',
            subtitle: `${recordType} Summary`,
            fields: Object.keys(record || {}).filter((key) => key !== 'id').slice(0, 4).map((key) => ({
                key,
                label: key.replace(/_/g, ' ')
            })),
            actions: ['Create Case', 'Assign Case', 'Handover'],
            iconActions: [{ label: 'Star' }, { label: 'Follow' }]
        },
        actions: ['Create Case', 'Assign Case', 'Handover']
    };
    const effectiveHighlight = highlight || fallbackHighlight;

    return (
        <div className="kodi-runtime">
            <header className="kodi-runtime__record-header">
                <div>
                    <span className="kodi-runtime__record-type">{recordType}</span>
                    <h1>{recordTitle || 'Record'}</h1>
                    <div className="kodi-runtime__record-meta">
                        <span>Owner: {record?.owner || record?.assigned_to || 'Unassigned'}</span>
                        <span>Status: {record?.status || record?.stage || 'Active'}</span>
                    </div>
                </div>
                <div className="kodi-runtime__record-actions">
                    {normalizeActions(effectiveHighlight?.actions || effectiveHighlight?.props?.actions || []).map((action) => (
                        <button key={action.label} type="button" onClick={() => handleAction(action)}>
                            {action.label}
                        </button>
                    ))}
                </div>
            </header>
            {effectiveHighlight && (
                <PanelHighlight
                    props={{
                        title: effectiveHighlight.props?.title || effectiveHighlight.label || 'Highlights',
                        subtitle: effectiveHighlight.props?.subtitle || effectiveHighlight.props?.description,
                        fields: effectiveHighlight.props?.fields || effectiveHighlight.props?.stats || [],
                        actions: effectiveHighlight.actions || effectiveHighlight.props?.actions || [],
                        iconActions: effectiveHighlight.props?.iconActions || []
                    }}
                    record={record}
                    canEdit={canEdit}
                    onAction={(action) => handleAction(action)}
                />
            )}
            <RuntimeRenderer
                layout={sanitizedLayout}
                context={{
                    ...(payload?.metadata || {}),
                    record,
                    canEdit,
                    onRecordUpdate: handleRecordUpdate
                }}
                role={role}
                onAction={handleAction}
            />
        </div>
    );
};

export default KodiAppRuntimePage;
