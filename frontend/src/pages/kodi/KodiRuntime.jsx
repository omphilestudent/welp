import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Loading from '../../components/common/Loading';
import { fetchRuntimePage } from '../../services/kodiPageService';
import { useAuth } from '../../hooks/useAuth';
import './KodiRuntime.css';

const getValueByPath = (obj, path) => {
    if (!obj || !path) return null;
    return path.split('.').reduce((acc, part) => {
        if (acc == null) return null;
        return acc[part];
    }, obj);
};

const evaluateRule = (rule, context) => {
    if (!rule || !rule.field) return true;
    const value = getValueByPath(context, rule.field);
    const target = rule.value;
    switch (rule.operator) {
        case 'not_equals':
            return value !== target;
        case 'in':
            return Array.isArray(target) ? target.includes(value) : false;
        case 'contains':
            return typeof value === 'string' && String(target) ? value.includes(String(target)) : false;
        default:
            return value === target;
    }
};

const buildSpacingValue = (spacing) => {
    if (!spacing) return undefined;
    const axes = ['top', 'right', 'bottom', 'left'];
    const values = axes.map((axis) => {
        const value = spacing?.[axis];
        if (value === undefined || value === null || value === '') return '0px';
        return typeof value === 'number' ? `${value}px` : value;
    });
    const hasCustom = values.some((val) => val !== '0px');
    return hasCustom ? values.join(' ') : undefined;
};

const getComponentCardStyle = (component) => {
    const style = {
        background: component.settings?.backgroundColor || '#fafbff',
        color: component.settings?.textColor || '#1f2b3b'
    };
    const margin = buildSpacingValue(component.settings?.margin);
    const padding = buildSpacingValue(component.settings?.padding);
    if (margin) style.margin = margin;
    if (padding) style.padding = padding;
    return style;
};

const renderRuntimeComponent = (component, context) => {
    if (component.component_type === 'PanelHighlight') {
        const actions = component.props?.actions || component.preview?.actions || ['Add Call', 'New Task'];
        const stats = component.props?.stats || component.preview?.stats || ['Leads: 0', 'Calls: 0'];
        return (
            <div className="runtime-panel-highlight">
                <div className="runtime-panel-actions">
                    {actions.map((action) => (
                        <button key={action} type="button">
                            {action}
                        </button>
                    ))}
                </div>
                <div className="runtime-panel-stats">
                    {stats.map((stat) => (
                        <span key={stat}>{stat}</span>
                    ))}
                </div>
            </div>
        );
    }

    if (component.component_type === 'RecordPage') {
        const record = context.record || {};
        const client = component.props?.client || component.preview?.client || record || { name: 'Client Name', account: 'AC-000', phone: '—' };
        const timeline = component.props?.timeline || component.preview?.timeline || ['No recent activity'];
        const filters = component.props?.quickFilters || component.preview?.quickFilters || ['Open', 'Active'];
        return (
            <div className="runtime-record-page">
                <div className="runtime-record-search">
                    <input type="text" placeholder="Search client records..." readOnly />
                    <button type="button">Search</button>
                </div>
                <div className="runtime-record-details">
                    <div className="runtime-record-name">
                        <strong>{client.name}</strong>
                        <span>{client.account}</span>
                    </div>
                    <p>Phone: {client.phone}</p>
                </div>
                <div className="runtime-record-filters">
                    {filters.map((filter) => (
                        <span key={filter}>{filter}</span>
                    ))}
                </div>
                <div className="runtime-record-timeline">
                    {timeline.map((item) => (
                        <div key={item} className="runtime-record-timeline-item">
                            {item}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="kodi-runtime__card-header">
                <strong>{component.component_name || component.component_type}</strong>
                <span className="kodi-runtime__card-type">{component.component_type}</span>
            </div>
            <div className="kodi-runtime__card-body">
                <pre>{JSON.stringify(component.props || {}, null, 2)}</pre>
            </div>
        </>
    );
};

const KodiRuntime = () => {
    const { pageId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [payload, setPayload] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const data = await fetchRuntimePage(pageId);
                setPayload(data);
            } catch (err) {
                setError(err?.response?.data?.error || 'Failed to load page');
                toast.error(err?.response?.data?.error || 'Failed to load runtime page');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [pageId]);

    const role = user?.role;
    const hasAccess = useMemo(() => {
        if (!payload?.permissions || !role) return true;
        return payload.permissions[role]?.can_view || false;
    }, [payload, role]);

    const recordContext = useMemo(() => {
        if (!payload) return {};
        return {
            metadata: payload.metadata || {},
            record: payload.metadata?.record || payload.metadata || {}
        };
    }, [payload]);

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
                    <p>You do not have permission to view this page.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="kodi-runtime">
            <header className="kodi-runtime__header">
                <div className="kodi-page-header">
                    <button className="kodi-back-button" onClick={() => navigate('/kodi/times')}>
                        ← Back
                    </button>
                    <div>
                        <h1>{payload?.metadata?.label || 'Kodi Page'}</h1>
                        <p>Type: {payload?.metadata?.pageType || 'record'}</p>
                    </div>
                </div>
            </header>
            <div className="kodi-runtime__layout">
                {(payload?.layout?.rows || []).map((row, rowIndex) => (
                    <div key={`row-${rowIndex}`} className="kodi-runtime__row">
                        {(row.columns || []).map((column, colIndex) => (
                            <div
                                key={`col-${rowIndex}-${colIndex}`}
                                className="kodi-runtime__column"
                                style={{ flex: column.width || 1, minWidth: 0 }}
                            >
                                {column.components.map((component) => {
                                    const rule = component.visibilityRule;
                                    const show =
                                        !rule || evaluateRule(rule, recordContext.record || recordContext.metadata);
                                    if (!show) return null;
                                    const cardStyle = getComponentCardStyle(component);
                                    return (
                                        <div
                                            key={component.instanceId || component.id}
                                            className="kodi-runtime__card"
                                            style={cardStyle}
                                        >
                                            {renderRuntimeComponent(component, recordContext)}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default KodiRuntime;
