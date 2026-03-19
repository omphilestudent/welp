import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import Loading from '../../components/common/Loading';
import {
    FiLayout,
    FiUsers,
    FiBriefcase,
    FiShield,
    FiBarChart2,
    FiGrid,
    FiList,
    FiSearch,
    FiPlus,
    FiDownload,
    FiRefreshCw,
    FiClock,
    FiCheckCircle,
    FiAlertCircle,
    FiTrendingUp,
    FiActivity,
    FiCpu,
    FiBox,
    FiLayers,
    FiZap,
    FiLock,
    FiUnlock,
    FiCalendar,
    FiMoreVertical,
    FiChevronDown,
    FiChevronUp,
    FiMaximize2,
    FiMinimize2
} from 'react-icons/fi';

import './KodiDashboard.css';

const ROLE_WIDGETS = {
    customer_service: ['applications', 'cases', 'ads', 'components', 'notifications'],
    hr: ['applications', 'components', 'employees', 'interviews', 'documents'],
    sales: ['applications', 'cases', 'components', 'leads', 'opportunities', 'forecast'],
    admin: ['applications', 'cases', 'ads', 'components', 'audit', 'users', 'system', 'analytics'],
    super_admin: ['applications', 'cases', 'ads', 'components', 'audit', 'users', 'system', 'analytics', 'security', 'backups']
};

const WIDGET_CONFIG = {
    applications: {
        icon: FiBriefcase,
        title: 'Applications',
        color: '#4361ee',
        endpoint: '/kodi/applications',
        refreshInterval: 30000
    },
    cases: {
        icon: FiShield,
        title: 'Support Cases',
        color: '#f72585',
        endpoint: '/kodi/cases',
        refreshInterval: 30000
    },
    ads: {
        icon: FiZap,
        title: 'Ad Campaigns',
        color: '#f8961e',
        endpoint: '/kodi/ads',
        refreshInterval: 60000
    },
    components: {
        icon: FiBox,
        title: 'KC Components',
        color: '#4cc9f0',
        endpoint: '/kodi/components',
        refreshInterval: 0
    },
    audit: {
        icon: FiActivity,
        title: 'Audit Trail',
        color: '#7209b7',
        endpoint: '/kodi/audit',
        refreshInterval: 60000
    },
    users: {
        icon: FiUsers,
        title: 'User Management',
        color: '#3a0ca3',
        endpoint: '/admin/users',
        refreshInterval: 30000
    },
    system: {
        icon: FiCpu,
        title: 'System Health',
        color: '#2b9348',
        endpoint: '/health',
        refreshInterval: 10000
    },
    analytics: {
        icon: FiTrendingUp,
        title: 'Analytics',
        color: '#9d4edd',
        endpoint: '/admin/dashboard',
        refreshInterval: 60000
    },
    notifications: {
        icon: FiAlertCircle,
        title: 'Notifications',
        color: '#ffbe0b',
        endpoint: '/notifications?limit=20',
        refreshInterval: 15000
    },
    leads: {
        icon: FiCheckCircle,
        title: 'Leads',
        color: '#ff006e',
        endpoint: '/admin/dashboard',
        refreshInterval: 30000
    },
    opportunities: {
        icon: FiTrendingUp,
        title: 'Opportunities',
        color: '#3a86ff',
        endpoint: '/admin/dashboard',
        refreshInterval: 30000
    },
    forecast: {
        icon: FiBarChart2,
        title: 'Forecast',
        color: '#38b000',
        endpoint: '/admin/dashboard',
        refreshInterval: 60000
    },
    employees: {
        icon: FiUsers,
        title: 'Employees',
        color: '#e36414',
        endpoint: '/hr/employees',
        refreshInterval: 30000
    },
    interviews: {
        icon: FiCalendar,
        title: 'Interviews',
        color: '#9a031e',
        endpoint: '/hr/interviews',
        refreshInterval: 30000
    },
    documents: {
        icon: FiLayers,
        title: 'Documents',
        color: '#5e503f',
        endpoint: '/hr/documents',
        refreshInterval: 60000
    },
    security: {
        icon: FiLock,
        title: 'Security',
        color: '#d00000',
        endpoint: '/admin/settings',
        refreshInterval: 60000
    },
    backups: {
        icon: FiDownload,
        title: 'Backups',
        color: '#0077b6',
        endpoint: '/admin/settings',
        refreshInterval: 60000
    }
};

const KodiDashboard = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const role = String(user?.role || '').toLowerCase();
    const allowedWidgets = ROLE_WIDGETS[role] || [];

    const [layout, setLayout] = useState([]);
    const [widgetData, setWidgetData] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('grid'); // grid, list, compact
    const [sortOrder, setSortOrder] = useState('asc');
    const [expandedWidgets, setExpandedWidgets] = useState({});
    const [fullscreenWidget, setFullscreenWidget] = useState(null);
    const [layoutLocked, setLayoutLocked] = useState(false);
    const [dragOver, setDragOver] = useState(null);
    const [timeframe, setTimeframe] = useState('today');

    useEffect(() => {
        const savedLayout = localStorage.getItem(`kodi_layout_${user?.id}`);
        if (savedLayout) {
            try {
                setLayout(JSON.parse(savedLayout));
                return;
            } catch {
                // fall back
            }
        }
        setLayout(allowedWidgets);
    }, [user, allowedWidgets]);

    useEffect(() => {
        if (user && layout.length > 0 && !layoutLocked) {
            localStorage.setItem(`kodi_layout_${user.id}`, JSON.stringify(layout));
        }
    }, [layout, user, layoutLocked]);

    const visibleLayout = useMemo(() => {
        const filtered = layout.filter((widget) =>
            allowedWidgets.includes(widget)
            && (searchTerm === ''
                || (WIDGET_CONFIG[widget]?.title || '').toLowerCase().includes(searchTerm.toLowerCase()))
        );

        return filtered.sort((a, b) => {
            const aVal = WIDGET_CONFIG[a]?.title || a;
            const bVal = WIDGET_CONFIG[b]?.title || b;
            return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        });
    }, [layout, allowedWidgets, searchTerm, sortOrder]);

    const loadWidgetData = useCallback(async (widget) => {
        const config = WIDGET_CONFIG[widget];
        if (!config?.endpoint) return;

        setRefreshing((prev) => ({ ...prev, [widget]: true }));
        try {
            const { data } = await api.get(config.endpoint);
            setWidgetData((prev) => ({ ...prev, [widget]: data?.data || data || [] }));
        } catch (error) {
            console.error(`Failed to load ${widget} data:`, error);
        } finally {
            setRefreshing((prev) => ({ ...prev, [widget]: false }));
        }
    }, []);

    const loadAllData = useCallback(async () => {
        setLoading(true);
        await Promise.all(visibleLayout.map((widget) => loadWidgetData(widget)));
        setLoading(false);
    }, [visibleLayout, loadWidgetData]);

    useEffect(() => {
        loadAllData();

        const intervals = visibleLayout
            .map((widget) => {
                const interval = WIDGET_CONFIG[widget]?.refreshInterval;
                if (interval && interval > 0) {
                    return setInterval(() => loadWidgetData(widget), interval);
                }
                return null;
            })
            .filter(Boolean);

        return () => intervals.forEach(clearInterval);
    }, [visibleLayout, loadAllData, loadWidgetData]);

    const handleDragStart = (widget) => {
        if (layoutLocked) return;
        setDragOver(widget);
    };

    const handleDragOver = (e, widget) => {
        e.preventDefault();
        if (layoutLocked) return;
        setDragOver(widget);
    };

    const handleDrop = (targetWidget) => {
        if (layoutLocked || !dragOver || dragOver === targetWidget) return;

        const newLayout = [...layout];
        const fromIndex = newLayout.indexOf(dragOver);
        const toIndex = newLayout.indexOf(targetWidget);

        if (fromIndex !== -1 && toIndex !== -1) {
            newLayout.splice(fromIndex, 1);
            newLayout.splice(toIndex, 0, dragOver);
            setLayout(newLayout);
            toast.success('Widget repositioned');
        }

        setDragOver(null);
    };

    const toggleWidgetExpanded = (widget) => {
        setExpandedWidgets((prev) => ({
            ...prev,
            [widget]: !prev[widget]
        }));
    };

    const toggleFullscreen = (widget) => {
        setFullscreenWidget(fullscreenWidget === widget ? null : widget);
    };

    const resetLayout = () => {
        setLayout(allowedWidgets);
        localStorage.removeItem(`kodi_layout_${user?.id}`);
        toast.success('Layout reset to default');
    };

    const exportData = (widget) => {
        const data = widgetData[widget] || [];
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${widget}_export_${new Date().toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`${WIDGET_CONFIG[widget]?.title} data exported`);
    };

    const renderWidget = (widget) => {
        const config = WIDGET_CONFIG[widget];
        if (!config) return null;

        const data = widgetData[widget] || [];
        const isLoading = refreshing[widget];
        const expanded = expandedWidgets[widget];
        const isFullscreen = fullscreenWidget === widget;
        const Icon = config.icon;

        return (
            <div
                className={`widget ${dragOver === widget ? 'drag-over' : ''} ${isFullscreen ? 'fullscreen' : ''}`}
                draggable={!layoutLocked && !isFullscreen}
                onDragStart={() => handleDragStart(widget)}
                onDragOver={(e) => handleDragOver(e, widget)}
                onDrop={() => handleDrop(widget)}
                style={{ '--widget-color': config.color }}
            >
                <div className="widget-header">
                    <div className="widget-title">
                        <div className="widget-icon" style={{ background: `${config.color}20`, color: config.color }}>
                            <Icon />
                        </div>
                        <h3>{config.title}</h3>
                        {isLoading && <FiRefreshCw className="spin" size={14} />}
                    </div>

                    <div className="widget-actions">
                        <button className="widget-action" onClick={() => toggleWidgetExpanded(widget)} title={expanded ? 'Collapse' : 'Expand'}>
                            {expanded ? <FiChevronUp /> : <FiChevronDown />}
                        </button>
                        <button className="widget-action" onClick={() => toggleFullscreen(widget)} title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                            {isFullscreen ? <FiMinimize2 /> : <FiMaximize2 />}
                        </button>
                        <button className="widget-action" onClick={() => exportData(widget)} title="Export Data">
                            <FiDownload />
                        </button>
                        <button className="widget-action" onClick={() => loadWidgetData(widget)} title="Refresh">
                            <FiRefreshCw />
                        </button>
                        <div className="widget-action more">
                            <FiMoreVertical />
                            <div className="widget-menu">
                                <button onClick={() => navigate(`/${widget}`)}>View All</button>
                                <button onClick={() => setLayout((prev) => prev.filter((w) => w !== widget))}>Hide Widget</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="widget-body">
                    <div className="widget-stats">
                        <span className="stat">{Array.isArray(data) ? data.length : 0} total</span>
                        {config.refreshInterval > 0 && (
                            <span className="update-interval">Updates every {config.refreshInterval / 1000}s</span>
                        )}
                    </div>

                    {Array.isArray(data) && data.length === 0 ? (
                        <div className="widget-empty">
                            <Icon size={32} />
                            <p>No data available</p>
                        </div>
                    ) : (
                        <div className="items-list">
                            {(Array.isArray(data) ? data : []).slice(0, expanded ? 10 : 5).map((item, idx) => (
                                <div key={item.id || idx} className="list-item">
                                    <div className="item-details">
                                        <div className="item-title">{item.name || item.title || item.client_name || `Item ${idx + 1}`}</div>
                                        <div className="item-subtitle" style={{ opacity: 0.75 }}>{item.status || item.approval_status || item.component_type || ''}</div>
                                    </div>
                                    {item.created_at ? (
                                        <span className="item-time">
                                            <FiClock size={12} />
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </span>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="widget-footer">
                    <Link to={`/${widget}`} className="view-all-link">
                        View All <FiChevronDown />
                    </Link>
                </div>
            </div>
        );
    };

    if (loading) return <Loading />;

    return (
        <div className="kodi-dashboard">
            <div className="dashboard-header">
                <div className="header-left">
                    <button className="kodi-back-button" onClick={() => navigate('/kodi/times')}>
                        â† Back
                    </button>
                    <h1>
                        <FiLayout className="header-icon" />
                        Kodi Portal
                    </h1>
                    <p>Welcome back, {user?.display_name || user?.email}. Here&apos;s your overview.</p>
                </div>

                <div className="header-right">
                    <div className="timeframe-selector">
                        <button className={`timeframe-btn ${timeframe === 'today' ? 'active' : ''}`} onClick={() => setTimeframe('today')}>
                            Today
                        </button>
                        <button className={`timeframe-btn ${timeframe === 'week' ? 'active' : ''}`} onClick={() => setTimeframe('week')}>
                            This Week
                        </button>
                        <button className={`timeframe-btn ${timeframe === 'month' ? 'active' : ''}`} onClick={() => setTimeframe('month')}>
                            This Month
                        </button>
                    </div>

                    <button className="btn-icon" onClick={loadAllData} title="Refresh All">
                        <FiRefreshCw />
                    </button>

                    <button className="btn-icon" onClick={() => setLayoutLocked(!layoutLocked)} title={layoutLocked ? 'Unlock Layout' : 'Lock Layout'}>
                        {layoutLocked ? <FiLock /> : <FiUnlock />}
                    </button>

                    <button className="btn-icon" onClick={resetLayout} title="Reset Layout">
                        <FiLayout />
                    </button>
                </div>
            </div>

            <div className="stats-overview">
                <div className="stat-card">
                    <FiActivity className="stat-icon" />
                    <div className="stat-info">
                        <span className="stat-label">Active Widgets</span>
                        <span className="stat-value">{visibleLayout.length}</span>
                    </div>
                </div>
                <div className="stat-card">
                    <FiClock className="stat-icon" />
                    <div className="stat-info">
                        <span className="stat-label">Last Updated</span>
                        <span className="stat-value">{new Date().toLocaleTimeString()}</span>
                    </div>
                </div>
                <div className="stat-card">
                    <FiUsers className="stat-icon" />
                    <div className="stat-info">
                        <span className="stat-label">Role</span>
                        <span className="stat-value role-badge">{role}</span>
                    </div>
                </div>
            </div>

            <div className="controls-bar">
                <div className="search-box">
                    <FiSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search widgets..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="view-controls">
                    <button className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>
                        <FiGrid /> Grid
                    </button>
                    <button className={`view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
                        <FiList /> List
                    </button>
                    <button className={`view-btn ${viewMode === 'compact' ? 'active' : ''}`} onClick={() => setViewMode('compact')}>
                        <FiLayers /> Compact
                    </button>
                </div>

                <div className="sort-controls">
                    <select value="title" onChange={() => {}}>
                        <option value="title">Sort by Title</option>
                    </select>
                    <button onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}>
                        {sortOrder === 'asc' ? '↑' : '↓'}
                    </button>
                </div>
            </div>

            <div className={`widget-grid view-${viewMode}`}>
                {visibleLayout.map((widget) => renderWidget(widget))}
            </div>

            {fullscreenWidget && (
                <div className="fullscreen-overlay" onClick={() => setFullscreenWidget(null)}>
                    <div className="fullscreen-widget" onClick={(e) => e.stopPropagation()}>
                        {renderWidget(fullscreenWidget)}
                        <button className="close-fullscreen" onClick={() => setFullscreenWidget(null)}>
                            <FiMinimize2 />
                        </button>
                    </div>
                </div>
            )}

            <div className="add-widget-float">
                <button className="btn-primary" onClick={() => navigate('/kodi/builder')}>
                    <FiPlus /> Builder
                </button>
            </div>
        </div>
    );
};

export default KodiDashboard;
