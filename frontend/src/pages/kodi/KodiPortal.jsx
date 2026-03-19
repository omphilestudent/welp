import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Loading from '../../components/common/Loading';
import {
    assignAppUser,
    assignPageUser,
    createLead,
    createPlatformApp,
    createPlatformField,
    convertLead,
    listLeads,
    listLeadOpportunities,
    listPagePermissions,
    listPlatformApps,
    listPlatformObjects,
    listPlatformPages,
    linkPlatformPage,
    updatePagePermissions,
    updatePlatformApp
} from '../../services/kodiPageService';
import { fetchTableRecords } from '../../services/neonDataService';
import './KodiPortal.css';

const PLATFORM_ROLES = ['admin', 'employee', 'business_user', 'psychologist'];

const unwrapResponse = (payload) => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (payload.success && payload.data !== undefined) return payload.data;
    return payload;
};

const buildPermissionForm = (map, role) => {
    const entry = map?.[role] || {};
    return {
        canView: Boolean(entry?.can_view),
        canEdit: Boolean(entry?.can_edit),
        canUse: Boolean(entry?.can_use)
    };
};

const KodiPortal = () => {
    const navigate = useNavigate();
    const [apps, setApps] = useState([]);
    const [pages, setPages] = useState([]);
    const [loadingApps, setLoadingApps] = useState(false);
    const [loadingPages, setLoadingPages] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [linkModal, setLinkModal] = useState({ open: false, app: null, pageId: '' });
    const [permissionModal, setPermissionModal] = useState({
        open: false,
        page: null,
        role: PLATFORM_ROLES[0],
        map: {},
        form: { canView: false, canEdit: false, canUse: false }
    });
    const [appForm, setAppForm] = useState({ name: '', description: '' });
    const [creatingApp, setCreatingApp] = useState(false);
    const [editAppModal, setEditAppModal] = useState({ open: false, app: null });
    const [editForm, setEditForm] = useState({ name: '', description: '', isActive: true });
    const [savingApp, setSavingApp] = useState(false);
    const [linking, setLinking] = useState(false);
    const [savingPermissions, setSavingPermissions] = useState(false);
    const [objects, setObjects] = useState([]);
    const [loadingObjects, setLoadingObjects] = useState(false);
    const [assignUserModal, setAssignUserModal] = useState({
        open: false,
        app: null,
        email: '',
        roleKey: 'employee',
        permissions: { canView: true, canEdit: false, canUse: false },
        assigning: false
    });
    const [assignPageUserModal, setAssignPageUserModal] = useState({
        open: false,
        page: null,
        email: '',
        permissions: { canView: true, canEdit: false, canUse: false },
        assigning: false
    });
    const [fieldModal, setFieldModal] = useState({
        open: false,
        object: null,
        form: { fieldName: '', fieldType: 'string', isRequired: false, isReadonly: false },
        saving: false
    });
    const [leads, setLeads] = useState([]);
    const [loadingLeads, setLoadingLeads] = useState(false);
    const [leadModal, setLeadModal] = useState({ open: false, name: '', email: '', creating: false });
    const [leadOpportunities, setLeadOpportunities] = useState({});
    const [neonRecords, setNeonRecords] = useState([]);
    const [neonTable, setNeonTable] = useState('contacts');
    const [neonLoading, setNeonLoading] = useState(false);
    const [neonError, setNeonError] = useState('');

    const fetchApps = async () => {
        setLoadingApps(true);
        try {
            const data = await listPlatformApps();
            setApps(unwrapResponse(data));
        } catch (error) {
            toast.error('Unable to load Kodi apps');
        } finally {
            setLoadingApps(false);
        }
    };

    const fetchPages = async () => {
        setLoadingPages(true);
        try {
            const data = await listPlatformPages();
            setPages(unwrapResponse(data));
        } catch (error) {
            toast.error('Unable to load Kodi pages');
        } finally {
            setLoadingPages(false);
        }
    };

    const fetchObjects = async () => {
        setLoadingObjects(true);
        try {
            const data = await listPlatformObjects();
            setObjects(unwrapResponse(data));
        } catch (error) {
            toast.error('Unable to load CRM objects');
        } finally {
            setLoadingObjects(false);
        }
    };

    const fetchLeads = async () => {
        setLoadingLeads(true);
        try {
            const data = await listLeads();
            const rows = unwrapResponse(data);
            setLeads(rows);
            const opportunityRows = await Promise.all(
                rows.map((lead) => listLeadOpportunities(lead.id).catch(() => []))
            );
            const map = {};
            rows.forEach((lead, index) => {
                map[lead.id] = opportunityRows[index] || [];
            });
            setLeadOpportunities(map);
        } catch (error) {
            toast.error('Unable to load leads');
        } finally {
            setLoadingLeads(false);
        }
    };

    const handleFetchNeonTable = async () => {
        setNeonLoading(true);
        setNeonError('');
        try {
            const records = await fetchTableRecords(neonTable, { limit: 5 });
            setNeonRecords(records || []);
            if (!records?.length) {
                setNeonError('No records were returned for that table.');
            }
        } catch (error) {
            setNeonError(error?.message || 'Failed to load data from Neon.');
            setNeonRecords([]);
        } finally {
            setNeonLoading(false);
        }
    };

    useEffect(() => {
        fetchApps();
        fetchObjects();
        fetchLeads();
        fetchPages();
    }, []);

    const refreshData = () => {
        fetchApps();
        fetchPages();
        fetchObjects();
        fetchLeads();
    };

    const availablePagesForApp = (app) => {
        const linkedIds = new Set((app.linked_pages || []).map((page) => page.id));
        return pages.filter((page) => !linkedIds.has(page.id) && page.status === 'activated');
    };

    const handleCreateApp = async (event) => {
        event.preventDefault();
        if (!appForm.name.trim()) {
            toast.error('App name is required');
            return;
        }
        setCreatingApp(true);
        try {
            await createPlatformApp({
                name: appForm.name.trim(),
                description: appForm.description.trim()
            });
            toast.success('App created');
            setCreateModalOpen(false);
            setAppForm({ name: '', description: '' });
            refreshData();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to create app');
        } finally {
            setCreatingApp(false);
        }
    };

    const openEditAppModal = (app) => {
        setEditAppModal({ open: true, app });
        setEditForm({
            name: app?.name || '',
            description: app?.description || '',
            isActive: app?.is_active !== false
        });
    };

    const handleUpdateApp = async (event) => {
        event.preventDefault();
        if (!editAppModal.app) return;
        if (!editForm.name.trim()) {
            toast.error('App name is required');
            return;
        }
        setSavingApp(true);
        try {
            await updatePlatformApp(editAppModal.app.id, {
                name: editForm.name.trim(),
                description: editForm.description.trim(),
                isActive: editForm.isActive
            });
            toast.success('App updated');
            setEditAppModal({ open: false, app: null });
            refreshData();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to update app');
        } finally {
            setSavingApp(false);
        }
    };

    const openLinkModal = (app) => {
        setLinkModal({ open: true, app, pageId: '' });
    };

    const handleLinkPage = async () => {
        if (!linkModal.pageId) {
            toast.error('Select a page to link');
            return;
        }
        if (!linkModal.app) return;
        setLinking(true);
        try {
            await linkPlatformPage(linkModal.pageId, linkModal.app.id);
            toast.success('Page linked to app');
            setLinkModal({ open: false, app: null, pageId: '' });
            refreshData();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Unable to link page');
        } finally {
            setLinking(false);
        }
    };

    const openAssignUserModal = (app) => {
        setAssignUserModal({
            open: true,
            app,
            email: '',
            roleKey: 'employee',
            permissions: { canView: true, canEdit: false, canUse: false },
            assigning: false
        });
    };

    const openAssignPageUserModal = (page) => {
        setAssignPageUserModal({
            open: true,
            page,
            email: '',
            permissions: { canView: true, canEdit: false, canUse: false },
            assigning: false
        });
    };

    const toggleAssignPermission = (field) => {
        setAssignUserModal((prev) => ({
            ...prev,
            permissions: { ...prev.permissions, [field]: !prev.permissions[field] }
        }));
    };

    const handleAssignUser = async () => {
        if (!assignUserModal.app || !assignUserModal.email.trim()) {
            toast.error('Provide an email to invite');
            return;
        }
        setAssignUserModal((prev) => ({ ...prev, assigning: true }));
        try {
            await assignAppUser(assignUserModal.app.id, {
                email: assignUserModal.email.trim(),
                roleKey: assignUserModal.roleKey,
                permissions: assignUserModal.permissions
            });
            toast.success('User assigned to app');
            setAssignUserModal({
                open: false,
                app: null,
                email: '',
                roleKey: 'employee',
                permissions: { canView: true, canEdit: false, canUse: false },
                assigning: false
            });
            refreshData();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Unable to assign user');
            setAssignUserModal((prev) => ({ ...prev, assigning: false }));
        }
    };

    const handleAssignPageUser = async () => {
        if (!assignPageUserModal.page || !assignPageUserModal.email.trim()) {
            toast.error('Provide an email to invite');
            return;
        }
        setAssignPageUserModal((prev) => ({ ...prev, assigning: true }));
        try {
            await assignPageUser(assignPageUserModal.page.id, {
                email: assignPageUserModal.email.trim(),
                permissions: assignPageUserModal.permissions
            });
            toast.success('User assigned to page');
            setAssignPageUserModal({
                open: false,
                page: null,
                email: '',
                permissions: { canView: true, canEdit: false, canUse: false },
                assigning: false
            });
            refreshData();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Unable to assign user');
            setAssignPageUserModal((prev) => ({ ...prev, assigning: false }));
        }
    };

    const openFieldModal = (object) => {
        setFieldModal({
            open: true,
            object,
            form: { fieldName: '', fieldType: 'string', isRequired: false, isReadonly: false },
            saving: false
        });
    };

    const handleFieldSave = async () => {
        if (!fieldModal.object || !fieldModal.form.fieldName.trim()) {
            toast.error('Field name is required');
            return;
        }
        setFieldModal((prev) => ({ ...prev, saving: true }));
        try {
            await createPlatformField(fieldModal.object.id, {
                fieldName: fieldModal.form.fieldName.trim(),
                fieldType: fieldModal.form.fieldType,
                isRequired: fieldModal.form.isRequired,
                isReadonly: fieldModal.form.isReadonly
            });
            toast.success('Field saved');
            setFieldModal({
                open: false,
                object: null,
                form: { fieldName: '', fieldType: 'string', isRequired: false, isReadonly: false },
                saving: false
            });
            fetchObjects();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Unable to save field');
            setFieldModal((prev) => ({ ...prev, saving: false }));
        }
    };

    const openLeadModal = () => {
        setLeadModal({ open: true, name: '', email: '', creating: false });
    };

    const handleLeadCreate = async (event) => {
        event.preventDefault();
        if (!leadModal.name.trim()) {
            toast.error('Lead name is required');
            return;
        }
        setLeadModal((prev) => ({ ...prev, creating: true }));
        try {
            await createLead({
                name: leadModal.name.trim(),
                email: leadModal.email.trim(),
                applicationStatus: 'manual',
                source: 'manual'
            });
            toast.success('Lead created');
            setLeadModal({ open: false, name: '', email: '', creating: false });
            fetchLeads();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to create lead');
            setLeadModal((prev) => ({ ...prev, creating: false }));
        }
    };

    const handleConvertLead = async (leadId) => {
        try {
            await convertLead(leadId, { stage: 'qualified' });
            toast.success('Lead converted to opportunity');
            fetchLeads();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Conversion failed');
        }
    };

    const openPermissionModal = async (page) => {
        setPermissionModal((prev) => ({ ...prev, open: true, page, role: PLATFORM_ROLES[0] }));
        try {
            const data = await listPagePermissions(page.id);
            const map = unwrapResponse(data);
            setPermissionModal({
                open: true,
                page,
                role: PLATFORM_ROLES[0],
                map,
                form: buildPermissionForm(map, PLATFORM_ROLES[0])
            });
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to load permissions');
        }
    };

    const handlePermissionRoleChange = (role) => {
        setPermissionModal((prev) => ({
            ...prev,
            role,
            form: buildPermissionForm(prev.map, role)
        }));
    };

    const togglePermission = (field) => {
        setPermissionModal((prev) => ({
            ...prev,
            form: { ...prev.form, [field]: !prev.form[field] }
        }));
    };

    const handleSavePermissions = async () => {
        if (!permissionModal.page) return;
        setSavingPermissions(true);
        try {
            const updated = await updatePagePermissions(permissionModal.page.id, {
                role: permissionModal.role,
                canView: permissionModal.form.canView,
                canEdit: permissionModal.form.canEdit,
                canUse: permissionModal.form.canUse
            });
            const map = unwrapResponse(updated);
            setPermissionModal((prev) => ({
                ...prev,
                map,
                form: buildPermissionForm(map, prev.role)
            }));
            toast.success('Permissions saved');
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Unable to save permissions');
        } finally {
            setSavingPermissions(false);
        }
    };

    return (
        <div className="kodi-portal">
            <header className="kodi-portal__header">
                <div className="kodi-page-header">
                    <button className="kodi-back-button" onClick={() => navigate('/kodi/times')}>
                        ← Back
                    </button>
                    <div>
                    <p className="kodi-portal__eyebrow">Kodi Portal</p>
                    <h1>App Manager</h1>
                    </div>
                </div>
                <button className="btn-primary" onClick={() => setCreateModalOpen(true)}>
                    + Create App
                </button>
            </header>

            <section className="kodi-portal__grid">
                {loadingApps ? (
                    <div className="kodi-portal__loader">
                        <Loading />
                    </div>
                ) : apps.length === 0 ? (
                    <div className="kodi-portal__empty">
                        <p>No Kodi apps have been created yet.</p>
                        <button className="btn-text" onClick={() => setCreateModalOpen(true)}>
                            + Create your first app
                        </button>
                    </div>
                ) : (
                    apps.map((app) => (
                        <article key={app.id} className="kodi-portal__card">
                            <div className="kodi-portal__card-header">
                                <div>
                                    <h2>{app.name}</h2>
                                    <p>{app.description || 'No description provided.'}</p>
                                </div>
                                <div className="kodi-portal__card-actions">
                                    <button className="btn-text" onClick={() => openEditAppModal(app)}>
                                        Edit App
                                    </button>
                                    <button className="btn-text" onClick={() => openLinkModal(app)}>
                                        Link Page
                                    </button>
                                </div>
                            </div>
                            <div className="kodi-portal__card-status">
                                <span>{(app.linked_pages || []).length} linked page(s)</span>
                                <span className="kodi-portal__status-pill">
                                    {app.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div className="kodi-portal__linked-pages">
                                <h3>Linked Pages</h3>
                                {app.linked_pages?.length ? (
                                    app.linked_pages.map((page) => (
                                        <div key={page.id} className="kodi-portal__linked-row">
                                            <div>
                                                <strong>{page.label}</strong>
                                                <span>{page.page_type}</span>
                                            </div>
                                            <div className="kodi-portal__linked-actions">
                                                <span className="kodi-portal__status-chip">{page.status}</span>
                                                <button className="btn-text" onClick={() => openPermissionModal(page)}>
                                                    Assign role
                                                </button>
                                                <button className="btn-text" onClick={() => openAssignPageUserModal(page)}>
                                                    Assign user
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="kodi-portal__empty-state">No pages linked yet.</p>
                                )}
                            </div>
                            <div className="kodi-portal__assigned-users">
                                <h3>Assigned Users</h3>
                                {app.assigned_users?.length ? (
                                    app.assigned_users.slice(0, 3).map((user) => (
                                        <div key={user.id} className="kodi-portal__assigned-row">
                                            <div>
                                                <strong>{user.display_name || user.email}</strong>
                                                <span>{user.role_key || user.role || 'role not set'}</span>
                                            </div>
                                            <span className="kodi-portal__status-chip">Invite sent</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="kodi-portal__empty-state">No users assigned yet.</p>
                                )}
                                <button className="btn-text" onClick={() => openAssignUserModal(app)}>
                                    Assign user
                                </button>
                            </div>
                        </article>
                    ))
                )}
            </section>

            <section className="kodi-portal__objects">
                <header className="kodi-portal__section-header">
                    <h2>CRM Objects</h2>
                    <p>Structured metadata available for builder components</p>
                </header>
                {loadingObjects ? (
                    <div className="kodi-portal__loader">
                        <Loading />
                    </div>
                ) : (
                    <div className="kodi-portal__object-grid">
                        {objects.map((object) => (
                            <article key={object.id} className="kodi-portal__object-card">
                                <div className="kodi-portal__card-header">
                                    <div>
                                        <h3>{object.label}</h3>
                                        <p>{object.description || 'No description available.'}</p>
                                    </div>
                                    <button className="btn-text" onClick={() => openFieldModal(object)}>
                                        + Add field
                                    </button>
                                </div>
                                <div className="kodi-portal__object-fields">
                                    {(object.fields || []).map((field) => (
                                        <span key={field.id} className="kodi-portal__object-chip">
                                            {field.field_name} ({field.field_type})
                                        </span>
                                    ))}
                                    {!object.fields?.length && (
                                        <p className="kodi-portal__empty-state">No fields defined.</p>
                                    )}
                                </div>
                            </article>
                        ))}
                        {!objects.length && !loadingObjects && (
                            <div className="kodi-portal__empty">
                                <p>No metadata objects available.</p>
                            </div>
                        )}
                    </div>
                )}
            </section>

            <section className="kodi-portal__neon-section">
                <header className="kodi-portal__section-header">
                    <h2>Neon Data API</h2>
                    <p>Query the configured Neon REST endpoint directly for live table data.</p>
                </header>
                <div className="kodi-portal__neon-controls">
                    <label>
                        Table
                        <select value={neonTable} onChange={(e) => setNeonTable(e.target.value)}>
                            <option value="contacts">contacts</option>
                            <option value="businesses">businesses</option>
                            <option value="subscriptions">subscriptions</option>
                        </select>
                    </label>
                    <button className="btn-primary" onClick={handleFetchNeonTable} disabled={neonLoading}>
                        {neonLoading ? 'Querying…' : 'Fetch data'}
                    </button>
                </div>
                {neonError && <p className="kodi-portal__neon-error">{neonError}</p>}
                {neonRecords.length > 0 && (
                    <div className="kodi-portal__neon-table">
                        <div className="kodi-portal__neon-table-head">
                            {(Object.keys(neonRecords[0]).slice(0, 4) || []).map((column) => (
                                <span key={column}>{column}</span>
                            ))}
                        </div>
                        {neonRecords.map((record, index) => (
                            <div key={`${record.id || index}`} className="kodi-portal__neon-table-row">
                                {Object.entries(record)
                                    .slice(0, 4)
                                    .map(([column, value]) => (
                                        <span key={`${index}-${column}`}>
                                            {typeof value === 'object' ? JSON.stringify(value) : value ?? '—'}
                                        </span>
                                    ))}
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="kodi-portal__leads">
                <header className="kodi-portal__section-header">
                    <h2>Leads & Opportunities</h2>
                    <button className="btn-primary" onClick={openLeadModal}>
                        + Create Lead
                    </button>
                </header>
                {loadingLeads ? (
                    <div className="kodi-portal__loader">
                        <Loading />
                    </div>
                ) : leads.length ? (
                    <div className="kodi-portal__lead-grid">
                        {leads.map((lead) => (
                            <article key={lead.id} className="kodi-portal__lead-card">
                                <div>
                                    <h3>{lead.name}</h3>
                                    <p>{lead.email || 'Email not provided'}</p>
                                    <p>Application: {lead.application_status || 'incomplete'}</p>
                                    <p>Source: {lead.source || 'manual'}</p>
                                </div>
                                <div className="kodi-portal__lead-actions">
                                    <span className="kodi-portal__status-chip">{lead.status || 'incomplete'}</span>
                                    {(leadOpportunities[lead.id] || []).length > 0 && (
                                        <span className="kodi-portal__status-chip">
                                            Stage: {leadOpportunities[lead.id][0]?.stage || 'prospecting'}
                                        </span>
                                    )}
                                    {lead.status !== 'converted' && (
                                        <button className="btn-text" onClick={() => handleConvertLead(lead.id)}>
                                            Convert
                                        </button>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="kodi-portal__empty">
                        <p>No leads yet. Create one to track applications.</p>
                    </div>
                )}
            </section>

            {createModalOpen && (
                <div className="kodi-portal__modal">
                    <div className="kodi-portal__modal-content">
                        <div className="kodi-portal__modal-header">
                            <h2>Create Kodi App</h2>
                            <button className="btn-text" onClick={() => setCreateModalOpen(false)}>
                                Close
                            </button>
                        </div>
                        <form className="kodi-portal__form" onSubmit={handleCreateApp}>
                            <label>
                                App name
                                <input
                                    type="text"
                                    value={appForm.name}
                                    onChange={(event) => setAppForm((prev) => ({ ...prev, name: event.target.value }))}
                                    placeholder="Product Support App"
                                />
                            </label>
                            <label>
                                Description
                                <textarea
                                    value={appForm.description}
                                    onChange={(event) =>
                                        setAppForm((prev) => ({ ...prev, description: event.target.value }))
                                    }
                                    placeholder="Describe what the app surfaces"
                                />
                            </label>
                            <button className="btn-primary" type="submit" disabled={creatingApp}>
                                {creatingApp ? 'Creating...' : 'Create App'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {linkModal.open && linkModal.app && (
                <div className="kodi-portal__modal">
                    <div className="kodi-portal__modal-content">
                        <div className="kodi-portal__modal-header">
                            <h2>Link page to {linkModal.app.name}</h2>
                            <button className="btn-text" onClick={() => setLinkModal({ open: false, app: null, pageId: '' })}>
                                Close
                            </button>
                        </div>
                        <div className="kodi-portal__form">
                            <label>
                                Select page
                                <select
                                    value={linkModal.pageId}
                                    onChange={(event) =>
                                        setLinkModal((prev) => ({ ...prev, pageId: event.target.value }))
                                    }
                                >
                                    <option value="">-- Choose a page --</option>
                                    {availablePagesForApp(linkModal.app).map((page) => (
                                        <option key={page.id} value={page.id}>
                                            {page.label} ({page.status})
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <button className="btn-primary" onClick={handleLinkPage} disabled={linking}>
                                {linking ? 'Linking...' : 'Link Page'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editAppModal.open && editAppModal.app && (
                <div className="kodi-portal__modal">
                    <div className="kodi-portal__modal-content">
                        <div className="kodi-portal__modal-header">
                            <h2>Edit {editAppModal.app.name}</h2>
                            <button className="btn-text" onClick={() => setEditAppModal({ open: false, app: null })}>
                                Close
                            </button>
                        </div>
                        <form className="kodi-portal__form" onSubmit={handleUpdateApp}>
                            <label>
                                App name
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                                />
                            </label>
                            <label>
                                Description
                                <textarea
                                    rows="3"
                                    value={editForm.description}
                                    onChange={(event) =>
                                        setEditForm((prev) => ({ ...prev, description: event.target.value }))
                                    }
                                />
                            </label>
                            <label className="kodi-portal__checkbox">
                                <input
                                    type="checkbox"
                                    checked={editForm.isActive}
                                    onChange={() => setEditForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
                                />
                                App is active
                            </label>
                            <button className="btn-primary" type="submit" disabled={savingApp}>
                                {savingApp ? 'Saving...' : 'Save changes'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {permissionModal.open && permissionModal.page && (
                <div className="kodi-portal__modal">
                    <div className="kodi-portal__modal-content">
                        <div className="kodi-portal__modal-header">
                            <h2>Assign role for {permissionModal.page.label}</h2>
                            <button
                                className="btn-text"
                                onClick={() =>
                                    setPermissionModal({
                                        open: false,
                                        page: null,
                                        role: PLATFORM_ROLES[0],
                                        map: {},
                                        form: { canView: false, canEdit: false, canUse: false }
                                    })
                                }
                            >
                                Close
                            </button>
                        </div>
                        <div className="kodi-portal__form">
                            <label>
                                Role
                                <select value={permissionModal.role} onChange={(event) => handlePermissionRoleChange(event.target.value)}>
                                    {PLATFORM_ROLES.map((role) => (
                                        <option key={role} value={role}>
                                            {role.charAt(0).toUpperCase() + role.slice(1)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <div className="kodi-portal__checkbox-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={permissionModal.form.canView}
                                        onChange={() => togglePermission('canView')}
                                    />
                                    Can view
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={permissionModal.form.canEdit}
                                        onChange={() => togglePermission('canEdit')}
                                    />
                                    Can edit
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={permissionModal.form.canUse}
                                        onChange={() => togglePermission('canUse')}
                                    />
                                    Can use
                                </label>
                            </div>
                            <button className="btn-primary" onClick={handleSavePermissions} disabled={savingPermissions}>
                                {savingPermissions ? 'Saving...' : 'Save permissions'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {assignUserModal.open && assignUserModal.app && (
                <div className="kodi-portal__modal">
                    <div className="kodi-portal__modal-content">
                        <div className="kodi-portal__modal-header">
                            <h2>Assign user to {assignUserModal.app.name}</h2>
                            <button
                                className="btn-text"
                                onClick={() =>
                                    setAssignUserModal({
                                        open: false,
                                        app: null,
                                        email: '',
                                        roleKey: 'employee',
                                        permissions: { canView: true, canEdit: false, canUse: false },
                                        assigning: false
                                    })
                                }
                            >
                                Close
                            </button>
                        </div>
                        <div className="kodi-portal__form">
                            <label>
                                User email
                                <input
                                    type="email"
                                    value={assignUserModal.email}
                                    onChange={(event) => setAssignUserModal((prev) => ({ ...prev, email: event.target.value }))}
                                    placeholder="user@example.com"
                                />
                            </label>
                            <label>
                                App role
                                <select
                                    value={assignUserModal.roleKey}
                                    onChange={(event) =>
                                        setAssignUserModal((prev) => ({ ...prev, roleKey: event.target.value }))
                                    }
                                >
                                    {PLATFORM_ROLES.map((role) => (
                                        <option key={role} value={role}>
                                            {role}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <div className="kodi-portal__checkbox-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={assignUserModal.permissions.canView}
                                        onChange={() => toggleAssignPermission('canView')}
                                    />
                                    Can view
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={assignUserModal.permissions.canEdit}
                                        onChange={() => toggleAssignPermission('canEdit')}
                                    />
                                    Can edit
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={assignUserModal.permissions.canUse}
                                        onChange={() => toggleAssignPermission('canUse')}
                                    />
                                    Can use
                                </label>
                            </div>
                            <button className="btn-primary" onClick={handleAssignUser} disabled={assignUserModal.assigning}>
                                {assignUserModal.assigning ? 'Assigning...' : 'Assign user'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {assignPageUserModal.open && assignPageUserModal.page && (
                <div className="kodi-portal__modal">
                    <div className="kodi-portal__modal-content">
                        <div className="kodi-portal__modal-header">
                            <h2>Assign user to {assignPageUserModal.page.label}</h2>
                            <button
                                className="btn-text"
                                onClick={() =>
                                    setAssignPageUserModal({
                                        open: false,
                                        page: null,
                                        email: '',
                                        permissions: { canView: true, canEdit: false, canUse: false },
                                        assigning: false
                                    })
                                }
                            >
                                Close
                            </button>
                        </div>
                        <div className="kodi-portal__form">
                            <label>
                                User email
                                <input
                                    type="email"
                                    value={assignPageUserModal.email}
                                    onChange={(event) => setAssignPageUserModal((prev) => ({ ...prev, email: event.target.value }))}
                                    placeholder="user@example.com"
                                />
                            </label>
                            <div className="kodi-portal__checkbox-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={assignPageUserModal.permissions.canView}
                                        onChange={() =>
                                            setAssignPageUserModal((prev) => ({
                                                ...prev,
                                                permissions: { ...prev.permissions, canView: !prev.permissions.canView }
                                            }))
                                        }
                                    />
                                    Can view
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={assignPageUserModal.permissions.canEdit}
                                        onChange={() =>
                                            setAssignPageUserModal((prev) => ({
                                                ...prev,
                                                permissions: { ...prev.permissions, canEdit: !prev.permissions.canEdit }
                                            }))
                                        }
                                    />
                                    Can edit
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={assignPageUserModal.permissions.canUse}
                                        onChange={() =>
                                            setAssignPageUserModal((prev) => ({
                                                ...prev,
                                                permissions: { ...prev.permissions, canUse: !prev.permissions.canUse }
                                            }))
                                        }
                                    />
                                    Can use
                                </label>
                            </div>
                            <button className="btn-primary" onClick={handleAssignPageUser} disabled={assignPageUserModal.assigning}>
                                {assignPageUserModal.assigning ? 'Assigning...' : 'Assign user'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {fieldModal.open && fieldModal.object && (
                <div className="kodi-portal__modal">
                    <div className="kodi-portal__modal-content">
                        <div className="kodi-portal__modal-header">
                            <h2>Add field to {fieldModal.object.label}</h2>
                            <button
                                className="btn-text"
                                onClick={() =>
                                    setFieldModal({
                                        open: false,
                                        object: null,
                                        form: { fieldName: '', fieldType: 'string', isRequired: false, isReadonly: false },
                                        saving: false
                                    })
                                }
                            >
                                Close
                            </button>
                        </div>
                        <div className="kodi-portal__form">
                            <label>
                                Field name
                                <input
                                    type="text"
                                    value={fieldModal.form.fieldName}
                                    onChange={(event) =>
                                        setFieldModal((prev) => ({
                                            ...prev,
                                            form: { ...prev.form, fieldName: event.target.value }
                                        }))
                                    }
                                />
                            </label>
                            <label>
                                Field type
                                <select
                                    value={fieldModal.form.fieldType}
                                    onChange={(event) =>
                                        setFieldModal((prev) => ({
                                            ...prev,
                                            form: { ...prev.form, fieldType: event.target.value }
                                        }))
                                    }
                                >
                                    <option value="string">String</option>
                                    <option value="number">Number</option>
                                    <option value="boolean">Boolean</option>
                                    <option value="date">Date</option>
                                </select>
                            </label>
                            <div className="kodi-portal__checkbox-group">
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={fieldModal.form.isRequired}
                                        onChange={() =>
                                            setFieldModal((prev) => ({
                                                ...prev,
                                                form: { ...prev.form, isRequired: !prev.form.isRequired }
                                            }))
                                        }
                                    />
                                    Required
                                </label>
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={fieldModal.form.isReadonly}
                                        onChange={() =>
                                            setFieldModal((prev) => ({
                                                ...prev,
                                                form: { ...prev.form, isReadonly: !prev.form.isReadonly }
                                            }))
                                        }
                                    />
                                    Read-only
                                </label>
                            </div>
                            <button className="btn-primary" onClick={handleFieldSave} disabled={fieldModal.saving}>
                                {fieldModal.saving ? 'Saving...' : 'Save field'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {leadModal.open && (
                <div className="kodi-portal__modal">
                    <div className="kodi-portal__modal-content">
                        <div className="kodi-portal__modal-header">
                            <h2>Create lead</h2>
                            <button className="btn-text" onClick={() => setLeadModal({ open: false, name: '', email: '', creating: false })}>
                                Close
                            </button>
                        </div>
                        <form className="kodi-portal__form" onSubmit={handleLeadCreate}>
                            <label>
                                Lead name
                                <input
                                    type="text"
                                    value={leadModal.name}
                                    onChange={(event) => setLeadModal((prev) => ({ ...prev, name: event.target.value }))}
                                />
                            </label>
                            <label>
                                Email
                                <input
                                    type="email"
                                    value={leadModal.email}
                                    onChange={(event) => setLeadModal((prev) => ({ ...prev, email: event.target.value }))}
                                />
                            </label>
                            <button className="btn-primary" type="submit" disabled={leadModal.creating}>
                                {leadModal.creating ? 'Creating...' : 'Create lead'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KodiPortal;
