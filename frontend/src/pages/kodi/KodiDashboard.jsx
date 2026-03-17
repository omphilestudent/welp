import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import Loading from '../../components/common/Loading';

const ROLE_WIDGETS = {
    customer_service: ['applications', 'cases', 'ads', 'components'],
    hr: ['applications', 'components'],
    sales: ['applications', 'cases', 'components'],
    admin: ['applications', 'cases', 'ads', 'components', 'audit'],
    super_admin: ['applications', 'cases', 'ads', 'components', 'audit']
};

const defaultLayout = ['applications', 'cases', 'ads', 'components', 'audit'];

const KodiDashboard = () => {
    const { user } = useAuth();
    const role = String(user?.role || '').toLowerCase();
    const allowedWidgets = ROLE_WIDGETS[role] || [];
    const [layout, setLayout] = useState(defaultLayout);
    const [loading, setLoading] = useState(true);
    const [applications, setApplications] = useState([]);
    const [cases, setCases] = useState([]);
    const [ads, setAds] = useState([]);
    const [components, setComponents] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [dragWidget, setDragWidget] = useState(null);

    const visibleLayout = useMemo(() => layout.filter((widget) => allowedWidgets.includes(widget)), [layout, allowedWidgets]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [appsRes, casesRes, adsRes, compRes, auditRes] = await Promise.all([
                allowedWidgets.includes('applications') ? api.get('/kodi/applications') : Promise.resolve({ data: { data: [] } }),
                allowedWidgets.includes('cases') ? api.get('/kodi/cases') : Promise.resolve({ data: { data: [] } }),
                allowedWidgets.includes('ads') ? api.get('/kodi/ads') : Promise.resolve({ data: { data: [] } }),
                allowedWidgets.includes('components') ? api.get('/kodi/components') : Promise.resolve({ data: { data: [] } }),
                allowedWidgets.includes('audit') ? api.get('/kodi/audit') : Promise.resolve({ data: { data: [] } })
            ]);
            setApplications(appsRes?.data?.data || []);
            setCases(casesRes?.data?.data || []);
            setAds(adsRes?.data?.data || []);
            setComponents(compRes?.data?.data || []);
            setAuditLogs(auditRes?.data?.data || []);
        } catch (error) {
            toast.error('Failed to load Kodi data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [role]);

    const handleDragStart = (widget) => {
        setDragWidget(widget);
    };

    const handleDrop = (widget) => {
        if (!dragWidget || dragWidget === widget) return;
        const next = [...layout];
        const from = next.indexOf(dragWidget);
        const to = next.indexOf(widget);
        if (from === -1 || to === -1) return;
        next.splice(from, 1);
        next.splice(to, 0, dragWidget);
        setLayout(next);
        setDragWidget(null);
    };

    const renderApplications = () => (
        <section className="kodi-card">
            <header>
                <h3>Client Applications</h3>
                <span className="badge">{applications.length}</span>
            </header>
            {applications.length === 0 ? (
                <p>No applications yet.</p>
            ) : (
                applications.slice(0, 6).map((app) => (
                    <div key={app.id} className="kodi-row">
                        <div>
                            <strong>{app.client_name}</strong>
                            <span className={`status-pill status-${app.approval_status}`}>{app.approval_status}</span>
                        </div>
                    </div>
                ))
            )}
        </section>
    );

    const renderCases = () => (
        <section className="kodi-card">
            <header>
                <h3>Cases</h3>
                <span className="badge">{cases.length}</span>
            </header>
            {cases.length === 0 ? (
                <p>No cases yet.</p>
            ) : (
                cases.slice(0, 6).map((item) => (
                    <div key={item.id} className="kodi-row">
                        <div>
                            <strong>{item.client_name || 'Client case'}</strong>
                            <span className={`status-pill status-${item.status}`}>{item.status}</span>
                        </div>
                        <span className={`priority-pill priority-${item.priority}`}>{item.priority}</span>
                    </div>
                ))
            )}
        </section>
    );

    const renderAds = () => (
        <section className="kodi-card">
            <header>
                <h3>Ads Review</h3>
                <span className="badge">{ads.length}</span>
            </header>
            {ads.length === 0 ? (
                <p>No ads awaiting review.</p>
            ) : (
                ads.slice(0, 6).map((item) => (
                    <div key={item.id} className="kodi-row">
                        <div>
                            <strong>Ad #{item.id.slice(0, 6)}</strong>
                            <span className={`status-pill status-${item.status}`}>{item.status}</span>
                        </div>
                    </div>
                ))
            )}
        </section>
    );

    const renderComponents = () => (
        <section className="kodi-card">
            <header>
                <h3>KC Kodi Components</h3>
                <span className="badge">{components.length}</span>
            </header>
            {components.length === 0 ? (
                <p>No components yet.</p>
            ) : (
                components.slice(0, 6).map((item) => (
                    <div key={item.id} className="kodi-row">
                        <div>
                            <strong>{item.component_name}</strong>
                            <span>{item.component_type}</span>
                        </div>
                        <span>v{item.version}</span>
                    </div>
                ))
            )}
        </section>
    );

    const renderAudit = () => (
        <section className="kodi-card">
            <header>
                <h3>Audit Trail</h3>
            </header>
            {auditLogs.length === 0 ? (
                <p>No audit events yet.</p>
            ) : (
                auditLogs.slice(0, 6).map((log) => (
                    <div key={log.id} className="kodi-row">
                        <div>
                            <strong>{log.entity_type}</strong>
                            <span>{log.action}</span>
                        </div>
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                ))
            )}
        </section>
    );

    const widgetMap = {
        applications: renderApplications,
        cases: renderCases,
        ads: renderAds,
        components: renderComponents,
        audit: renderAudit
    };

    if (loading) return <Loading />;

    return (
        <div className="kodi-dashboard">
            <header className="kodi-hero">
                <div>
                    <h1>KP Kodi Portal</h1>
                    <p>Manage applications, cases, ads, and custom components in one place.</p>
                </div>
            </header>

            <div className="kodi-grid">
                {visibleLayout.map((widget) => (
                    <div
                        key={widget}
                        className="kodi-widget"
                        draggable
                        onDragStart={() => handleDragStart(widget)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDrop(widget)}
                    >
                        {widgetMap[widget]?.()}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default KodiDashboard;
