import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { createFlow, deleteFlow, fetchFlows, updateFlow } from '../../services/flowService';
import './FlowAdmin.css';

const getLifecycleMode = (flow) => {
    const mode = flow?.definition?.meta?.lifecycle?.mode;
    return mode === 'published' ? 'Published' : 'Draft';
};

const getTypeLabel = (type) => {
    const normalized = String(type || '').toLowerCase();
    if (normalized === 'screen') return 'Screen Flow';
    return 'Trigger Flow';
};

const formatUpdatedAt = (value) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString();
    } catch {
        return '—';
    }
};

const FlowAdmin = () => {
    const { user } = useAuth();
    const userRole = String(user?.role || '').toLowerCase();
    const canEdit = ['admin', 'super_admin'].includes(userRole);
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [flows, setFlows] = useState([]);
    const [createOpen, setCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: '',
        description: '',
        type: 'trigger'
    });

    const sortedFlows = useMemo(() => {
        return [...flows].sort((a, b) => {
            const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return bTime - aTime;
        });
    }, [flows]);

    const load = async () => {
        if (!canEdit) return;
        setLoading(true);
        try {
            const { data } = await fetchFlows();
            setFlows(data?.data || []);
        } catch (error) {
            console.error('Failed to load flows', error);
            toast.error('Unable to load flows');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [canEdit]);

    const handleCreate = async (event) => {
        event.preventDefault();
        const name = createForm.name.trim();
        if (!name) return;
        try {
            const payload = {
                name,
                description: createForm.description?.trim() || null,
                type: createForm.type,
                isActive: false,
                definition: {
                    version: 2,
                    meta: { lifecycle: { mode: 'draft' } },
                    nodes: [],
                    startNodeId: null,
                    ui: { nodes: {}, viewport: { x: 0, y: 0, zoom: 1 } }
                }
            };
            const { data } = await createFlow(payload);
            const flow = data?.data;
            toast.success('Flow created');
            setCreateOpen(false);
            setCreateForm({ name: '', description: '', type: 'trigger' });
            await load();
            if (flow?.id) {
                navigate(`/admin/flows/${flow.id}/builder`);
            }
        } catch (error) {
            console.error('Failed to create flow', error);
            toast.error('Unable to create flow');
        }
    };

    const handleDelete = async (flow) => {
        const confirmed = window.confirm(`Delete flow "${flow.name}"?`);
        if (!confirmed) return;
        try {
            await deleteFlow(flow.id);
            toast.success('Flow deleted');
            await load();
        } catch (error) {
            console.error('Failed to delete flow', error);
            toast.error('Unable to delete flow');
        }
    };

    const handleDuplicate = async (flow) => {
        try {
            const { data } = await createFlow({
                name: `${flow.name} (Copy)`,
                description: flow.description || null,
                type: flow.type,
                isActive: false,
                definition: flow.definition || {}
            });
            const created = data?.data;
            toast.success('Flow duplicated');
            await load();
            if (created?.id) {
                navigate(`/admin/flows/${created.id}/builder`);
            }
        } catch (error) {
            console.error('Failed to duplicate flow', error);
            toast.error('Unable to duplicate flow');
        }
    };

    const handleToggleActive = async (flow) => {
        try {
            const { data } = await updateFlow(flow.id, { isActive: !flow.isActive });
            const updated = data?.data;
            setFlows((prev) => prev.map((item) => (item.id === flow.id ? updated : item)));
        } catch (error) {
            console.error('Failed to toggle flow', error);
            toast.error('Unable to update flow');
        }
    };

    if (!canEdit) {
        return (
            <div className="flow-admin-page">
                <h2>Flow Management</h2>
                <p>You do not have permission to manage flows.</p>
            </div>
        );
    }

    return (
        <div className="flow-admin-page">
            <div className="flow-admin-header">
                <div>
                    <h2>Flow Management</h2>
                    <p>Create and manage no-code automation flows.</p>
                </div>
                <div className="flow-admin-header-actions">
                    <button className="primary" type="button" onClick={() => setCreateOpen(true)}>
                        Add Flow
                    </button>
                    <button type="button" className="secondary" onClick={load} disabled={loading}>
                        Refresh
                    </button>
                </div>
            </div>

            <div className="flow-admin-table-wrap">
                <table className="flow-admin-table">
                    <thead>
                        <tr>
                            <th>Flow Name</th>
                            <th>Flow Type</th>
                            <th>Status</th>
                            <th>Last Updated</th>
                            <th>Created By</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        {sortedFlows.map((flow) => (
                            <tr key={flow.id}>
                                <td>
                                    <div className="flow-admin-name">{flow.name}</div>
                                    <div className="flow-admin-desc">{flow.description || '—'}</div>
                                </td>
                                <td>{getTypeLabel(flow.type)}</td>
                                <td>
                                    <div className="flow-admin-status">
                                        <span className={`badge badge-${getLifecycleMode(flow).toLowerCase()}`}>
                                            {getLifecycleMode(flow)}
                                        </span>
                                        <button
                                            type="button"
                                            className={`toggle ${flow.isActive ? 'on' : 'off'}`}
                                            onClick={() => handleToggleActive(flow)}
                                        >
                                            {flow.isActive ? 'Active' : 'Inactive'}
                                        </button>
                                    </div>
                                </td>
                                <td>{formatUpdatedAt(flow.updatedAt)}</td>
                                <td>{flow.createdBy || '—'}</td>
                                <td className="flow-admin-actions">
                                    <button
                                        type="button"
                                        className="secondary"
                                        onClick={() => navigate(`/admin/flows/${flow.id}/builder`)}
                                    >
                                        Edit
                                    </button>
                                    <button type="button" className="secondary" onClick={() => handleDuplicate(flow)}>
                                        Duplicate
                                    </button>
                                    <button type="button" className="danger" onClick={() => handleDelete(flow)}>
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {sortedFlows.length === 0 && (
                            <tr>
                                <td colSpan={6} className="flow-admin-empty">
                                    {loading ? 'Loading…' : 'No flows yet. Click “Add Flow” to create one.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {createOpen && (
                <div className="flow-admin-modal-backdrop" role="presentation" onClick={() => setCreateOpen(false)}>
                    <div className="flow-admin-modal" role="presentation" onClick={(e) => e.stopPropagation()}>
                        <div className="flow-admin-modal-header">
                            <h3>Add Flow</h3>
                            <button type="button" className="icon" onClick={() => setCreateOpen(false)}>
                                ×
                            </button>
                        </div>
                        <form className="flow-admin-modal-body" onSubmit={handleCreate}>
                            <label>
                                Flow Name
                                <input
                                    value={createForm.name}
                                    onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                                    placeholder="User onboarding"
                                    required
                                />
                            </label>
                            <label>
                                Flow Description
                                <textarea
                                    value={createForm.description}
                                    onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                                    placeholder="What does this flow automate?"
                                    rows={3}
                                />
                            </label>
                            <label>
                                Flow Type
                                <select
                                    value={createForm.type}
                                    onChange={(e) => setCreateForm((p) => ({ ...p, type: e.target.value }))}
                                >
                                    <option value="trigger">Trigger</option>
                                    <option value="screen">Screen</option>
                                </select>
                            </label>
                            <div className="flow-admin-modal-actions">
                                <button type="button" className="secondary" onClick={() => setCreateOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="primary">
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FlowAdmin;
