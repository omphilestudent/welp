import React, { useEffect, useMemo, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import Loading from '../../components/common/Loading';
import {
    createPlatformPage,
    listKCComponents,
    listPlatformPages,
    updatePlatformLayout
} from '../../services/kodiPageService';
import './KodiBuilder.css';
import { useParams } from 'react-router-dom';

const createDefaultLayout = () => ({
    type: '1-column',
    orientation: 'horizontal',
    rows: [
        {
            id: `row-${Date.now()}`,
            columns: [
                {
                    id: `col-${Date.now()}-1`,
                    width: 12,
                    components: []
                }
            ]
        }
    ]
});

const slugifyString = (value) => {
    const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return slug || 'kodi-page';
};

const ensureUniqueSlug = (baseSlug, existingSlugs = []) => {
    const normalizedBase = baseSlug || 'kodi-page';
    const taken = new Set(existingSlugs);
    let candidate = normalizedBase;
    let counter = 1;

    while (taken.has(candidate)) {
        candidate = `${normalizedBase}-${counter}`;
        counter += 1;
    }

    return candidate;
};

const COMPONENT_CATEGORIES = {
    layout: ['Container', 'Grid', 'Tabs', 'Accordion'],
    data: ['Table', 'Chart', 'List', 'Card', 'Kanban'],
    input: ['Form', 'Input', 'Select', 'Checkbox', 'Radio', 'Button'],
    display: ['Text', 'Image', 'Icon', 'Badge', 'Alert', 'Modal'],
    navigation: ['Menu', 'Breadcrumb', 'Pagination', 'Steps'],
    kodi: ['PanelHighlight', 'RecordPage']
};

const DEFAULT_COMPONENT_LAYOUT = {
    width: 6,
    height: 2,
    minWidth: 2,
    maxWidth: 12
};

const GRID_COLUMNS = 12;

const BUILT_IN_OBJECTS = [
    { name: 'contacts', label: 'Contacts' },
    { name: 'employees', label: 'Employees' },
    { name: 'businesses', label: 'Businesses' },
    { name: 'psychologists', label: 'Psychologists' },
    { name: 'subscriptions', label: 'Subscriptions' }
];

const BUILT_IN_OBJECT_FIELDS = {
    contacts: ['firstName', 'lastName', 'email', 'company', 'status'],
    employees: ['displayName', 'email', 'role', 'status'],
    businesses: ['businessName', 'industry', 'city', 'tier'],
    psychologists: ['name', 'specialty', 'availability', 'rating'],
    subscriptions: ['plan', 'status', 'renewalDate', 'owner']
};

const parseCommaSeparated = (value) =>
    (value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

const formatCommaSeparated = (value) => {
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'string') return value;
    return '';
};

const cloneLayoutState = (sourceLayout) => {
    const baseLayout =
        sourceLayout && Array.isArray(sourceLayout.rows) && sourceLayout.rows.length > 0
            ? sourceLayout
            : createDefaultLayout();

    return {
        ...baseLayout,
        rows: baseLayout.rows.map((row) => ({
            ...row,
            columns: (row.columns || []).map((col) => ({
                ...col,
                components: (col.components || []).map((comp) => ({
                    ...comp,
                    props: { ...(comp.props || {}) },
                    layout: { ...(comp.layout || DEFAULT_COMPONENT_LAYOUT) },
                    visibilityRule: { ...(comp.visibilityRule || {}) },
                    settings: { ...(comp.settings || {}) }
                }))
            }))
        }))
    };
};

const BUILT_IN_COMPONENTS = [
    {
        id: 'panel-highlights',
        component_name: 'PanelHighlight',
        displayName: 'Panel Highlights',
        component_type: 'PanelHighlight',
        description: 'Showcase quick actions with buttons and summary pills.',
        version: '1.0',
        preview: {
            actions: ['Add Call', 'New Task', 'Send Update'],
            stats: ['Leads: 8', 'Calls: 12', 'Open Tasks: 3']
        }
    },
    {
        id: 'record-page',
        component_name: 'RecordPage',
        displayName: 'Record Page',
        component_type: 'RecordPage',
        description: 'Display client details, timeline, and quick search.',
        version: '1.0',
        preview: {
            client: {
                name: 'Jordan Smith',
                account: 'AC-124',
                phone: '+1 (555) 010-1010'
            },
            timeline: ['Last contact: Email - 8 mins ago', 'Next follow-up: Demo on Friday', 'Notes: Referral from Anna'],
            quickFilters: ['Open', 'Prospect', 'VIP']
        }
    }
];

const COMPONENT_ACTIONS = [
    { id: 'edit', label: 'Edit properties', description: 'Open the property panel' },
    { id: 'delete', label: 'Delete component', description: 'Remove from canvas' },
    { id: 'clone', label: 'Clone component', description: 'Duplicate next to source' },
    { id: 'sendEmail', label: 'Send email action', description: 'Trigger a follow-up email' },
    { id: 'assignPsychologist', label: 'Assign psychologist', description: 'Trigger assignment workflow' }
];

const KodiBuilder = () => {
    const { pageId: routePageId } = useParams();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pages, setPages] = useState([]);
    const [components, setComponents] = useState([]);
    const [selectedPageId, setSelectedPageId] = useState(routePageId || '');
    const [layout, setLayout] = useState(null);
    const [selectedComponent, setSelectedComponent] = useState(null);
    const [showProperties, setShowProperties] = useState(false);
    const [selectedComponentPosition, setSelectedComponentPosition] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [zoom, setZoom] = useState(100);
    const [showGrid, setShowGrid] = useState(true);
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [isDragging, setIsDragging] = useState(false);
    const [dropTarget, setDropTarget] = useState(null);
    const [showAddPageGuide, setShowAddPageGuide] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newPageName, setNewPageName] = useState('');
    const [creatingPage, setCreatingPage] = useState(false);
    const [settingsJson, setSettingsJson] = useState('{}');

    const selectedPage = useMemo(() => pages.find((p) => p.id === selectedPageId) || null, [pages, selectedPageId]);
    const mergedComponents = useMemo(() => [...BUILT_IN_COMPONENTS, ...components], [components]);

    const getComponentLabel = (comp) => comp?.displayName || comp?.display_name || comp?.component_name || 'Component';
    const openLivePage = () => {
        if (!selectedPage?.slug) return;
        window.open(`/kodi/page/${selectedPage.slug}`, '_blank', 'noopener,noreferrer');
    };
    const selectedComponentLabel = selectedComponent ? getComponentLabel(selectedComponent) : '';

    // Load data
    const load = async () => {
        setLoading(true);
        try {
            const [pagesData, compsData] = await Promise.all([listPlatformPages(), listKCComponents()]);

            setPages(pagesData);
            setComponents(compsData);

            if (pagesData.length > 0) {
                const matchesRoute = routePageId && pagesData.some((p) => p.id === routePageId);
                const selectedId = matchesRoute ? routePageId : pagesData[0].id;
                const selected = pagesData.find((p) => p.id === selectedId) || pagesData[0];
                setSelectedPageId(selectedId);
                const layoutPayload = selected.layout || createDefaultLayout();
                const normalizedLayout = cloneLayoutState(layoutPayload);
                setLayout(normalizedLayout);
                setHistory([]);
                setHistoryIndex(-1);
                setSelectedComponent(null);
                setSelectedComponentPosition(null);
                setShowProperties(false);
                setDropTarget(null);
            }
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to load Kodi builder data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [routePageId]);

    useEffect(() => {
        if (!selectedComponent) {
            setSettingsJson('{}');
            return;
        }
        try {
            setSettingsJson(JSON.stringify(selectedComponent.settings || {}, null, 2));
        } catch {
            setSettingsJson('{}');
        }
    }, [selectedComponent]);

    // Save to history
    const saveToHistory = useCallback((newLayout) => {
        const snapshot = cloneLayoutState(newLayout);
        setHistory((prev) => {
            const newHistory = prev.slice(0, historyIndex + 1);
            return [...newHistory, snapshot];
        });
        setHistoryIndex((prev) => prev + 1);
    }, [historyIndex]);

    // Handle layout changes
    const updateLayout = useCallback((newLayout) => {
        setLayout(newLayout);
        saveToHistory(newLayout);
    }, [saveToHistory]);

    // Undo/Redo
    const undo = useCallback(() => {
        if (historyIndex > 0) {
            setHistoryIndex(prev => prev - 1);
            setLayout(history[historyIndex - 1]);
        }
    }, [history, historyIndex]);

    const redo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(prev => prev + 1);
            setLayout(history[historyIndex + 1]);
        }
    }, [history, historyIndex]);

    // Add row
    const addRow = () => {
        const newLayout = cloneLayoutState(layout);
        newLayout.rows.push({
            id: `row-${Date.now()}`,
            columns: [
                {
                    id: `col-${Date.now()}-1`,
                    width: GRID_COLUMNS,
                    components: []
                }
            ]
        });
        updateLayout(newLayout);
        toast.success('Row added');
    };

    // Add column to row
    const addColumn = (rowIndex) => {
        if (!layout?.rows) return;

        const newLayout = cloneLayoutState(layout);
        const row = newLayout.rows[rowIndex];
        if (!row) return;

        if (row.columns.length >= 4) {
            toast.error('Maximum 4 columns per row');
            return;
        }

        const newColumnsCount = row.columns.length + 1;
        const sharedWidth = Math.max(1, Math.floor(GRID_COLUMNS / newColumnsCount));

        row.columns = row.columns.map((col) => ({
            ...col,
            width: sharedWidth
        }));

        row.columns.push({
            id: `col-${Date.now()}-${newColumnsCount}`,
            width: sharedWidth,
            components: []
        });

        updateLayout(newLayout);
        toast.success('Column added');
    };

    // Delete row
    const deleteRow = (rowIndex) => {
        if (!layout?.rows) return;
        if (layout.rows.length === 1) {
            toast.error('At least one row must remain');
            return;
        }

        const newLayout = cloneLayoutState(layout);
        newLayout.rows.splice(rowIndex, 1);
        updateLayout(newLayout);
        toast.success('Row deleted');
    };

    // Delete column
    const deleteColumn = (rowIndex, colIndex) => {
        if (!layout?.rows) return;
        const row = layout.rows[rowIndex];
        if (!row || row.columns.length === 1) {
            toast.error('Each row must keep at least one column');
            return;
        }

        const newLayout = cloneLayoutState(layout);
        const targetRow = newLayout.rows[rowIndex];
        targetRow.columns.splice(colIndex, 1);

        const redistributedWidth = Math.max(1, Math.floor(GRID_COLUMNS / targetRow.columns.length));
        targetRow.columns = targetRow.columns.map((col) => ({
            ...col,
            width: redistributedWidth
        }));

        updateLayout(newLayout);
        toast.success('Column deleted');
    };

    // Add component to column
    const addComponentToColumn = (rowIndex, colIndex, component) => {
        if (!layout?.rows) return;
        const newLayout = cloneLayoutState(layout);
        const column = newLayout.rows[rowIndex]?.columns[colIndex];
        if (!column) return;

        const newComponent = {
            ...component,
            instanceId: `${component.component_name || component.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            props: { ...(component.props || {}) },
            settings: { ...(component.settings || {}) },
            layout: { ...(component.layout || DEFAULT_COMPONENT_LAYOUT) },
            visibilityRule: { ...(component.visibilityRule || {}) }
        };

        column.components.push(newComponent);
        updateLayout(newLayout);
        toast.success(`${component.displayName || component.component_name || 'Component'} added`);
    };

    // Remove component
    const removeComponent = (rowIndex, colIndex, compIndex) => {
        if (!layout?.rows) return;
        const newLayout = cloneLayoutState(layout);
        const column = newLayout.rows[rowIndex]?.columns[colIndex];
        if (!column) return;

        column.components.splice(compIndex, 1);
        updateLayout(newLayout);
        setSelectedComponent(null);
        setSelectedComponentPosition(null);
        toast.success('Component removed');
    };

    const cloneComponent = () => {
        if (!selectedComponentPosition || !layout?.rows) return;
        const { rowIndex, colIndex, compIndex } = selectedComponentPosition;
        const newLayout = cloneLayoutState(layout);
        const column = newLayout.rows[rowIndex]?.columns[colIndex];
        if (!column) return;
        const source = column.components[compIndex];
        if (!source) return;

        const duplicate = {
            ...source,
            instanceId: `${source.instanceId || source.component_name}-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 6)}`
        };
        column.components.splice(compIndex + 1, 0, duplicate);
        updateLayout(newLayout);
        toast.success('Component cloned');
    };

    const recordComponentAction = (actionId) => {
        if (!selectedComponentPosition || !layout?.rows) return;
        const { rowIndex, colIndex, compIndex } = selectedComponentPosition;
        const newLayout = cloneLayoutState(layout);
        const column = newLayout.rows[rowIndex]?.columns[colIndex];
        if (!column) return;
        const component = column.components[compIndex];
        if (!component) return;
        component.props = component.props || {};
        const existing = new Set(component.props.actions || []);
        existing.add(actionId);
        component.props.actions = Array.from(existing);
        updateLayout(newLayout);
    };

    const executeCustomAction = (actionId) => {
        const actionLabels = {
            sendEmail: 'Send email',
            assignPsychologist: 'Assign psychologist'
        };
        recordComponentAction(actionId);
        toast.success(`${actionLabels[actionId] || 'Custom action'} executed`);
    };

    const handleComponentAction = (actionId) => {
        if (!selectedComponentPosition) {
            toast.error('Select a component to run actions');
            return;
        }
        switch (actionId) {
            case 'edit':
                setShowProperties(true);
                break;
            case 'delete':
                removeComponent(
                    selectedComponentPosition.rowIndex,
                    selectedComponentPosition.colIndex,
                    selectedComponentPosition.compIndex
                );
                break;
            case 'clone':
                cloneComponent();
                break;
            default:
                executeCustomAction(actionId);
        }
    };

    const handleComponentDragStart = (event, rowIndex, colIndex, compIndex) => {
        event.dataTransfer.setData(
            'kodi-layout-component',
            JSON.stringify({ rowIndex, colIndex, compIndex })
        );
        event.dataTransfer.effectAllowed = 'move';
        setIsDragging(true);
    };

    const moveLayoutComponent = (source, targetRowIndex, targetColIndex) => {
        if (!layout?.rows) return;
        const newLayout = cloneLayoutState(layout);
        const sourceRow = newLayout.rows[source.rowIndex];
        const sourceColumn = sourceRow?.columns[source.colIndex];
        if (!sourceColumn) return;

        const [componentToMove] = sourceColumn.components.splice(source.compIndex, 1);
        if (!componentToMove) return;

        const targetColumn = newLayout.rows[targetRowIndex]?.columns[targetColIndex];
        if (!targetColumn) return;

        targetColumn.components.push(componentToMove);
        updateLayout(newLayout);
        setSelectedComponent(componentToMove);
        setSelectedComponentPosition({
            rowIndex: targetRowIndex,
            colIndex: targetColIndex,
            compIndex: targetColumn.components.length - 1
        });
    };

    const handleColumnDrop = (rowIndex, colIndex, event) => {
        event.preventDefault();
        const layoutPayload = event.dataTransfer.getData('kodi-layout-component');
        if (layoutPayload) {
            const parsed = JSON.parse(layoutPayload);
            moveLayoutComponent(parsed, rowIndex, colIndex);
        } else {
            const compPayload = event.dataTransfer.getData('kodi-component');
            if (compPayload) {
                const component = JSON.parse(compPayload);
                addComponentToColumn(rowIndex, colIndex, component);
            }
        }
        setDropTarget(null);
        setIsDragging(false);
    };

    const handleColumnDragEnter = (rowIndex, colIndex, event) => {
        event.preventDefault();
        setDropTarget(`${rowIndex}-${colIndex}`);
    };

    const handleColumnDragLeave = () => {
        setDropTarget(null);
    };

    // Save page
    const handleSave = async () => {
        if (!selectedPage) return;

        setSaving(true);
        try {
            await updatePlatformLayout(selectedPage.id, layout);
            toast.success('Page saved successfully');
            setPages((prev) =>
                prev.map((page) =>
                    page.id === selectedPage.id ? { ...page, layout, status: 'built' } : page
                )
            );
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to save page');
        } finally {
            setSaving(false);
        }
    };

    const openAddPageModal = () => {
        setNewPageName('');
        setIsAddModalOpen(true);
    };

    const submitNewPage = async (event) => {
        event?.preventDefault();
        const name = newPageName.trim();
        if (!name) {
            toast.error('Please give the page a name');
            return;
        }

        const layoutPayload = createDefaultLayout();
        setCreatingPage(true);
        try {
            const createdPage = await createPlatformPage({
                label: name,
                pageType: 'record'
            });
            setPages((prev) => [createdPage, ...prev]);
            setSelectedPageId(createdPage.id);
            updateLayout(createdPage.layout || layoutPayload);
            toast.success('Page created');
            setShowAddPageGuide(false);
            setIsAddModalOpen(false);
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to create page');
        } finally {
            setCreatingPage(false);
        }
    };

    // Filter components
    const filteredComponents = useMemo(() => {
        return mergedComponents.filter(comp => {
            const matchesSearch = comp.component_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                comp.description?.toLowerCase().includes(searchTerm.toLowerCase());
            const categoryOptions = COMPONENT_CATEGORIES[selectedCategory];
            const matchesCategory = selectedCategory === 'all' ||
                categoryOptions?.includes(comp.component_type) ||
                categoryOptions?.includes(comp.component_name);
            return matchesSearch && matchesCategory;
        });
    }, [mergedComponents, searchTerm, selectedCategory]);

    const renderPreviewContent = (comp) => {
        if (comp.component_type === 'PanelHighlight') {
            const actions = comp.props?.actions || comp.preview?.actions || ['Add Call', 'New Task'];
            const stats = comp.props?.stats || comp.preview?.stats || ['Leads: 0', 'Calls: 0'];
            return (
                <div className="panel-highlight-preview">
                    <div className="panel-actions">
                        {actions.map((action) => (
                            <button key={action} type="button">{action}</button>
                        ))}
                    </div>
                    <div className="panel-stats">
                        {stats.map((stat) => (
                            <span key={stat}>{stat}</span>
                        ))}
                    </div>
                </div>
            );
        }

        if (comp.component_type === 'RecordPage') {
            const client = comp.preview?.client || { name: 'Client Name', account: 'AC-000', phone: '—' };
            const timeline = comp.preview?.timeline || ['No recent activity'];
            const filters = comp.preview?.quickFilters || ['Open', 'Active'];
            return (
                <div className="record-page-preview">
                    <div className="record-search">
                        <input type="text" placeholder="Search client records..." readOnly />
                        <button type="button">Search</button>
                    </div>
                    <div className="record-details">
                        <div className="record-name">
                            <strong>{client.name}</strong>
                            <span>{client.account}</span>
                        </div>
                        <p>Phone: {client.phone}</p>
                    </div>
                    <div className="record-filters">
                        {filters.map((filter) => (
                            <span key={filter}>{filter}</span>
                        ))}
                    </div>
                    <div className="record-timeline">
                        {timeline.map((item) => (
                            <div key={item} className="record-timeline-item">{item}</div>
                        ))}
                    </div>
                </div>
            );
        }

        return (
            <div className="preview-placeholder">
                {comp.component_type} Preview
            </div>
        );
    };

    const selectComponent = (rowIndex, colIndex, compIndex, component) => {
        setSelectedComponent(component);
        setSelectedComponentPosition({ rowIndex, colIndex, compIndex });
        setShowProperties(true);
    };

    const updateSelectedComponent = (updater) => {
        if (!selectedComponentPosition || !layout?.rows) return;
        const { rowIndex, colIndex, compIndex } = selectedComponentPosition;
        const newLayout = cloneLayoutState(layout);
        const target = newLayout.rows[rowIndex]?.columns[colIndex]?.components[compIndex];
        if (!target) return;
        const updatedComponent = { ...target, ...updater(target) };
        newLayout.rows[rowIndex].columns[colIndex].components[compIndex] = updatedComponent;
        updateLayout(newLayout);
        setSelectedComponent(updatedComponent);
    };

    const updateComponentProp = (key, value) => {
        updateSelectedComponent((prev) => ({
            props: { ...prev.props, [key]: value }
        }));
    };

    const updateComponentSetting = (key, value) => {
        updateSelectedComponent((prev) => ({
            settings: { ...prev.settings, [key]: value }
        }));
    };

    const updateComponentSpacing = (type, edge, value) => {
        const normalizedValue = value === '' ? '' : Number(value);
        updateSelectedComponent((prev) => ({
            settings: {
                ...prev.settings,
                [type]: {
                    ...prev.settings?.[type],
                    [edge]: Number.isNaN(normalizedValue) ? value : normalizedValue
                }
            }
        }));
    };

    const handleArrayPropChange = (key, rawValue) => {
        updateComponentProp(key, parseCommaSeparated(rawValue));
    };

    const handleSettingsJsonApply = () => {
        try {
            const parsed = JSON.parse(settingsJson || '{}');
            updateComponentSetting('settings', parsed);
            toast.success('Settings synchronized');
        } catch (error) {
            toast.error('Invalid JSON, please review the syntax');
        }
    };

    const updateVisibilityRule = (field, operator, value) => {
        updateSelectedComponent((prev) => ({
            visibilityRule: {
                ...prev.visibilityRule,
                field: field ?? prev.visibilityRule?.field,
                operator: operator ?? prev.visibilityRule?.operator,
                value: value ?? prev.visibilityRule?.value
            }
        }));
    };

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const clampWidth = (value, layout) =>
        clamp(value, layout?.minWidth || DEFAULT_COMPONENT_LAYOUT.minWidth, layout?.maxWidth || DEFAULT_COMPONENT_LAYOUT.maxWidth);
    const clampHeight = (value) => clamp(value, 1, 12);

    const adjustComponentWidth = (delta) => {
        updateSelectedComponent((prev) => {
            const layout = prev.layout || DEFAULT_COMPONENT_LAYOUT;
            const current = layout.width || DEFAULT_COMPONENT_LAYOUT.width;
            const next = clampWidth(current + delta, layout);
            return {
                layout: {
                    ...layout,
                    width: next
                }
            };
        });
    };

    const adjustComponentHeight = (delta) => {
        updateSelectedComponent((prev) => {
            const layout = prev.layout || DEFAULT_COMPONENT_LAYOUT;
            const current = layout.height || DEFAULT_COMPONENT_LAYOUT.height;
            const next = clampHeight(current + delta);
            return {
                layout: {
                    ...layout,
                    height: next
                }
            };
        });
    };

    // Component card click
    const handleComponentClick = (component) => {
        setSelectedComponent(component);
        setShowProperties(true);
    };

    const selectedComponentProps = selectedComponent?.props || {};
    const selectedComponentSettings = selectedComponent?.settings || {};
    const selectedComponentWidth = selectedComponent?.layout?.width || DEFAULT_COMPONENT_LAYOUT.width;
    const selectedComponentHeight = selectedComponent?.layout?.height || DEFAULT_COMPONENT_LAYOUT.height;
    const selectedComponentFieldsValue = formatCommaSeparated(selectedComponentProps.fields);
    const selectedComponentActionsValue = formatCommaSeparated(selectedComponentProps.actions);
    const selectedDataSourceFieldHints =
        BUILT_IN_OBJECT_FIELDS[selectedComponentProps.dataSource] || [];
    const getSpacingValue = (type, side) => selectedComponentSettings[type]?.[side] ?? '';

    if (loading) return <Loading />;

    return (
        <div className="kodi-builder">
            {showAddPageGuide && (
                <section className="add-page-guide">
                    <div className="guide-content">
                        <div>
                            <p className="guide-label">Step 1</p>
                            <h2>Start by adding a Kodi page</h2>
                            <p>Give your page a meaningful label, choose a slug, and then jump straight into building the experience.</p>
                        </div>
                        <div className="guide-actions">
                            <button className="btn-primary" onClick={openAddPageModal}>Add a page</button>
                            <button className="btn-secondary" onClick={() => setShowAddPageGuide(false)}>Not right now</button>
                        </div>
                    </div>
                </section>
            )}

            {isAddModalOpen && (
                <div className="modal-backdrop">
                    <div className="modal-card">
                        <h3>Label your Kodi page</h3>
                        <p>Name the page so other teams instantly recognize it.</p>
                        <form onSubmit={submitNewPage}>
                            <label htmlFor="kodiPageName">Page Name</label>
                            <input
                                id="kodiPageName"
                                value={newPageName}
                                onChange={(e) => setNewPageName(e.target.value)}
                                placeholder="e.g., Client Intake Dashboard"
                                required
                            />
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={creatingPage}>
                                    {creatingPage ? 'Creating...' : 'Create page'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Header */}
            <header className="builder-header">
                <div className="header-left">
                    <h1 className="builder-title">
                        <span className="title-icon">⚡</span>
                        Kodi Page Builder
                    </h1>
                    <div className="page-selector">
                        <select
                            value={selectedPageId}
                            onChange={(e) => {
                                const page = pages.find(p => p.id === e.target.value);
                                setSelectedPageId(e.target.value);
                                const layoutPayload = page?.layout || createDefaultLayout();
                                setLayout(cloneLayoutState(layoutPayload));
                                setHistory([]);
                                setHistoryIndex(-1);
                                setSelectedComponent(null);
                                setSelectedComponentPosition(null);
                                setShowProperties(false);
                                setDropTarget(null);
                            }}
                            className="page-select"
                        >
                            <option value="" disabled>Select a page</option>
                            {pages.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                            <button className="btn-icon" onClick={openAddPageModal} title="Create new page">
                            <span>+</span>
                        </button>
                    </div>
                </div>

                <div className="header-right">
                    <div className="zoom-controls">
                        <button
                            className="btn-icon"
                            onClick={() => setZoom(Math.max(50, zoom - 10))}
                            disabled={zoom <= 50}
                        >
                            −
                        </button>
                        <span className="zoom-level">{zoom}%</span>
                        <button
                            className="btn-icon"
                            onClick={() => setZoom(Math.min(150, zoom + 10))}
                            disabled={zoom >= 150}
                        >
                            +
                        </button>
                    </div>

                    <button
                        className="btn-icon"
                        onClick={undo}
                        disabled={historyIndex <= 0}
                        title="Undo"
                    >
                        ↩
                    </button>
                    <button
                        className="btn-icon"
                        onClick={redo}
                        disabled={historyIndex >= history.length - 1}
                        title="Redo"
                    >
                        ↪
                    </button>

                    <button
                        className={`btn-icon ${showGrid ? 'active' : ''}`}
                        onClick={() => setShowGrid(!showGrid)}
                        title="Toggle grid"
                    >
                        ▦
                    </button>

                    <button
                        className="btn-secondary"
                        onClick={openLivePage}
                        disabled={!selectedPage?.slug}
                        title="Open the live page"
                    >
                        View Live Page
                    </button>

                    <button className="btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Page'}
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="builder-content">
                {/* Sidebar - Components */}
                <aside className="components-sidebar">
                    <div className="sidebar-header">
                        <h3>Components</h3>
                        <div className="component-search">
                            <input
                                type="text"
                                placeholder="Search components..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                            />
                        </div>
                    </div>

                    <div className="component-categories">
                        <button
                            className={`category-tab ${selectedCategory === 'all' ? 'active' : ''}`}
                            onClick={() => setSelectedCategory('all')}
                        >
                            All
                        </button>
                        {Object.keys(COMPONENT_CATEGORIES).map(cat => (
                            <button
                                key={cat}
                                className={`category-tab ${selectedCategory === cat ? 'active' : ''}`}
                                onClick={() => setSelectedCategory(cat)}
                            >
                                {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </button>
                        ))}
                    </div>

                    <div className="components-list">
                        {filteredComponents.length === 0 ? (
                            <div className="empty-components">
                                <span className="empty-icon">📦</span>
                                <p>No components found</p>
                            </div>
                        ) : (
                            filteredComponents.map((comp) => (
                                <div
                                    key={comp.id}
                                    className={`component-item ${selectedComponent?.instanceId === comp.instanceId ? 'selected' : ''}`}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('kodi-component', JSON.stringify(comp));
                                        e.dataTransfer.effectAllowed = 'copy';
                                        setIsDragging(true);
                                    }}
                                    onDragEnd={() => setIsDragging(false)}
                                    onClick={() => handleComponentClick(comp)}
                                >
                                    <div className="component-icon">
                                        {comp.component_type === 'Table' && '📊'}
                                        {comp.component_type === 'Form' && '📝'}
                                        {comp.component_type === 'Chart' && '📈'}
                                        {comp.component_type === 'Card' && '🃏'}
                                        {comp.component_type === 'Button' && '🔘'}
                                        {comp.component_type === 'Input' && '⌨️'}
                                        {comp.component_type === 'PanelHighlight' && '✨'}
                                        {comp.component_type === 'RecordPage' && '📋'}
                                        {!['Table','Form','Chart','Card','Button','Input','PanelHighlight','RecordPage'].includes(comp.component_type) && '📦'}
                                    </div>
                                    <div className="component-info">
                                        <div className="component-name">{getComponentLabel(comp)}</div>
                                        <div className="component-type">{comp.component_type} · v{comp.version}</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </aside>

                {/* Canvas */}
                <main className="builder-canvas">
                    <div
                        className="canvas-inner"
                        style={{
                            transform: `scale(${zoom / 100})`,
                            transformOrigin: 'top center'
                        }}
                    >
                        {showGrid && <div className="grid-overlay" />}

                        {!selectedPage ? (
                            <div className="empty-canvas">
                                <span className="empty-icon">📄</span>
                                <h3>Select a page to start building</h3>
                                <p>Choose a page from the dropdown or create a new one</p>
                                <button className="btn-primary" onClick={openAddPageModal}>
                                    Create New Page
                                </button>
                            </div>
                        ) : (
                            <div className="layout-builder">
                                <div className="page-info-bar">
                                    <span className="page-name">{selectedPage.name}</span>
                                    <span className="page-slug">/{selectedPage.slug}</span>
                                    <button className="btn-icon-small" onClick={addRow}>
                                        <span>+</span> Add Row
                                    </button>
                                </div>

                                {(!layout?.rows || layout.rows.length === 0) ? (
                                    <div className="empty-layout">
                                        <p>No rows yet. Click "Add Row" to start building.</p>
                                    </div>
                                ) : (
                                    layout.rows.map((row, rowIndex) => (
                                        <div key={row.id || rowIndex} className="builder-row">
                                            <div className="row-header">
                                                <span className="row-label">Row {rowIndex + 1}</span>
                                                <div className="row-actions">
                                                    <button
                                                        className="btn-icon-small"
                                                        onClick={() => addColumn(rowIndex)}
                                                        title="Add column"
                                                    >
                                                        +
                                                    </button>
                                                    <button
                                                        className="btn-icon-small delete"
                                                        onClick={() => deleteRow(rowIndex)}
                                                        title="Delete row"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="row-columns">
                                                {row.columns.map((col, colIndex) => (
                                            <div
                                                key={col.id || colIndex}
                                                className={`builder-column ${dropTarget === `${rowIndex}-${colIndex}` ? 'drop-active' : ''}`}
                                                style={{ width: `${(col.width / 12) * 100}%` }}
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    handleColumnDragEnter(rowIndex, colIndex, e);
                                                }}
                                                onDragLeave={handleColumnDragLeave}
                                                onDrop={(e) => handleColumnDrop(rowIndex, colIndex, e)}
                                            >
                                                        <div className="column-header">
                                                            <span className="column-width">{col.width}/12</span>
                                                            <button
                                                                className="btn-icon-small delete"
                                                                onClick={() => deleteColumn(rowIndex, colIndex)}
                                                                title="Delete column"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>

                                                        <div className="column-components">
                                                            {col.components.length === 0 ? (
                                                                <div className="empty-column">
                                                                    <span>Drop components here</span>
                                                                </div>
                                                            ) : (
                                                                col.components.map((comp, compIndex) => (
                                                        <div
                                                            key={comp.instanceId || compIndex}
                                                            className={`component-preview ${selectedComponent?.instanceId === comp.instanceId ? 'selected' : ''}`}
                                                            draggable
                                                            onDragStart={(e) => handleComponentDragStart(e, rowIndex, colIndex, compIndex)}
                                                            onDragEnd={() => setIsDragging(false)}
                                                            onClick={() => selectComponent(rowIndex, colIndex, compIndex, comp)}
                                                        >
                                                                        <div className="preview-header">
                                                                            <span className="preview-name">{getComponentLabel(comp)}</span>
                                                                            {selectedComponent?.instanceId === comp.instanceId && (
                                                                                <div className="component-resize-controls">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            adjustComponentWidth(-1);
                                                                                        }}
                                                                                    >
                                                                                        -
                                                                                    </button>
                                                                                    <span className="component-width-label">
                                                                                        {(comp.layout?.width || DEFAULT_COMPONENT_LAYOUT.width)}/12
                                                                                    </span>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            adjustComponentWidth(1);
                                                                                        }}
                                                                                    >
                                                                                        +
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                            <button
                                                                                className="btn-icon-small delete"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    removeComponent(rowIndex, colIndex, compIndex);
                                                                                }}
                                                                            >
                                                                                ×
                                                                            </button>
                                                                        </div>
                                                                        <div className="preview-content">
                                                                            {renderPreviewContent(comp)}
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </main>

                {/* Properties Panel */}
                {showProperties && selectedComponent && (
                    <aside className="properties-panel">
                        <div className="panel-header">
                            <h3>Properties</h3>
                            <button className="btn-icon" onClick={() => setShowProperties(false)}>
                                ×
                            </button>
                        </div>

                        <div className="panel-content">
                            <div className="property-section">
                                <h4>Component Info</h4>
                                <div className="property-item">
                                    <label>Name</label>
                                    <input
                                        type="text"
                                        value={selectedComponentLabel}
                                        readOnly
                                        className="property-input"
                                    />
                                </div>
                                <div className="property-item">
                                    <label>Type</label>
                                    <input
                                        type="text"
                                        value={selectedComponent.component_type}
                                        readOnly
                                        className="property-input"
                                    />
                                </div>
                                <div className="property-item">
                                    <label>Version</label>
                                    <input
                                        type="text"
                                        value={selectedComponent.version}
                                        readOnly
                                        className="property-input"
                                    />
                                </div>
                            </div>

                            <div className="property-section">
                                <h4>General</h4>
                                <div className="property-item">
                                    <label>Title</label>
                                    <input
                                        type="text"
                                        className="property-input"
                                        value={selectedComponentProps.title || selectedComponentLabel}
                                        onChange={(e) => updateComponentProp("title", e.target.value)}
                                    />
                                </div>
                                <div className="property-item">
                                    <label>Subtitle</label>
                                    <input
                                        type="text"
                                        className="property-input"
                                        value={selectedComponentProps.subtitle || ""}
                                        onChange={(e) => updateComponentProp("subtitle", e.target.value)}
                                    />
                                </div>
                                <div className="property-item">
                                    <label>Description</label>
                                    <textarea
                                        className="property-textarea"
                                        rows={3}
                                        value={selectedComponentProps.description || ""}
                                        onChange={(e) => updateComponentProp("description", e.target.value)}
                                    />
                                </div>
                                <div className="property-item">
                                    <label>
                                        Actions
                                        <span className="property-hint">Comma separated</span>
                                    </label>
                                    <textarea
                                        className="property-textarea"
                                        rows={2}
                                        value={selectedComponentActionsValue}
                                        onChange={(e) => handleArrayPropChange("actions", e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="property-section">
                                <h4>Actions</h4>
                                <div className="component-action-bar">
                                    {COMPONENT_ACTIONS.map((action) => (
                                        <button
                                            key={action.id}
                                            type="button"
                                            className="component-action-button"
                                            onClick={() => handleComponentAction(action.id)}
                                        >
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="property-section">
                                <h4>Layout & Size</h4>
                                <div className="property-item">
                                    <label>Width ({selectedComponentWidth}/12)</label>
                                    <div className="property-input-group">
                                        <button
                                            type="button"
                                            className="btn-icon-small"
                                            onClick={() => adjustComponentWidth(-1)}
                                        >
                                            -
                                        </button>
                                        <input
                                            type="number"
                                            className="property-input-small"
                                            min={selectedComponent?.layout?.minWidth || DEFAULT_COMPONENT_LAYOUT.minWidth}
                                            max={selectedComponent?.layout?.maxWidth || DEFAULT_COMPONENT_LAYOUT.maxWidth}
                                            value={selectedComponentWidth}
                                            onChange={(e) => {
                                                const value = Number(e.target.value);
                                                if (!Number.isNaN(value)) {
                                                    updateSelectedComponent((prev) => {
                                                        const layout = prev.layout || DEFAULT_COMPONENT_LAYOUT;
                                                        return {
                                                            layout: {
                                                                ...layout,
                                                                width: clampWidth(value, layout)
                                                            }
                                                        };
                                                    });
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="btn-icon-small"
                                            onClick={() => adjustComponentWidth(1)}
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                                <div className="property-item">
                                    <label>Height ({selectedComponentHeight})</label>
                                    <div className="property-input-group">
                                        <button
                                            type="button"
                                            className="btn-icon-small"
                                            onClick={() => adjustComponentHeight(-1)}
                                        >
                                            -
                                        </button>
                                        <input
                                            type="number"
                                            className="property-input-small"
                                            min={1}
                                            max={12}
                                            value={selectedComponentHeight}
                                            onChange={(e) => {
                                                const value = Number(e.target.value);
                                                if (!Number.isNaN(value)) {
                                                    updateSelectedComponent((prev) => ({
                                                        layout: {
                                                            ...prev.layout,
                                                            height: clampHeight(value)
                                                        }
                                                    }));
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="btn-icon-small"
                                            onClick={() => adjustComponentHeight(1)}
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="property-section">
                                <h4>Data Binding</h4>
                                <div className="property-item">
                                    <label>Data Source</label>
                                    <select
                                        className="property-select"
                                        value={selectedComponentProps.dataSource || ""}
                                        onChange={(e) => updateComponentProp("dataSource", e.target.value)}
                                    >
                                        <option value="">Select data source</option>
                                        {BUILT_IN_OBJECTS.map((source) => (
                                            <option key={source.name} value={source.name}>
                                                {source.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="property-item">
                                    <label>
                                        Fields
                                        {selectedDataSourceFieldHints.length > 0 && (
                                            <span className="property-hint">
                                                Suggested: {selectedDataSourceFieldHints.join(', ')}
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        type="text"
                                        className="property-input"
                                        value={selectedComponentFieldsValue}
                                        onChange={(e) => handleArrayPropChange("fields", e.target.value)}
                                        placeholder="id, name, status"
                                    />
                                </div>
                                <div className="property-item">
                                    <label>API Endpoint</label>
                                    <input
                                        type="text"
                                        className="property-input"
                                        value={selectedComponentProps.endpoint || ""}
                                        onChange={(e) => updateComponentProp("endpoint", e.target.value)}
                                        placeholder="/api/contacts"
                                    />
                                </div>
                            </div>

                            <div className="property-section">
                                <h4>Spacing & Styling</h4>
                                <div className="property-item">
                                    <label>Margin</label>
                                    <div className="property-input-group">
                                        <input
                                            type="number"
                                            className="property-input-small"
                                            placeholder="Top"
                                            value={getSpacingValue("margin", "top")}
                                            onChange={(e) => updateComponentSpacing("margin", "top", e.target.value)}
                                        />
                                        <input
                                            type="number"
                                            className="property-input-small"
                                            placeholder="Right"
                                            value={getSpacingValue("margin", "right")}
                                            onChange={(e) => updateComponentSpacing("margin", "right", e.target.value)}
                                        />
                                        <input
                                            type="number"
                                            className="property-input-small"
                                            placeholder="Bottom"
                                            value={getSpacingValue("margin", "bottom")}
                                            onChange={(e) => updateComponentSpacing("margin", "bottom", e.target.value)}
                                        />
                                        <input
                                            type="number"
                                            className="property-input-small"
                                            placeholder="Left"
                                            value={getSpacingValue("margin", "left")}
                                            onChange={(e) => updateComponentSpacing("margin", "left", e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="property-item">
                                    <label>Padding</label>
                                    <div className="property-input-group">
                                        <input
                                            type="number"
                                            className="property-input-small"
                                            placeholder="Top"
                                            value={getSpacingValue("padding", "top")}
                                            onChange={(e) => updateComponentSpacing("padding", "top", e.target.value)}
                                        />
                                        <input
                                            type="number"
                                            className="property-input-small"
                                            placeholder="Right"
                                            value={getSpacingValue("padding", "right")}
                                            onChange={(e) => updateComponentSpacing("padding", "right", e.target.value)}
                                        />
                                        <input
                                            type="number"
                                            className="property-input-small"
                                            placeholder="Bottom"
                                            value={getSpacingValue("padding", "bottom")}
                                            onChange={(e) => updateComponentSpacing("padding", "bottom", e.target.value)}
                                        />
                                        <input
                                            type="number"
                                            className="property-input-small"
                                            placeholder="Left"
                                            value={getSpacingValue("padding", "left")}
                                            onChange={(e) => updateComponentSpacing("padding", "left", e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="property-item">
                                    <label>Background Color</label>
                                    <input
                                        type="color"
                                        className="property-color"
                                        value={selectedComponentSettings.backgroundColor || "#ffffff"}
                                        onChange={(e) => updateComponentSetting("backgroundColor", e.target.value)}
                                    />
                                </div>
                                <div className="property-item">
                                    <label>Text Color</label>
                                    <input
                                        type="color"
                                        className="property-color"
                                        value={selectedComponentSettings.textColor || "#1f2b3b"}
                                        onChange={(e) => updateComponentSetting("textColor", e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="property-section">
                                <h4>Visibility Rule</h4>
                                <div className="property-item">
                                    <label>Field</label>
                                    <input
                                        type="text"
                                        className="property-input"
                                        placeholder="subscription.status"
                                        value={selectedComponent?.visibilityRule?.field || ''}
                                        onChange={(e) => updateVisibilityRule(e.target.value, null, null)}
                                    />
                                </div>
                                <div className="property-item">
                                    <label>Operator</label>
                                    <select
                                        className="property-select"
                                        value={selectedComponent?.visibilityRule?.operator || 'equals'}
                                        onChange={(e) => updateVisibilityRule(null, e.target.value, null)}
                                    >
                                        <option value="equals">Equals</option>
                                        <option value="not_equals">Not equals</option>
                                        <option value="in">In</option>
                                        <option value="contains">Contains</option>
                                    </select>
                                </div>
                                <div className="property-item">
                                    <label>Value</label>
                                    <input
                                        type="text"
                                        className="property-input"
                                        placeholder="active"
                                        value={selectedComponent?.visibilityRule?.value || ''}
                                        onChange={(e) => updateVisibilityRule(null, null, e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="property-section">
                                <h4>Advanced</h4>
                                <div className="property-item">
                                    <label>
                                        Settings JSON
                                        <button type="button" className="btn-text small" onClick={handleSettingsJsonApply}>
                                            Apply JSON
                                        </button>
                                    </label>
                                    <textarea
                                        className="property-textarea"
                                        rows={6}
                                        value={settingsJson}
                                        onChange={(e) => setSettingsJson(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="panel-footer">
                            <button className="btn-secondary" onClick={() => setShowProperties(false)}>
                                Close
                            </button>
                            <button className="btn-primary" onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Page'}
                            </button>
                        </div>
                    </aside>
                )}
            </div>

            {/* Status Bar */}
            <footer className="builder-footer">
                <div className="status-left">
                    <span className="status-item">
                        <span className="status-dot" /> Connected
                    </span>
                    <span className="status-item">
                        Pages: {pages.length}
                    </span>
                    <span className="status-item">
                        Components: {mergedComponents.length}
                    </span>
                </div>
                <div className="status-right">
                    <span className="status-item">
                        {isDragging ? 'Dragging...' : 'Ready'}
                    </span>
                </div>
            </footer>
        </div>
    );
};

export default KodiBuilder;
