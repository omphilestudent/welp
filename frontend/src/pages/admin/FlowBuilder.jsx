import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import {
    createFlowTrigger,
    executeFlow,
    fetchFlowById,
    fetchFlowEvents,
    fetchFlowTriggers,
    updateFlow,
    updateFlowTrigger
} from '../../services/flowService';
import './FlowBuilder.css';

const makeId = () => `node-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;

const LIBRARY = [
    {
        title: 'Triggers',
        items: [
            {
                key: 'trigger-signup',
                label: 'User Signup',
                help: 'When a new user signs up',
                nodeType: 'trigger',
                config: { eventName: 'user.signup', conditions: { match: {} } }
            },
            {
                key: 'trigger-subscription',
                label: 'Subscription Change',
                help: 'When a subscription changes',
                nodeType: 'trigger',
                config: { eventName: 'subscription.changed', conditions: { match: {} } }
            }
        ]
    },
    {
        title: 'Actions',
        items: [
            {
                key: 'email',
                label: 'Send Email',
                help: 'Send an email message',
                nodeType: 'email',
                config: { to: '{{email}}', subject: 'Welcome', text: 'Welcome, {{email}}!' }
            },
            {
                key: 'notify',
                label: 'Send Notification',
                help: 'Send an in-app notification',
                nodeType: 'user_notification',
                config: { message: 'Welcome, {{email}}!' }
            },
            {
                key: 'callApi',
                label: 'Call API',
                help: 'Call an API endpoint',
                nodeType: 'call_api',
                config: { baseUrl: '', path: '/api/health', method: 'GET', headers: {}, body: null }
            },
            {
                key: 'condition',
                label: 'Condition',
                help: 'Route based on a condition',
                nodeType: 'condition',
                config: { field: 'role', value: 'business' }
            },
            {
                key: 'end',
                label: 'End Flow',
                help: 'Stop execution',
                nodeType: 'end',
                config: {}
            }
        ]
    }
];

const fromDefinition = (definition = {}) => {
    const rawNodes = Array.isArray(definition.nodes) ? definition.nodes : [];
    const viewport = definition.ui?.viewport || { x: 0, y: 0, zoom: 1 };
    const positions = definition.ui?.nodes || {};
    const mode = definition.meta?.lifecycle?.mode === 'published' ? 'published' : 'draft';

    const nodes = rawNodes.map((n) => ({
        id: String(n.id),
        type: n.type || 'log',
        label: n.label || n.type || 'Step',
        config: {
            ...(n.type === 'trigger' ? { eventName: n.eventName || 'user.signup', conditions: n.conditions || { match: {} } } : {}),
            ...(n.type === 'email' ? { to: n.to || '{{email}}', subject: n.subject || '', text: n.text || n.message || '' } : {}),
            ...(n.type === 'user_notification' ? { message: n.message || '' } : {}),
            ...(n.type === 'call_api' ? { baseUrl: n.baseUrl || '', path: n.path || n.url || '', method: n.method || 'GET', body: n.body ?? null } : {}),
            ...(n.type === 'condition' ? { field: n.field || 'role', value: n.value || 'business' } : {})
        }
    }));

    const edges = [];
    rawNodes.forEach((n) => {
        if (!n?.id) return;
        if (n.type === 'condition' && n.next && typeof n.next === 'object') {
            const yes = Array.isArray(n.next.branches) ? n.next.branches[0]?.next : null;
            if (yes) edges.push({ id: `${n.id}-yes-${yes}`, from: String(n.id), to: String(yes), handle: 'yes' });
            if (n.next.default) edges.push({ id: `${n.id}-no-${n.next.default}`, from: String(n.id), to: String(n.next.default), handle: 'no' });
            return;
        }
        if (typeof n.next === 'string') edges.push({ id: `${n.id}-${n.next}`, from: String(n.id), to: String(n.next), handle: 'out' });
    });

    const pos = {};
    nodes.forEach((n, i) => {
        const p = positions?.[n.id];
        pos[n.id] = p && typeof p.x === 'number' ? p : { x: 80 + (i % 3) * 260, y: 80 + Math.floor(i / 3) * 160 };
    });

    return { nodes, edges, positions: pos, viewport, mode };
};

const toDefinition = ({ nodes, edges, positions, viewport, mode }) => {
    const outgoing = new Map();
    edges.forEach((e) => {
        if (!outgoing.has(e.from)) outgoing.set(e.from, []);
        outgoing.get(e.from).push(e);
    });

    const definitionNodes = nodes.map((node) => {
        const outs = outgoing.get(node.id) || [];
        let next = null;
        if (node.type === 'condition') {
            const yes = outs.find((e) => e.handle === 'yes')?.to || null;
            const no = outs.find((e) => e.handle === 'no')?.to || null;
            const condition = { match: { [node.config.field]: node.config.value } };
            next = { branches: yes ? [{ when: condition, next: yes }] : [], default: no };
        } else if (node.type !== 'end') {
            next = outs[0]?.to || null;
        }

        const payload = { id: node.id, type: node.type, label: node.label, ...node.config };
        if (next) payload.next = next;
        return payload;
    });

    const startNodeId = nodes.find((n) => n.type === 'trigger')?.id || definitionNodes[0]?.id || null;
    return { version: 2, meta: { lifecycle: { mode } }, startNodeId, nodes: definitionNodes, ui: { nodes: positions, viewport } };
};

const validateFlow = ({ flowType, nodes, edges }) => {
    const errors = [];
    if (!nodes.length) return ['Add at least one step.'];
    if (String(flowType).toLowerCase() === 'trigger') {
        const trigger = nodes.find((n) => n.type === 'trigger');
        if (!trigger) errors.push('Trigger flow needs a trigger step.');
        if (trigger && !trigger.config?.eventName) errors.push('Select a trigger event.');
    }
    const outgoing = new Map();
    edges.forEach((e) => {
        if (!outgoing.has(e.from)) outgoing.set(e.from, []);
        outgoing.get(e.from).push(e);
    });
    nodes.forEach((n) => {
        if (n.type === 'end') return;
        const outs = outgoing.get(n.id) || [];
        if (!outs.length) errors.push('This flow has a step that is not connected.');
    });
    return [...new Set(errors)];
};

export default function FlowBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const role = String(user?.role || '').toLowerCase();
    const canEdit = ['admin', 'super_admin'].includes(role);

    const canvasRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [flow, setFlow] = useState(null);
    const [events, setEvents] = useState([]);
    const [triggers, setTriggers] = useState([]);

    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [positions, setPositions] = useState({});
    const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
    const [mode, setMode] = useState('draft');
    const [selectedId, setSelectedId] = useState(null);
    const [connecting, setConnecting] = useState(null); // { from, handle }
    const [run, setRun] = useState({ running: false, activeId: null });

    const selected = useMemo(() => nodes.find((n) => n.id === selectedId) || null, [nodes, selectedId]);

    useEffect(() => {
        if (!canEdit) return;
        (async () => {
            setLoading(true);
            try {
                const [{ data: flowRes }, { data: eventsRes }, { data: triggersRes }] = await Promise.all([
                    fetchFlowById(id),
                    fetchFlowEvents(),
                    fetchFlowTriggers()
                ]);
                const record = flowRes?.data;
                setFlow(record);
                setEvents(eventsRes?.events || []);
                setTriggers(triggersRes?.data || []);
                const parsed = fromDefinition(record?.definition || {});
                setNodes(parsed.nodes);
                setEdges(parsed.edges);
                setPositions(parsed.positions);
                setViewport(parsed.viewport);
                setMode(parsed.mode);
            } catch (e) {
                console.error(e);
                toast.error('Unable to load flow');
            } finally {
                setLoading(false);
            }
        })();
    }, [id, canEdit]);

    const screenToCanvas = (clientX, clientY) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return { x: 120, y: 120 };
        return { x: (clientX - rect.left - viewport.x) / viewport.zoom, y: (clientY - rect.top - viewport.y) / viewport.zoom };
    };

    const onDrop = (e) => {
        e.preventDefault();
        const raw = e.dataTransfer.getData('application/flow-node');
        if (!raw) return;
        const item = JSON.parse(raw);
        const point = screenToCanvas(e.clientX, e.clientY);
        const nodeId = makeId();
        setNodes((prev) => [...prev, { id: nodeId, type: item.nodeType, label: item.help || item.label, config: item.config || {} }]);
        setPositions((prev) => ({ ...prev, [nodeId]: { x: point.x, y: point.y } }));
        setSelectedId(nodeId);
    };

    const onDragStart = (e, item) => {
        e.dataTransfer.setData('application/flow-node', JSON.stringify(item));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const connectFrom = (from, handle) => {
        setConnecting({ from, handle });
        toast('Click the next step to connect.');
    };

    const connectTo = (to) => {
        if (!connecting) return;
        if (connecting.from === to) return;
        const fromNode = nodes.find((n) => n.id === connecting.from);
        const toNode = nodes.find((n) => n.id === to);
        if (!fromNode || !toNode) return;
        if (toNode.type === 'trigger') return toast.error('Triggers cannot have incoming connections.');
        if (fromNode.type === 'end') return toast.error('End nodes cannot connect forward.');
        setEdges((prev) => {
            const filtered = prev.filter((e) => !(e.from === connecting.from && e.handle === connecting.handle));
            return [...filtered, { id: `${connecting.from}-${connecting.handle}-${to}`, from: connecting.from, to, handle: connecting.handle }];
        });
        setConnecting(null);
    };

    const updateSelected = (patch) => {
        if (!selected) return;
        setNodes((prev) => prev.map((n) => (n.id === selected.id ? { ...n, config: { ...n.config, ...patch } } : n)));
    };

    const syncTrigger = async (flowId) => {
        const triggerNode = nodes.find((n) => n.type === 'trigger');
        if (!triggerNode?.config?.eventName) return;
        const existing = triggers.find((t) => t.flowId === flowId) || null;
        const payload = {
            flowId,
            eventName: triggerNode.config.eventName,
            conditions: triggerNode.config.conditions || { match: {} },
            isActive: flow?.isActive !== false && mode === 'published'
        };
        if (!existing) return createFlowTrigger(payload);
        return updateFlowTrigger(existing.id, payload);
    };

    const save = async (overrideMode) => {
        if (!flow) return;
        const errors = validateFlow({ flowType: flow.type, nodes, edges });
        if (errors.length) return toast.error(errors[0]);
        setSaving(true);
        try {
            const definition = toDefinition({ nodes, edges, positions, viewport, mode: overrideMode || mode });
            const { data } = await updateFlow(flow.id, { definition });
            setFlow(data?.data);
            await syncTrigger(flow.id);
            toast.success('Saved');
        } catch (e) {
            console.error(e);
            toast.error('Unable to save');
        } finally {
            setSaving(false);
        }
    };

    const test = async () => {
        if (!flow) return;
        const errors = validateFlow({ flowType: flow.type, nodes, edges });
        if (errors.length) return toast.error(errors[0]);
        setRun({ running: true, activeId: null });
        try {
            const context = { email: user?.email || 'test@example.com', userId: user?.id || null, role: user?.role || 'admin' };
            const { data } = await executeFlow(flow.id, context);
            const results = data?.data?.actions || [];
            for (const step of results) {
                // eslint-disable-next-line no-await-in-loop
                await new Promise((r) => setTimeout(r, 300));
                setRun({ running: true, activeId: step.id });
            }
        } catch (e) {
            console.error(e);
            toast.error('Test failed');
        } finally {
            setRun({ running: false, activeId: null });
        }
    };

    if (!canEdit) {
        return (
            <div style={{ padding: 16 }}>
                <h2>Flow Builder</h2>
                <p>You do not have permission to edit flows.</p>
            </div>
        );
    }

    return (
        <div className="fb-page">
            <div className="fb-top">
                <button type="button" className="secondary" onClick={() => navigate('/admin/flows')}>{'<-'} Back</button>
                <div className="fb-title">
                    <div className="fb-name">{flow?.name || 'Flow Builder'}</div>
                    <div className="fb-sub">
                        <span className={`badge badge-${mode}`}>{mode === 'published' ? 'Published' : 'Draft'}</span>
                        <span className={`badge badge-active-${flow?.isActive ? 'on' : 'off'}`}>{flow?.isActive ? 'Active' : 'Inactive'}</span>
                        {loading ? <span className="hint">Loading...</span> : <span className="hint">Shift+drag to pan | Ctrl+wheel to zoom</span>}
                    </div>
                </div>
                <div className="fb-actions">
                    <button
                        type="button"
                        className="secondary"
                        onClick={async () => {
                            const nextMode = mode === 'published' ? 'draft' : 'published';
                            const errors = flow ? validateFlow({ flowType: flow.type, nodes, edges }) : [];
                            if (nextMode === 'published' && errors.length) {
                                toast.error(errors[0]);
                                return;
                            }
                            setMode(nextMode);
                            await save(nextMode);
                        }}
                    >
                        {mode === 'published' ? 'Set Draft' : 'Publish'}
                    </button>
                    <button type="button" className="secondary" onClick={async () => {
                        if (!flow) return;
                        const { data } = await updateFlow(flow.id, { isActive: !flow.isActive });
                        setFlow(data?.data);
                        await syncTrigger(flow.id);
                    }}>
                        {flow?.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button type="button" className="secondary" onClick={test} disabled={run.running}>Test</button>
                    <button type="button" className="primary" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                </div>
            </div>

            <div className="fb-layout">
                <aside className="fb-panel left">
                    <h3>Component Library</h3>
                    {LIBRARY.map((group) => (
                        <div key={group.title} className="fb-group">
                            <div className="fb-group-title">{group.title}</div>
                            <div className="fb-items">
                                {group.items.map((item) => (
                                    <div key={item.key} className="fb-item" draggable onDragStart={(e) => onDragStart(e, item)} title={item.help}>
                                        <div className="fb-item-label">{item.label}</div>
                                        <div className="fb-item-help">{item.help}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </aside>

                <main className="fb-canvas-wrap">
                    <div
                        className="fb-canvas"
                        ref={canvasRef}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={onDrop}
                        onWheel={(e) => {
                            if (!e.ctrlKey) return;
                            e.preventDefault();
                            const nextZoom = Math.min(1.8, Math.max(0.5, viewport.zoom + (-e.deltaY) * 0.001));
                            setViewport((v) => ({ ...v, zoom: nextZoom }));
                        }}
                        onMouseDown={(e) => {
                            if (!e.shiftKey || e.button !== 0) return;
                            const start = { x: e.clientX, y: e.clientY };
                            const initial = { x: viewport.x, y: viewport.y };
                            const move = (ev) => setViewport((v) => ({ ...v, x: initial.x + (ev.clientX - start.x), y: initial.y + (ev.clientY - start.y) }));
                            const up = () => {
                                window.removeEventListener('mousemove', move);
                                window.removeEventListener('mouseup', up);
                            };
                            window.addEventListener('mousemove', move);
                            window.addEventListener('mouseup', up);
                        }}
                        onClick={() => {
                            setSelectedId(null);
                            setConnecting(null);
                        }}
                    >
                        <svg className="fb-edges">
                            {edges.map((edge) => {
                                const from = positions[edge.from];
                                const to = positions[edge.to];
                                if (!from || !to) return null;
                                const x1 = from.x + 232;
                                const y1 = from.y + 40 + (edge.handle === 'yes' ? 0 : edge.handle === 'no' ? 18 : 0);
                                const x2 = to.x + 8;
                                const y2 = to.y + 40;
                                const midX = (x1 + x2) / 2;
                                const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
                                return <path key={edge.id} d={path} className="fb-edge-path" />;
                            })}
                        </svg>
                        <div className="fb-inner" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}>
                            {nodes.map((node) => {
                                const pos = positions[node.id] || { x: 80, y: 80 };
                                const active = node.id === selectedId;
                                const running = node.id === run.activeId;
                                return (
                                    <div
                                        key={node.id}
                                        className={`fb-node ${active ? 'active' : ''} ${running ? 'running' : ''}`}
                                        style={{ left: pos.x, top: pos.y }}
                                        onMouseDown={(e) => {
                                            if (e.button !== 0) return;
                                            e.stopPropagation();
                                            setSelectedId(node.id);
                                            const start = { x: e.clientX, y: e.clientY };
                                            const initial = positions[node.id] || { x: 0, y: 0 };
                                            const move = (ev) => {
                                                const dx = (ev.clientX - start.x) / viewport.zoom;
                                                const dy = (ev.clientY - start.y) / viewport.zoom;
                                                setPositions((p) => ({ ...p, [node.id]: { x: initial.x + dx, y: initial.y + dy } }));
                                            };
                                            const up = () => {
                                                window.removeEventListener('mousemove', move);
                                                window.removeEventListener('mouseup', up);
                                            };
                                            window.addEventListener('mousemove', move);
                                            window.addEventListener('mouseup', up);
                                        }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (connecting) return connectTo(node.id);
                                            setSelectedId(node.id);
                                        }}
                                    >
                                        <div className="fb-node-head">
                                            <div className="fb-node-type">{node.type}</div>
                                            <div className="fb-node-label">{node.label}</div>
                                        </div>
                                        <div className="fb-node-ports">
                                            {node.type !== 'trigger' && <button type="button" className="port in" title="Connect into this step" onClick={(e) => { e.stopPropagation(); connectTo(node.id); }} />}
                                            <div className="fb-out">
                                                {node.type === 'condition' && (
                                                    <>
                                                        <button type="button" className="port out yes" title="Yes" onClick={(e) => { e.stopPropagation(); connectFrom(node.id, 'yes'); }} />
                                                        <button type="button" className="port out no" title="No" onClick={(e) => { e.stopPropagation(); connectFrom(node.id, 'no'); }} />
                                                    </>
                                                )}
                                                {node.type !== 'end' && node.type !== 'condition' && (
                                                    <button type="button" className="port out" title="Next" onClick={(e) => { e.stopPropagation(); connectFrom(node.id, 'out'); }} />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </main>

                <aside className="fb-panel right">
                    <h3>Step Configuration</h3>
                    {!selected && <div className="fb-empty">Select a step to configure it.</div>}
                    {selected && (
                        <div className="fb-config">
                            <label>
                                Label
                                <input value={selected.label} onChange={(e) => setNodes((prev) => prev.map((n) => (n.id === selected.id ? { ...n, label: e.target.value } : n)))} />
                            </label>

                            {selected.type === 'trigger' && (
                                <>
                                    <label>
                                        When this happens…
                                        <select value={selected.config.eventName || ''} onChange={(e) => updateSelected({ eventName: e.target.value })}>
                                            {events.map((evt) => <option key={evt.name} value={evt.name}>{evt.label}</option>)}
                                        </select>
                                    </label>
                                    <label>
                                        Optional: only when role is…
                                        <select
                                            value={selected.config.conditions?.match?.role || ''}
                                            onChange={(e) => updateSelected({ conditions: { match: e.target.value ? { role: e.target.value } : {} } })}
                                        >
                                            <option value="">any role</option>
                                            <option value="business">business</option>
                                            <option value="psychologist">psychologist</option>
                                            <option value="user">user</option>
                                        </select>
                                    </label>
                                </>
                            )}

                            {selected.type === 'email' && (
                                <>
                                    <label>Send to<input value={selected.config.to || ''} onChange={(e) => updateSelected({ to: e.target.value })} /></label>
                                    <label>Subject<input value={selected.config.subject || ''} onChange={(e) => updateSelected({ subject: e.target.value })} /></label>
                                    <label>Message<textarea rows={5} value={selected.config.text || ''} onChange={(e) => updateSelected({ text: e.target.value })} /></label>
                                </>
                            )}

                            {selected.type === 'user_notification' && (
                                <label>Message<textarea rows={4} value={selected.config.message || ''} onChange={(e) => updateSelected({ message: e.target.value })} /></label>
                            )}

                            {selected.type === 'call_api' && (
                                <>
                                    <label>Base URL<input value={selected.config.baseUrl || ''} onChange={(e) => updateSelected({ baseUrl: e.target.value })} placeholder="optional" /></label>
                                    <label>Path / URL<input value={selected.config.path || ''} onChange={(e) => updateSelected({ path: e.target.value })} placeholder="/subscriptions" /></label>
                                    <label>Method<select value={selected.config.method || 'GET'} onChange={(e) => updateSelected({ method: e.target.value })}><option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option></select></label>
                                    <label>Body<textarea rows={6} value={typeof selected.config.body === 'string' ? selected.config.body : JSON.stringify(selected.config.body ?? null, null, 2)} onChange={(e) => {
                                        const text = e.target.value;
                                        try { updateSelected({ body: text.trim() ? JSON.parse(text) : null }); } catch { updateSelected({ body: text }); }
                                    }} /></label>
                                </>
                            )}

                            {selected.type === 'condition' && (
                                <>
                                    <label>Field<select value={selected.config.field || 'role'} onChange={(e) => updateSelected({ field: e.target.value })}><option value="role">role</option><option value="status">status</option></select></label>
                                    <label>Value<input value={selected.config.value || ''} onChange={(e) => updateSelected({ value: e.target.value })} /></label>
                                    <div className="hint">Connect Yes/No to route.</div>
                                </>
                            )}

                            <button type="button" className="danger" onClick={() => {
                                if (!window.confirm(`Delete "${selected.label}"?`)) return;
                                setNodes((prev) => prev.filter((n) => n.id !== selected.id));
                                setEdges((prev) => prev.filter((e) => e.from !== selected.id && e.to !== selected.id));
                                setPositions((prev) => {
                                    const next = { ...prev };
                                    delete next[selected.id];
                                    return next;
                                });
                                setSelectedId(null);
                            }}>
                                Delete step
                            </button>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}
