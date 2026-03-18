import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Loading from '../../components/common/Loading';
import BuilderCanvas from '../../components/kodi/BuilderCanvas';
import ComponentLibrary from '../../components/kodi/ComponentLibrary';
import ConfigSidebar from '../../components/kodi/ConfigSidebar';
import LayoutSwitcher from '../../components/kodi/LayoutSwitcher';
import AppLinkModal from '../../components/kodi/AppLinkModal';
import CreatePageModal from '../../components/kodi/CreatePageModal';
import {
    activatePlatformPage,
    createPlatformPage,
    linkPlatformPage,
    listPlatformApps,
    listPlatformComponents,
    listPlatformObjects,
    listPlatformPages,
    updatePlatformLayout
} from '../../services/kodiPageService';
import './KodiBuilder.css';

const DEFAULT_LAYOUT = {
    type: '1-column',
    orientation: 'horizontal',
    rows: [
        {
            id: 'row-1',
            columns: [{ id: 'col-1', width: 12, components: [] }]
        }
    ]
};

const cloneLayout = (layout) => ({
    ...layout,
    rows: (layout.rows || []).map((row) => ({
        ...row,
        columns: (row.columns || []).map((col) => ({
            ...col,
            components: (col.components || []).map((component) => ({
                ...component,
                layout: { width: 6, height: 2, minWidth: 2, maxWidth: 12, ...(component.layout || {}) },
                binding: { ...(component.binding || {}) },
                style: { ...(component.style || {}) },
                permissions: { ...(component.permissions || {}) }
            }))
        }))
    }))
});

const reflowColumns = (layout, columnsPerRow) => {
    const flatComponents = [];
    layout.rows.forEach((row) => {
        row.columns.forEach((col) => {
            (col.components || []).forEach((comp) => flatComponents.push(comp));
        });
    });

    const rows = [];
    let index = 0;
    while (index < flatComponents.length || rows.length === 0) {
        const columns = Array.from({ length: columnsPerRow }).map((_, colIndex) => ({
            id: `col-${rows.length}-${colIndex}`,
            width: Math.floor(12 / columnsPerRow),
            components: []
        }));
        columns.forEach((col) => {
            if (flatComponents[index]) {
                col.components.push(flatComponents[index]);
                index += 1;
            }
        });
        rows.push({ id: `row-${rows.length}`, columns });
        if (flatComponents.length === 0) break;
    }

    return { ...layout, rows };
};

const KodiBuilderPage = () => {
    const { pageId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [pages, setPages] = useState([]);
    const [components, setComponents] = useState([]);
    const [objects, setObjects] = useState([]);
    const [layout, setLayout] = useState(DEFAULT_LAYOUT);
    const [selectedComponent, setSelectedComponent] = useState(null);
    const [selectedPosition, setSelectedPosition] = useState(null);
    const [saving, setSaving] = useState(false);
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [apps, setApps] = useState([]);
    const [appsLoading, setAppsLoading] = useState(false);
    const [selectedAppId, setSelectedAppId] = useState('');
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [previewRole, setPreviewRole] = useState('admin');

    const currentPage = useMemo(() => pages.find((page) => String(page.id) === String(pageId)), [pages, pageId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [pagesData, componentsData, objectsData] = await Promise.all([
                listPlatformPages(),
                listPlatformComponents(),
                listPlatformObjects()
            ]);
            setPages(pagesData || []);
            setComponents(componentsData || []);
            setObjects(objectsData || []);
            const page = (pagesData || []).find((item) => String(item.id) === String(pageId));
            setLayout(cloneLayout(page?.layout || DEFAULT_LAYOUT));
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to load builder data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [pageId]);

    const updateLayout = (updater) => {
        setLayout((prev) => {
            const next = cloneLayout(prev);
            updater(next);
            return next;
        });
    };

    const handleComponentDrop = ({ source, target, component }) => {
        updateLayout((draft) => {
            const targetCol = draft.rows[target.rowIndex]?.columns[target.colIndex];
            if (!targetCol) return;

            let payload = component;
            if (source) {
                const sourceCol = draft.rows[source.rowIndex]?.columns[source.colIndex];
                if (!sourceCol) return;
                payload = sourceCol.components.splice(source.compIndex, 1)[0];
            }
            if (!payload) return;

            const instance = source
                ? payload
                : {
                    ...payload,
                    instanceId: `${payload.name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    label: payload.label,
                    component_type: payload.name,
                    layout: payload.defaultLayout || { width: 6, height: 2, minWidth: 2, maxWidth: 12 },
                    props: payload.defaultProps || {},
                    binding: {},
                    visibilityRule: {},
                    permissions: { roles: [] },
                    actions: [],
                    style: {}
                };

            const insertAt = target.targetIndex ?? targetCol.components.length;
            const adjustedIndex =
                source &&
                source.rowIndex === target.rowIndex &&
                source.colIndex === target.colIndex &&
                insertAt > source.compIndex
                    ? insertAt - 1
                    : insertAt;
            targetCol.components.splice(adjustedIndex, 0, instance);
            setSelectedComponent(instance);
            setSelectedPosition({ rowIndex: target.rowIndex, colIndex: target.colIndex, compIndex: adjustedIndex });
        });
    };

    const handleSelectComponent = (component, position) => {
        setSelectedComponent(component);
        setSelectedPosition(position);
    };

    const handleUpdateSelected = (next) => {
        if (!selectedPosition) return;
        updateLayout((draft) => {
            const target = draft.rows[selectedPosition.rowIndex]?.columns[selectedPosition.colIndex]?.components[selectedPosition.compIndex];
            if (!target) return;
            Object.assign(target, next);
            setSelectedComponent(target);
        });
    };

    const handleSave = async () => {
        if (!currentPage) return;
        setSaving(true);
        try {
            await updatePlatformLayout(currentPage.id, layout);
            toast.success('Layout saved');
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const handleActivate = async () => {
        if (!currentPage) return;
        try {
            await activatePlatformPage(currentPage.id);
            toast.success('Page activated');
            loadData();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Activation failed');
        }
    };

    const openLinkModal = async () => {
        setLinkModalOpen(true);
        setAppsLoading(true);
        try {
            const data = await listPlatformApps();
            setApps(data || []);
        } catch (error) {
            toast.error('Failed to load apps');
        } finally {
            setAppsLoading(false);
        }
    };

    const handleLink = async () => {
        if (!selectedAppId || !currentPage) return;
        try {
            await linkPlatformPage(currentPage.id, selectedAppId);
            toast.success('Page linked');
            setLinkModalOpen(false);
            setSelectedAppId('');
            loadData();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Link failed');
        }
    };

    const handleLayoutChange = (patch) => {
        setLayout((prev) => {
            let next = { ...prev, ...patch };
            if (patch.type) {
                const columns = patch.type === '3-column' ? 3 : patch.type === '2-column' ? 2 : 1;
                next = reflowColumns(next, columns);
            }
            if (patch.orientation === 'mixed') {
                next.rows = next.rows.map((row, index) => ({
                    ...row,
                    orientation: index % 2 === 0 ? 'horizontal' : 'vertical'
                }));
            }
            return next;
        });
    };

    const handleCreatePage = async (payload) => {
        try {
            const page = await createPlatformPage(payload);
            toast.success('Page created');
            navigate(`/kodi/builder/${page.id}`);
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to create page');
        } finally {
            setCreateModalOpen(false);
        }
    };

    if (loading) {
        return (
            <div className="kodi-builder">
                <Loading />
            </div>
        );
    }

    return (
        <div className="kodi-builder">
            <header className="kodi-builder__toolbar">
                <div>
                    <h1>{currentPage?.label || 'Kodi Builder'}</h1>
                    <p>Status: {currentPage?.status || 'draft'}</p>
                </div>
                <div className="kodi-builder__toolbar-actions">
                    <select value={previewRole} onChange={(e) => setPreviewRole(e.target.value)}>
                        <option value="admin">Admin</option>
                        <option value="employee">Employee</option>
                        <option value="psychologist">Psychologist</option>
                        <option value="business_user">Business User</option>
                    </select>
                    <button className="btn-secondary" onClick={() => navigate('/kodi/times')}>Back to Times</button>
                    <button className="btn-secondary" onClick={() => setCreateModalOpen(true)}>Create Page</button>
                    <button className="btn-secondary" onClick={() => window.open(`/kodi/runtime/${pageId}`, '_blank')}>Preview Runtime</button>
                    <button className="btn-secondary" onClick={openLinkModal}>Link to App</button>
                    <button className="btn-secondary" onClick={handleActivate}>Activate Page</button>
                    <button className="btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Layout'}
                    </button>
                </div>
            </header>

            <LayoutSwitcher
                layoutType={layout.type}
                orientation={layout.orientation}
                onChange={handleLayoutChange}
            />

            <div className="kodi-builder__content">
                <ComponentLibrary
                    components={components}
                    onDragStart={(event, component) => {
                        event.dataTransfer.setData('kodi-component-library', JSON.stringify(component));
                        event.dataTransfer.effectAllowed = 'copy';
                    }}
                />
                <BuilderCanvas
                    layout={layout}
                    selected={selectedComponent}
                    onSelectComponent={handleSelectComponent}
                    onLayoutChange={updateLayout}
                    onComponentDrop={handleComponentDrop}
                    previewRole={previewRole}
                />
                <ConfigSidebar
                    component={selectedComponent}
                    objects={objects}
                    onUpdate={handleUpdateSelected}
                    onClose={() => setSelectedComponent(null)}
                />
            </div>

            <AppLinkModal
                open={linkModalOpen}
                apps={apps}
                loading={appsLoading}
                selectedId={selectedAppId}
                onSelect={setSelectedAppId}
                onClose={() => setLinkModalOpen(false)}
                onSubmit={handleLink}
            />

            <CreatePageModal
                open={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onSubmit={handleCreatePage}
            />
        </div>
    );
};

export default KodiBuilderPage;
