import React, { useEffect, useMemo, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import Loading from '../../components/common/Loading';
import { createKodiPage, listKCComponents, listKodiPages, updateKodiPage } from '../../services/kodiPageService';
import './KodiBuilder.css';

const createDefaultLayout = () => ({
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

const KodiBuilder = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pages, setPages] = useState([]);
    const [components, setComponents] = useState([]);
    const [selectedPageId, setSelectedPageId] = useState('');
    const [layout, setLayout] = useState(null);
    const [selectedComponent, setSelectedComponent] = useState(null);
    const [showProperties, setShowProperties] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [zoom, setZoom] = useState(100);
    const [showGrid, setShowGrid] = useState(true);
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [isDragging, setIsDragging] = useState(false);
    const [showAddPageGuide, setShowAddPageGuide] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newPageName, setNewPageName] = useState('');
    const [creatingPage, setCreatingPage] = useState(false);

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
            const [pagesRes, compRes] = await Promise.all([listKodiPages(), listKCComponents()]);
            const pagesData = pagesRes?.data || [];
            const compsData = compRes?.data || [];

            setPages(pagesData);
            setComponents(compsData);

            if (pagesData.length > 0) {
                const firstPage = pagesData[0];
                setSelectedPageId(firstPage.id);
                setLayout(firstPage.layout || createDefaultLayout());
            }
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to load Kodi builder data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    // Save to history
    const saveToHistory = useCallback((newLayout) => {
        setHistory(prev => {
            const newHistory = prev.slice(0, historyIndex + 1);
            return [...newHistory, newLayout];
        });
        setHistoryIndex(prev => prev + 1);
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
        const newLayout = {
            ...layout,
            rows: [
                ...(layout?.rows || []),
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
        };
        updateLayout(newLayout);
        toast.success('Row added');
    };

    // Add column to row
    const addColumn = (rowIndex) => {
        if (!layout?.rows) return;

        const currentColumns = layout.rows[rowIndex].columns.length;
        if (currentColumns >= 4) {
            toast.error('Maximum 4 columns per row');
            return;
        }

        const newWidth = Math.floor(12 / (currentColumns + 1));

        const newLayout = { ...layout };
        newLayout.rows[rowIndex].columns = [
            ...newLayout.rows[rowIndex].columns,
            {
                id: `col-${Date.now()}-${currentColumns + 1}`,
                width: newWidth,
                components: []
            }
        ];

        // Redistribute widths
        newLayout.rows[rowIndex].columns = newLayout.rows[rowIndex].columns.map(col => ({
            ...col,
            width: newWidth
        }));

        updateLayout(newLayout);
        toast.success('Column added');
    };

    // Delete row
    const deleteRow = (rowIndex) => {
        const newLayout = {
            ...layout,
            rows: layout.rows.filter((_, index) => index !== rowIndex)
        };
        updateLayout(newLayout);
        toast.success('Row deleted');
    };

    // Delete column
    const deleteColumn = (rowIndex, colIndex) => {
        const newLayout = { ...layout };
        newLayout.rows[rowIndex].columns = newLayout.rows[rowIndex].columns.filter((_, index) => index !== colIndex);

        // Redistribute widths
        const newWidth = Math.floor(12 / newLayout.rows[rowIndex].columns.length);
        newLayout.rows[rowIndex].columns = newLayout.rows[rowIndex].columns.map(col => ({
            ...col,
            width: newWidth
        }));

        updateLayout(newLayout);
        toast.success('Column deleted');
    };

    // Add component to column
    const addComponentToColumn = (rowIndex, colIndex, component) => {
        const newLayout = { ...layout };
        const newComponent = {
            ...component,
            instanceId: `${component.id}-${Date.now()}`,
            settings: {}
        };

        newLayout.rows[rowIndex].columns[colIndex].components.push(newComponent);
        updateLayout(newLayout);
        toast.success(`${component.component_name} added`);
    };

    // Remove component
    const removeComponent = (rowIndex, colIndex, compIndex) => {
        const newLayout = { ...layout };
        newLayout.rows[rowIndex].columns[colIndex].components =
            newLayout.rows[rowIndex].columns[colIndex].components.filter((_, index) => index !== compIndex);
        updateLayout(newLayout);
        setSelectedComponent(null);
        toast.success('Component removed');
    };

    // Save page
    const handleSave = async () => {
        if (!selectedPage) return;

        setSaving(true);
        try {
            await updateKodiPage(selectedPage.id, { layout });
            toast.success('Page saved successfully');
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

        const baseSlug = slugifyString(name);
        let slug = ensureUniqueSlug(baseSlug, pages.map((p) => p.slug));
        const layoutPayload = createDefaultLayout();

        setCreatingPage(true);
        try {
            let createdPage = null;
            let attempt = 0;
            let lastError = null;

            while (!createdPage && attempt < 3) {
                try {
                    const res = await createKodiPage({
                        name,
                        slug,
                        layout: layoutPayload
                    });
                    createdPage = res?.data;
                } catch (error) {
                    lastError = error;
                    const message = (error?.response?.data?.error || '').toLowerCase();
                    if (!message.includes('slug already exists')) {
                        throw error;
                    }
                    attempt += 1;
                    const refreshed = await listKodiPages();
                    const refreshedSlugs = (refreshed?.data || []).map((p) => p.slug);
                    slug = ensureUniqueSlug(`${baseSlug}-${attempt}`, refreshedSlugs);
                }
            }

            if (!createdPage) {
                throw lastError || new Error('Failed to create page');
            }

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
            const actions = comp.preview?.actions || ['Add Call', 'New Task'];
            const stats = comp.preview?.stats || ['Leads: 0', 'Calls: 0'];
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

    // Component card click
    const handleComponentClick = (component) => {
        setSelectedComponent(component);
        setShowProperties(true);
    };

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
                                setLayout(page?.layout || createDefaultLayout());
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
                                    className={`component-item ${selectedComponent?.id === comp.id ? 'selected' : ''}`}
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('component', JSON.stringify(comp));
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
                                                        className="builder-column"
                                                        style={{ width: `${(col.width / 12) * 100}%` }}
                                                        onDragOver={(e) => e.preventDefault()}
                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            const compData = e.dataTransfer.getData('component');
                                                            if (compData) {
                                                                const component = JSON.parse(compData);
                                                                addComponentToColumn(rowIndex, colIndex, component);
                                                            }
                                                            setIsDragging(false);
                                                        }}
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
                                                                        className={`component-preview ${selectedComponent?.id === comp.id ? 'selected' : ''}`}
                                                                        onClick={() => setSelectedComponent(comp)}
                                                                    >
                                                                        <div className="preview-header">
                                                                            <span className="preview-name">{getComponentLabel(comp)}</span>
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
                                <h4>Settings</h4>
                                <div className="property-item">
                                    <label>Width</label>
                                    <select className="property-select">
                                        <option>Full Width</option>
                                        <option>Half Width</option>
                                        <option>Auto</option>
                                    </select>
                                </div>
                                <div className="property-item">
                                    <label>Margin</label>
                                    <div className="property-input-group">
                                        <input type="number" placeholder="Top" className="property-input-small" />
                                        <input type="number" placeholder="Right" className="property-input-small" />
                                        <input type="number" placeholder="Bottom" className="property-input-small" />
                                        <input type="number" placeholder="Left" className="property-input-small" />
                                    </div>
                                </div>
                                <div className="property-item">
                                    <label>Padding</label>
                                    <div className="property-input-group">
                                        <input type="number" placeholder="Top" className="property-input-small" />
                                        <input type="number" placeholder="Right" className="property-input-small" />
                                        <input type="number" placeholder="Bottom" className="property-input-small" />
                                        <input type="number" placeholder="Left" className="property-input-small" />
                                    </div>
                                </div>
                                <div className="property-item">
                                    <label>Background Color</label>
                                    <input type="color" className="property-color" />
                                </div>
                                <div className="property-item">
                                    <label>Text Color</label>
                                    <input type="color" className="property-color" />
                                </div>
                                <div className="property-item">
                                    <label>Border</label>
                                    <select className="property-select">
                                        <option>None</option>
                                        <option>Solid</option>
                                        <option>Dashed</option>
                                        <option>Dotted</option>
                                    </select>
                                </div>
                            </div>

                            <div className="property-section">
                                <h4>Data Binding</h4>
                                <div className="property-item">
                                    <label>Data Source</label>
                                    <select className="property-select">
                                        <option>Static</option>
                                        <option>API</option>
                                        <option>Database</option>
                                    </select>
                                </div>
                                <div className="property-item">
                                    <label>API Endpoint</label>
                                    <input type="text" className="property-input" placeholder="/api/data" />
                                </div>
                            </div>

                            <div className="property-section">
                                <h4>Advanced</h4>
                                <div className="property-item">
                                    <label>CSS Class</label>
                                    <input type="text" className="property-input" placeholder="custom-class" />
                                </div>
                                <div className="property-item">
                                    <label>ID</label>
                                    <input type="text" className="property-input" placeholder="component-id" />
                                </div>
                                <div className="property-item">
                                    <label>Custom Attributes</label>
                                    <textarea className="property-textarea" placeholder='{"data-testid": "component"}' />
                                </div>
                            </div>
                        </div>

                        <div className="panel-footer">
                            <button className="btn-secondary">Apply</button>
                            <button className="btn-primary">Save Changes</button>
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
