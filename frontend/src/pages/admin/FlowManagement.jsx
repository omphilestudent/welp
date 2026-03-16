import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import {
    fetchFlows,
    createFlow,
    updateFlow,
    deleteFlow,
    executeFlow,
    fetchFlowLogs,
    fetchFlowEvents,
    fetchFlowTriggers,
    createFlowTrigger,
    updateFlowTrigger,
    deleteFlowTrigger,
    fetchFlowVersions,
    rollbackFlowVersion,
    fetchFlowComponents,
    createFlowComponent,
    updateFlowComponent,
    deleteFlowComponent,
    fetchFlowAnalytics
} from '../../services/flowService';
import { startFlowSession, submitFlowSession } from '../../services/flowRuntimeService';
import './FlowManagement.css';

const INITIAL_PREVIEW_STATE = {
    open: false,
    loading: false,
    flow: null,
    sessionId: null,
    node: null,
    status: 'idle',
    summary: null,
    errors: null
};

const DEFAULT_DEFINITION = {
    version: 1,
    actions: [
        {
            id: 'action-1',
            type: 'log',
            message: 'Flow executed for {{email}}'
        }
    ]
};

const DEFAULT_TRIGGER_FORM = {
    id: null,
    flowId: '',
    eventName: '',
    conditionsText: JSON.stringify({ match: {} }, null, 2),
    isActive: true
};

const FlowManagement = () => {
    const { user } = useAuth();
    const userRole = String(user?.role || '').toLowerCase();
    const canEditFlows = ['super_admin', 'admin'].includes(userRole);

    const [flows, setFlows] = useState([]);
    const [selectedFlowId, setSelectedFlowId] = useState(null);
    const [flowLogs, setFlowLogs] = useState([]);
    const [events, setEvents] = useState([]);
    const [triggers, setTriggers] = useState([]);
    const [loading, setLoading] = useState({
        flows: false,
        savingFlow: false,
        runningFlow: false,
        triggers: false
    });
    const [flowForm, setFlowForm] = useState({
        id: null,
        name: '',
        description: '',
        type: 'trigger',
        isActive: true,
        definitionText: JSON.stringify(DEFAULT_DEFINITION, null, 2)
    });
    const [triggerForm, setTriggerForm] = useState(DEFAULT_TRIGGER_FORM);
    const [previewState, setPreviewState] = useState(INITIAL_PREVIEW_STATE);
    const [versions, setVersions] = useState([]);
    const [versionsLoading, setVersionsLoading] = useState(false);
    const [analytics, setAnalytics] = useState([]);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [components, setComponents] = useState([]);
    const [componentLoading, setComponentLoading] = useState(false);
    const [componentSaving, setComponentSaving] = useState(false);
    const [componentForm, setComponentForm] = useState({
        id: null,
        name: '',
        type: 'screen',
        description: '',
        configText: JSON.stringify({ title: 'Reusable Screen', type: 'screen', inputs: [] }, null, 2),
        isShared: true
    });

    useEffect(() => {
        if (!canEditFlows) return;
        loadFlows();
        loadEvents();
        loadTriggers();
        loadComponents();
    }, [canEditFlows]);

    useEffect(() => {
        if (!canEditFlows) return;
        if (selectedFlowId) {
            loadLogs(selectedFlowId);
            loadVersions(selectedFlowId);
            loadAnalytics(selectedFlowId);
        } else {
            setFlowLogs([]);
            setVersions([]);
            setAnalytics([]);
        }
    }, [selectedFlowId, canEditFlows]);

    const selectedFlow = useMemo(
        () => flows.find((flow) => flow.id === selectedFlowId) || null,
        [flows, selectedFlowId]
    );

    const loadFlows = async () => {
        try {
            setLoading((prev) => ({ ...prev, flows: true }));
            const { data } = await fetchFlows();
            const rows = Array.isArray(data?.data) ? data.data : [];
            setFlows(rows);
            if (!selectedFlowId && rows.length) {
                hydrateForm(rows[0]);
            }
        } catch (error) {
            console.error('Failed to load flows', error);
            toast.error('Unable to load flows');
        } finally {
            setLoading((prev) => ({ ...prev, flows: false }));
        }
    };

    const loadEvents = async () => {
        try {
            const { data } = await fetchFlowEvents();
            setEvents(Array.isArray(data?.events) ? data.events : []);
        } catch (error) {
            console.error('Failed to load events', error);
        }
    };

    const loadTriggers = async () => {
        try {
            setLoading((prev) => ({ ...prev, triggers: true }));
            const { data } = await fetchFlowTriggers();
            setTriggers(Array.isArray(data?.data) ? data.data : []);
        } catch (error) {
            console.error('Failed to load triggers', error);
            toast.error('Unable to load triggers');
        } finally {
            setLoading((prev) => ({ ...prev, triggers: false }));
        }
    };

    const loadLogs = async (flowId) => {
        try {
            const { data } = await fetchFlowLogs(flowId, { limit: 10 });
            setFlowLogs(Array.isArray(data?.data) ? data.data : []);
        } catch (error) {
            console.error('Failed to load flow logs', error);
        }
    };

    const loadVersions = async (flowId) => {
        setVersionsLoading(true);
        try {
            const { data } = await fetchFlowVersions(flowId);
            setVersions(Array.isArray(data?.data) ? data.data : []);
        } catch (error) {
            console.error('Failed to load flow versions', error);
            toast.error('Unable to load versions');
        } finally {
            setVersionsLoading(false);
        }
    };

    const loadAnalytics = async (flowId) => {
        setAnalyticsLoading(true);
        try {
            const { data } = await fetchFlowAnalytics(flowId, { days: 30 });
            setAnalytics(Array.isArray(data?.data) ? data.data : []);
        } catch (error) {
            console.error('Failed to load analytics', error);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const loadComponents = async () => {
        setComponentLoading(true);
        try {
            const { data } = await fetchFlowComponents();
            setComponents(Array.isArray(data?.data) ? data.data : []);
        } catch (error) {
            console.error('Failed to load components', error);
            toast.error('Unable to load components');
        } finally {
            setComponentLoading(false);
        }
    };

    const resetComponentForm = () => {
        setComponentForm({
            id: null,
            name: '',
            type: 'screen',
            description: '',
            configText: JSON.stringify({ title: 'Reusable Screen', type: 'screen', inputs: [] }, null, 2),
            isShared: true
        });
    };

    const handleComponentFieldChange = (field, value) => {
        setComponentForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleComponentSave = async () => {
        setComponentSaving(true);
        try {
            const config = JSON.parse(componentForm.configText || '{}');
            if (componentForm.id) {
                await updateFlowComponent(componentForm.id, {
                    name: componentForm.name,
                    description: componentForm.description,
                    type: componentForm.type,
                    config,
                    isShared: componentForm.isShared
                });
                toast.success('Component updated');
            } else {
                await createFlowComponent({
                    name: componentForm.name,
                    description: componentForm.description,
                    type: componentForm.type,
                    config,
                    isShared: componentForm.isShared
                });
                toast.success('Component created');
            }
            resetComponentForm();
            await loadComponents();
        } catch (error) {
            if (error instanceof SyntaxError) {
                toast.error('Component config must be valid JSON');
            } else {
                console.error('Failed to save component', error);
                toast.error(error.response?.data?.error || 'Unable to save component');
            }
        } finally {
            setComponentSaving(false);
        }
    };

    const handleComponentEdit = (component) => {
        setComponentForm({
            id: component.id,
            name: component.name,
            type: component.type,
            description: component.description || '',
            configText: JSON.stringify(component.config || {}, null, 2),
            isShared: component.isShared
        });
    };

    const handleComponentDelete = async (componentId) => {
        if (!window.confirm('Delete this component?')) return;
        try {
            await deleteFlowComponent(componentId);
            toast.success('Component deleted');
            await loadComponents();
            resetComponentForm();
        } catch (error) {
            console.error('Failed to delete component', error);
            toast.error(error.response?.data?.error || 'Unable to delete component');
        }
    };

    const handleComponentInsert = (component) => {
        const snippet = JSON.stringify(component.config || {}, null, 2);
        setFlowForm((prev) => ({
            ...prev,
            definitionText: `${prev.definitionText}\n\n${snippet}`
        }));
        toast.success('Component snippet appended');
    };

    const analyticsTotals = useMemo(() => {
        if (!analytics.length) {
            return { executions: 0, successRate: 0, averageDuration: 0 };
        }
        const totals = analytics.reduce(
            (acc, row) => {
                acc.executions += Number(row.executions || 0);
                acc.success += Number(row.success_count || 0);
                acc.failure += Number(row.failure_count || 0);
                acc.avgDuration += Number(row.avg_duration_seconds || 0);
                return acc;
            },
            { executions: 0, success: 0, failure: 0, avgDuration: 0 }
        );
        return {
            executions: totals.executions,
            successRate: totals.executions ? Math.round((totals.success / totals.executions) * 100) : 0,
            averageDuration: analytics.length ? (totals.avgDuration / analytics.length).toFixed(1) : 0
        };
    }, [analytics]);

    const hydrateForm = (flow) => {
        if (!flow) {
            setSelectedFlowId(null);
            setFlowForm({
                id: null,
                name: '',
                description: '',
                type: 'trigger',
                isActive: true,
                definitionText: JSON.stringify(DEFAULT_DEFINITION, null, 2)
            });
            return;
        }
        setSelectedFlowId(flow.id);
        setFlowForm({
            id: flow.id,
            name: flow.name || '',
            description: flow.description || '',
            type: flow.type || 'trigger',
            isActive: flow.isActive !== false,
            definitionText: JSON.stringify(flow.definition || DEFAULT_DEFINITION, null, 2)
        });
    };

    const handleRollbackVersion = async (versionId) => {
        if (!selectedFlowId) return;
        if (!window.confirm('Rollback to this version?')) return;
        try {
            await rollbackFlowVersion(selectedFlowId, versionId);
            toast.success('Flow rolled back');
            await loadFlows();
            await loadVersions(selectedFlowId);
        } catch (error) {
            console.error('Failed to rollback version', error);
            toast.error(error.response?.data?.error || 'Unable to rollback flow');
        }
    };

    const closePreview = () => setPreviewState({ ...INITIAL_PREVIEW_STATE });

    const openPreview = async (flow) => {
        if (!flow) return;
        setPreviewState({
            ...INITIAL_PREVIEW_STATE,
            open: true,
            loading: true,
            flow
        });
        try {
            const { data } = await startFlowSession(flow.id, { preview: true });
            const payload = data?.data || {};
            setPreviewState((prev) => ({
                ...prev,
                loading: false,
                sessionId: payload.sessionId,
                node: payload.node,
                status: payload.status,
                summary: null,
                errors: null
            }));
        } catch (error) {
            console.error('Failed to start flow preview', error);
            toast.error(error.response?.data?.error || 'Unable to start preview');
            closePreview();
        }
    };

    const submitPreviewStep = async (answers) => {
        if (!previewState.sessionId || !previewState.flow) return;
        setPreviewState((prev) => ({
            ...prev,
            loading: true,
            errors: null
        }));
        try {
            const { data } = await submitFlowSession(previewState.flow.id, previewState.sessionId, { answers });
            const payload = data?.data || {};
            if (payload.status === 'completed') {
                setPreviewState((prev) => ({
                    ...prev,
                    loading: false,
                    status: 'completed',
                    summary: payload.context || {},
                    node: null
                }));
            } else {
                setPreviewState((prev) => ({
                    ...prev,
                    loading: false,
                    status: payload.status,
                    node: payload.node || prev.node,
                    sessionId: payload.sessionId || prev.sessionId,
                    errors: null
                }));
            }
        } catch (error) {
            if (error.response?.status === 422) {
                setPreviewState((prev) => ({
                    ...prev,
                    loading: false,
                    errors: error.response?.data?.errors || [],
                    node: error.response?.data?.data?.node || prev.node,
                    sessionId: error.response?.data?.data?.sessionId || prev.sessionId
                }));
                return;
            }
            console.error('Failed to submit preview step', error);
            toast.error(error.response?.data?.error || 'Unable to submit step');
            setPreviewState((prev) => ({ ...prev, loading: false }));
        }
    };

    const restartPreview = () => {
        if (previewState.flow) {
            openPreview(previewState.flow);
        }
    };

    const handleFlowInput = (field, value) => {
        setFlowForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleFlowSubmit = async (event) => {
        event.preventDefault();
        try {
            const parsedDefinition = JSON.parse(flowForm.definitionText || '{}');
            setLoading((prev) => ({ ...prev, savingFlow: true }));
            if (flowForm.id) {
                await updateFlow(flowForm.id, {
                    name: flowForm.name,
                    description: flowForm.description,
                    type: flowForm.type,
                    isActive: flowForm.isActive,
                    definition: parsedDefinition
                });
                toast.success('Flow updated');
            } else {
                await createFlow({
                    name: flowForm.name,
                    description: flowForm.description,
                    type: flowForm.type,
                    isActive: flowForm.isActive,
                    definition: parsedDefinition
                });
                toast.success('Flow created');
            }
            await loadFlows();
        } catch (error) {
            console.error('Failed to save flow', error);
            if (error instanceof SyntaxError) {
                toast.error('Flow definition must be valid JSON');
            } else {
                toast.error(error?.response?.data?.error || 'Failed to save flow');
            }
        } finally {
            setLoading((prev) => ({ ...prev, savingFlow: false }));
        }
    };

    const handleFlowDelete = async (flow) => {
        if (!flow) return;
        const confirmed = window.confirm(`Delete flow "${flow.name}"?`);
        if (!confirmed) return;
        try {
            await deleteFlow(flow.id);
            toast.success('Flow deleted');
            if (selectedFlowId === flow.id) {
                hydrateForm(null);
            }
            await loadFlows();
            await loadTriggers();
        } catch (error) {
            console.error('Failed to delete flow', error);
            toast.error('Unable to delete flow');
        }
    };

    const handleFlowRun = async (flow) => {
        if (!flow) return;
        try {
            setLoading((prev) => ({ ...prev, runningFlow: true }));
            await executeFlow(flow.id, {
                preview: true,
                requestedBy: 'admin-ui'
            });
            toast.success('Flow executed');
            await loadLogs(flow.id);
        } catch (error) {
            console.error('Failed to execute flow', error);
            toast.error(error?.response?.data?.error || 'Flow execution failed');
        } finally {
            setLoading((prev) => ({ ...prev, runningFlow: false }));
        }
    };

    const handleTriggerInput = (field, value) => {
        setTriggerForm((prev) => ({ ...prev, [field]: value }));
    };

    const resetTriggerForm = () => setTriggerForm(DEFAULT_TRIGGER_FORM);

    const handleTriggerEdit = (trigger) => {
        setTriggerForm({
            id: trigger.id,
            flowId: trigger.flowId || trigger.flow_id || trigger.flow?.id,
            eventName: trigger.eventName || trigger.event_name,
            conditionsText: JSON.stringify(trigger.conditions || { match: {} }, null, 2),
            isActive: trigger.isActive !== false
        });
    };

    const handleTriggerSubmit = async (event) => {
        event.preventDefault();
        let parsedConditions = {};
        if (triggerForm.conditionsText) {
            try {
                parsedConditions = JSON.parse(triggerForm.conditionsText);
            } catch (error) {
                toast.error('Trigger conditions must be valid JSON');
                return;
            }
        }
        if (!triggerForm.flowId || !triggerForm.eventName) {
            toast.error('Select a flow and event');
            return;
        }
        try {
            if (triggerForm.id) {
                await updateFlowTrigger(triggerForm.id, {
                    flowId: triggerForm.flowId,
                    eventName: triggerForm.eventName,
                    conditions: parsedConditions,
                    isActive: triggerForm.isActive
                });
                toast.success('Trigger updated');
            } else {
                await createFlowTrigger({
                    flowId: triggerForm.flowId,
                    eventName: triggerForm.eventName,
                    conditions: parsedConditions,
                    isActive: triggerForm.isActive
                });
                toast.success('Trigger created');
            }
            resetTriggerForm();
            await loadTriggers();
        } catch (error) {
            console.error('Failed to save trigger', error);
            toast.error(error?.response?.data?.error || 'Unable to save trigger');
        }
    };

    const handleTriggerToggle = async (trigger) => {
        try {
            await updateFlowTrigger(trigger.id, { isActive: !trigger.isActive });
            await loadTriggers();
        } catch (error) {
            console.error('Failed to toggle trigger', error);
            toast.error('Unable to update trigger');
        }
    };

    const handleTriggerDelete = async (trigger) => {
        const confirmed = window.confirm('Delete this trigger?');
        if (!confirmed) return;
        try {
            await deleteFlowTrigger(trigger.id);
            await loadTriggers();
            toast.success('Trigger deleted');
        } catch (error) {
            console.error('Failed to delete trigger', error);
            toast.error('Unable to delete trigger');
        }
    };

    return (
        <div className="flow-management">
            <div className="flow-page-header">
                <h1>Automation Flows</h1>
                <p>
                    Create guided screen flows or trigger-based automations. Map events like signups or subscription
                    changes to flow actions and keep a full execution log.
                </p>
            </div>

            <div className="flow-panels">
                <section className="flow-panel">
                    <h2>Flows</h2>
                    <div className="flow-list">
                        {loading.flows && flows.length === 0 && <p>Loading flows…</p>}
                        {flows.map((flow) => (
                            <article
                                key={flow.id}
                                className={`flow-card ${selectedFlowId === flow.id ? 'active' : ''}`}
                            >
                                <div className="flow-card-details">
                                    <h3>{flow.name}</h3>
                                    <div className="flow-card-meta">
                                        <span>{flow.type === 'screen' ? 'Screen flow' : 'Trigger flow'}</span>
                                        <span>{flow.isActive ? 'Active' : 'Paused'}</span>
                                        <span>
                                            Updated {flow.updatedAt ? new Date(flow.updatedAt).toLocaleString() : '—'}
                                        </span>
                                    </div>
                                    <p>{flow.description}</p>
                                </div>
                                <div className="flow-card-actions">
                                    <button onClick={() => hydrateForm(flow)}>Edit</button>
                                    <button
                                        className="secondary"
                                        onClick={() => openPreview(flow)}
                                        disabled={previewState.loading && previewState.flow?.id === flow.id && previewState.open}
                                    >
                                        Preview
                                    </button>
                                    <button
                                        className="secondary"
                                        onClick={() => handleFlowRun(flow)}
                                        disabled={loading.runningFlow}
                                    >
                                        Run
                                    </button>
                                    <button className="danger" onClick={() => handleFlowDelete(flow)}>
                                        Delete
                                    </button>
                                </div>
                            </article>
                        ))}
                        {flows.length === 0 && !loading.flows && (
                            <div className="flow-card">
                                <div>
                                    <h3>No flows yet</h3>
                                    <p>Create your first flow using the editor on the right.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {selectedFlow && (
                        <div className="flow-logs">
                            <h3>Recent Executions</h3>
                            {flowLogs.length === 0 && <p>No executions recorded yet.</p>}
                            {flowLogs.map((log) => (
                                <div key={log.id} className="flow-log-entry">
                                    <strong>{log.status}</strong> •{' '}
                                    {new Date(log.started_at).toLocaleTimeString()} –{' '}
                                    {log.metadata?.actions?.length || 0} actions
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="flow-panel">
                    <h2>{flowForm.id ? 'Edit Flow' : 'Create Flow'}</h2>
                    <form className="flow-form" onSubmit={handleFlowSubmit}>
                        <div className="flow-form-row">
                            <label>
                                Name
                                <input
                                    type="text"
                                    value={flowForm.name}
                                    placeholder="Lifecycle welcome"
                                    onChange={(event) => handleFlowInput('name', event.target.value)}
                                    required
                                />
                            </label>
                            <label>
                                Type
                                <select
                                    value={flowForm.type}
                                    onChange={(event) => handleFlowInput('type', event.target.value)}
                                >
                                    <option value="trigger">Trigger</option>
                                    <option value="screen">Screen</option>
                                </select>
                            </label>
                            <label>
                                Status
                                <select
                                    value={flowForm.isActive ? 'active' : 'paused'}
                                    onChange={(event) => handleFlowInput('isActive', event.target.value === 'active')}
                                >
                                    <option value="active">Active</option>
                                    <option value="paused">Paused</option>
                                </select>
                            </label>
                        </div>

                        <label>
                            Description
                            <input
                                type="text"
                                value={flowForm.description}
                                placeholder="Describe what this flow automates"
                                onChange={(event) => handleFlowInput('description', event.target.value)}
                            />
                        </label>

                        <label>
                            Definition (JSON)
                            <textarea
                                value={flowForm.definitionText}
                                onChange={(event) => handleFlowInput('definitionText', event.target.value)}
                            />
                        </label>

                        <button type="submit" className="primary" disabled={loading.savingFlow}>
                            {flowForm.id ? 'Update Flow' : 'Create Flow'}
                        </button>
                    </form>
                </section>
            </div>

            <section className="flow-panel">
                <div className="flow-page-header">
                    <h2>Event Triggers & Actions</h2>
                    <p>Map platform events to the flows above. All trigger payloads accept JSON-based conditions.</p>
                </div>

                <div className="flow-form-row">
                    <div className="flow-trigger-list">
                        <h3>Available Events</h3>
                        {events.length === 0 && <p>No events available.</p>}
                        <div className="flow-list">
                            {events.map((event) => (
                                <article key={event.name} className="trigger-card">
                                    <h4>{event.label}</h4>
                                    <div className="trigger-meta">
                                        <span>{event.name}</span>
                                        <span>{event.description}</span>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                    <div className="flow-trigger-list">
                        <h3>Configured Triggers</h3>
                        {loading.triggers && <p>Loading triggers…</p>}
                        {triggers.length === 0 && !loading.triggers && <p>No triggers configured.</p>}
                        <div className="flow-list">
                            {triggers.map((trigger) => (
                                <article key={trigger.id} className="trigger-card">
                                    <h4>{trigger.flow?.name || trigger.flowId}</h4>
                                    <div className="trigger-meta">
                                        <span>Event: {trigger.eventName}</span>
                                        <span>{trigger.isActive ? 'Active' : 'Paused'}</span>
                                    </div>
                                    <div className="trigger-actions">
                                        <button onClick={() => handleTriggerEdit(trigger)}>Edit</button>
                                        <button onClick={() => handleTriggerToggle(trigger)}>
                                            {trigger.isActive ? 'Pause' : 'Activate'}
                                        </button>
                                        <button className="danger" onClick={() => handleTriggerDelete(trigger)}>
                                            Delete
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </div>

                <form className="flow-form trigger-form" onSubmit={handleTriggerSubmit}>
                    <div className="flow-form-row">
                        <label>
                            Flow
                            <select
                                value={triggerForm.flowId}
                                onChange={(event) => handleTriggerInput('flowId', event.target.value)}
                                required
                            >
                                <option value="">Select a flow</option>
                                {flows.map((flow) => (
                                    <option key={flow.id} value={flow.id}>
                                        {flow.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Event
                            <select
                                value={triggerForm.eventName}
                                onChange={(event) => handleTriggerInput('eventName', event.target.value)}
                                required
                            >
                                <option value="">Select event</option>
                                {events.map((event) => (
                                    <option key={event.name} value={event.name}>
                                        {event.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Status
                            <select
                                value={triggerForm.isActive ? 'active' : 'paused'}
                                onChange={(event) => handleTriggerInput('isActive', event.target.value === 'active')}
                            >
                                <option value="active">Active</option>
                                <option value="paused">Paused</option>
                            </select>
                        </label>
                    </div>

                    <label>
                        Conditions (JSON)
                        <textarea
                            value={triggerForm.conditionsText}
                            onChange={(event) => handleTriggerInput('conditionsText', event.target.value)}
                            placeholder='{"match":{"role":"employee"}}'
                        />
                    </label>

                    <div className="flow-inline-actions">
                        <button type="submit" className="primary">
                            {triggerForm.id ? 'Update Trigger' : 'Add Trigger'}
                        </button>
                        {triggerForm.id && (
                            <button type="button" onClick={resetTriggerForm}>
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </section>

            <section className="flow-panel">
                <h2>Version History</h2>
                {versionsLoading ? (
                    <p>Loading versions…</p>
                ) : versions.length === 0 ? (
                    <p>No versions available yet.</p>
                ) : (
                    <div className="flow-list">
                        {versions.map((version) => (
                            <article key={version.id} className="trigger-card">
                                <h4>Version {version.version}</h4>
                                <div className="trigger-meta">
                                    <span>{new Date(version.created_at).toLocaleString()}</span>
                                </div>
                                <div className="trigger-actions">
                                    <button onClick={() => handleRollbackVersion(version.id)}>Rollback</button>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            <section className="flow-panel">
                <h2>Analytics</h2>
                {analyticsLoading ? (
                    <p>Loading analytics…</p>
                ) : analyticsTotals.executions === 0 ? (
                    <p>No executions recorded yet.</p>
                ) : (
                    <div className="flow-analytics-grid">
                        <div className="analytics-card">
                            <h4>Total Executions</h4>
                            <p>{analyticsTotals.executions}</p>
                        </div>
                        <div className="analytics-card">
                            <h4>Success Rate</h4>
                            <p>{analyticsTotals.successRate}%</p>
                        </div>
                        <div className="analytics-card">
                            <h4>Avg Duration (s)</h4>
                            <p>{analyticsTotals.averageDuration}</p>
                        </div>
                    </div>
                )}
            </section>

            <section className="flow-panel">
                <div className="flow-page-header">
                    <h2>Reusable Components</h2>
                    <p>Build shared screens or actions, then insert them into any flow.</p>
                </div>
                <div className="flow-form-row">
                    <div className="flow-form">
                        <label>
                            Name
                            <input
                                value={componentForm.name}
                                placeholder="Onboarding Intro"
                                onChange={(event) => handleComponentFieldChange('name', event.target.value)}
                            />
                        </label>
                        <label>
                            Type
                            <select
                                value={componentForm.type}
                                onChange={(event) => handleComponentFieldChange('type', event.target.value)}
                            >
                                <option value="screen">Screen</option>
                                <option value="action">Action</option>
                                <option value="decision">Decision</option>
                            </select>
                        </label>
                        <label>
                            Description
                            <input
                                value={componentForm.description}
                                onChange={(event) => handleComponentFieldChange('description', event.target.value)}
                            />
                        </label>
                        <label>
                            Config (JSON)
                            <textarea
                                value={componentForm.configText}
                                onChange={(event) => handleComponentFieldChange('configText', event.target.value)}
                            />
                        </label>
                        <div className="flow-inline-actions">
                            <button type="button" className="primary" onClick={handleComponentSave} disabled={componentSaving}>
                                {componentForm.id ? 'Update Component' : 'Create Component'}
                            </button>
                            {componentForm.id && (
                                <button type="button" onClick={resetComponentForm}>
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flow-trigger-list">
                        <h3>Library</h3>
                        {componentLoading ? (
                            <p>Loading components…</p>
                        ) : components.length === 0 ? (
                            <p>No reusable components yet.</p>
                        ) : (
                            <div className="flow-list">
                                {components.map((component) => (
                                    <article key={component.id} className="trigger-card">
                                        <h4>{component.name}</h4>
                                        <div className="trigger-meta">
                                            <span>{component.type}</span>
                                            <span>{component.isShared ? 'Shared' : 'Private'}</span>
                                        </div>
                                        <p>{component.description}</p>
                                        <div className="trigger-actions">
                                            <button onClick={() => handleComponentInsert(component)}>Insert</button>
                                            <button onClick={() => handleComponentEdit(component)}>Edit</button>
                                            <button className="danger" onClick={() => handleComponentDelete(component.id)}>
                                                Delete
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
            <FlowPreviewModal
                state={previewState}
                onClose={closePreview}
                onSubmit={submitPreviewStep}
                onRestart={restartPreview}
            />
        </div>
    );
};

const FlowPreviewModal = ({ state, onClose, onSubmit, onRestart }) => {
    if (!state.open) return null;
    const hasNode = Boolean(state.node);
    return (
        <div className="flow-preview-modal">
            <div className="flow-preview-dialog">
                <div className="flow-preview-header">
                    <div>
                        <h3>{state.flow?.name || 'Flow Preview'}</h3>
                        <p>{state.flow?.id}</p>
                    </div>
                    <button type="button" className="flow-preview-close" onClick={onClose}>
                        ×
                    </button>
                </div>
                <div className="flow-preview-body">
                    {!hasNode && state.status !== 'completed' && (
                        <p>{state.loading ? 'Preparing flow…' : 'No active node'}</p>
                    )}
                    {state.status === 'completed' && (
                        <FlowPreviewSummary summary={state.summary} onRestart={onRestart} />
                    )}
                    {hasNode && state.status !== 'completed' && (
                        <FlowScreenForm
                            node={state.node}
                            busy={state.loading}
                            errors={state.errors}
                            onSubmit={onSubmit}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

const FlowPreviewSummary = ({ summary, onRestart }) => {
    return (
        <div className="flow-preview-summary">
            <h4>Flow completed</h4>
            <p>The collected context is shown below.</p>
            <pre className="flow-summary-block">{JSON.stringify(summary || {}, null, 2)}</pre>
            <div className="flow-summary-actions">
                <button type="button" onClick={onRestart}>
                    Run Again
                </button>
            </div>
        </div>
    );
};

const FlowScreenForm = ({ node, onSubmit, busy, errors = [] }) => {
    const [values, setValues] = useState(() => buildInitialValues(node));
    useEffect(() => {
        setValues(buildInitialValues(node));
    }, [node?.id]);

    const errorMap = useMemo(() => {
        const map = {};
        (errors || []).forEach((err) => {
            if (err?.field) {
                map[err.field] = err.message;
            }
        });
        return map;
    }, [errors]);

    if (!node) {
        return <p>No screen definition found.</p>;
    }

    const handleFieldChange = (field, value) => {
        setValues((prev) => ({
            ...prev,
            [field.id]: value
        }));
    };

    const renderInput = (field) => {
        const commonProps = {
            id: field.id,
            name: field.id,
            required: field.required,
            placeholder: field.placeholder || '',
            disabled: busy,
            value: values[field.id] ?? ''
        };
        if (field.type === 'textarea') {
            return (
                <textarea
                    {...commonProps}
                    rows={4}
                    onChange={(event) => handleFieldChange(field, event.target.value)}
                />
            );
        }
        if ((field.type === 'select' || field.options?.length) && !field.multiple) {
            return (
                <select
                    {...commonProps}
                    onChange={(event) => handleFieldChange(field, event.target.value)}
                >
                    <option value="">Select…</option>
                    {(field.options || []).map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            );
        }
        if (field.multiple || field.type === 'multi-select') {
            const selectedValues = Array.isArray(values[field.id]) ? values[field.id] : [];
            return (
                <select
                    multiple
                    value={selectedValues}
                    onChange={(event) => {
                        const selection = Array.from(event.target.selectedOptions).map((opt) => opt.value);
                        handleFieldChange(field, selection);
                    }}
                >
                    {(field.options || []).map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            );
        }
        if (field.type === 'checkbox' || field.type === 'boolean') {
            const checked = Boolean(values[field.id]);
            return (
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => handleFieldChange(field, event.target.checked)}
                />
            );
        }
        return (
            <input
                type={field.type === 'number' ? 'number' : 'text'}
                {...commonProps}
                onChange={(event) => handleFieldChange(field, event.target.value)}
            />
        );
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        onSubmit(values);
    };

    return (
        <form className="flow-screen-form" onSubmit={handleSubmit}>
            <h4>{node.title}</h4>
            {node.description && <p className="flow-screen-description">{node.description}</p>}
            {(node.inputs || []).map((input) => (
                <label key={input.id}>
                    <span>
                        {input.label}
                        {input.required && <span className="required-indicator">*</span>}
                    </span>
                    {renderInput(input)}
                    {input.helpText && <small>{input.helpText}</small>}
                    {errorMap[input.id] && <div className="input-error">{errorMap[input.id]}</div>}
                </label>
            ))}
            <button type="submit" className="primary" disabled={busy}>
                {busy ? 'Submitting…' : 'Continue'}
            </button>
        </form>
    );
};

const buildInitialValues = (node) => {
    if (!node) return {};
    const inputs = Array.isArray(node.inputs) ? node.inputs : [];
    return inputs.reduce((acc, input) => {
        const value = input.value ?? (input.multiple ? [] : '');
        acc[input.id] = value;
        return acc;
    }, {});
};

export default FlowManagement;
