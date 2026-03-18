import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import {
    createFlowTrigger,
    executeFlow,
    fetchFlows,
    fetchFlowById,
    fetchFlowEvents,
    fetchFlowTriggers,
    updateFlow,
    updateFlowTrigger
} from '../../services/flowService';
import './FlowBuilder.css';

const makeId = () => `node-${Math.random().toString(36).substr(2, 9)}`;

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
            },
            {
                key: 'trigger-message',
                label: 'Message Created',
                help: 'When a new message is created',
                nodeType: 'trigger',
                config: { eventName: 'message.created', conditions: { match: {} } }
            }
        ]
    },
    {
        title: 'Logic',
        items: [
            {
                key: 'screen',
                label: 'Screen / Input',
                help: 'Collect inputs from a user',
                nodeType: 'screen',
                config: { title: 'Intake', description: '', inputs: [] }
            },
            {
                key: 'get-records',
                label: 'Get Records',
                help: 'Fetch records from a source',
                nodeType: 'get_records',
                config: { source: 'users', query: '{}' }
            },
            {
                key: 'load-config',
                label: 'Load Config',
                help: 'Load configuration values',
                nodeType: 'load_config',
                config: { key: 'feature_flags' }
            },
            {
                key: 'timer',
                label: 'Timer / Schedule',
                help: 'Run after a scheduled time',
                nodeType: 'timer',
                config: { delay: '5m' }
            },
            {
                key: 'delay',
                label: 'Delay / Wait',
                help: 'Pause the flow for a period',
                nodeType: 'delay',
                config: { delay: '5m' }
            },
            {
                key: 'decision',
                label: 'Decision',
                help: 'Route based on a condition',
                nodeType: 'condition',
                config: { field: 'role', operator: '=', value: 'business' }
            },
            {
                key: 'loop',
                label: 'Loop (Controlled)',
                help: 'Allow a loop with iteration limits',
                nodeType: 'loop',
                config: { maxIterations: 3 }
            }
        ]
    },
    {
        title: 'Actions',
        items: [
            {
                key: 'create-record',
                label: 'Create Record',
                help: 'Create a record in a table',
                nodeType: 'create_record',
                config: { table: 'users', payload: {} }
            },
            {
                key: 'update-record',
                label: 'Update Record',
                help: 'Update a record in a table',
                nodeType: 'update_record',
                config: { table: 'users', match: { id: '{{userId}}' }, payload: {} }
            },
            {
                key: 'delete-record',
                label: 'Delete Record',
                help: 'Delete a record in a table',
                nodeType: 'delete_record',
                config: { table: 'users', match: { id: '{{userId}}' } }
            },
            {
                key: 'email',
                label: 'Send Email',
                help: 'Send an email message',
                nodeType: 'email',
                config: { to: '{{email}}', subject: 'Welcome', text: 'Welcome, {{email}}!' }
            },
            {
                key: 'notify',
                label: 'Notification',
                help: 'Send an in-app notification',
                nodeType: 'user_notification',
                config: { message: 'Welcome, {{email}}!' }
            },
            {
                key: 'callApi',
                label: 'API Call (Webhook)',
                help: 'Call an API endpoint',
                nodeType: 'call_api',
                config: { baseUrl: '', path: '/api/health', method: 'GET', headers: {}, body: null }
            },
            {
                key: 'subflow',
                label: 'Subflow',
                help: 'Execute another flow',
                nodeType: 'subflow',
                config: { flowId: '' }
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

const NODE_KIND = {
    start: 'start',
    trigger: 'start',
    condition: 'decision',
    loop: 'decision',
    end: 'end'
};

const fromDefinition = (definition = {}) => {
    const rawNodes = Array.isArray(definition.nodes) ? definition.nodes : [];
    const viewport = definition.ui?.viewport || { x: 0, y: 0, zoom: 1 };
    const positions = definition.ui?.nodes || {};
    const uiEdges = Array.isArray(definition.ui?.edges) ? definition.ui.edges : [];
    const uiEdgeMap = new Map(uiEdges.map((edge) => [`${edge.from}-${edge.to}-${edge.handle || 'out'}`, edge]));
    const mode = definition.meta?.lifecycle?.mode === 'published' ? 'published' : 'draft';
    const customLogic = Array.isArray(definition.customLogic) ? definition.customLogic : [];

    const nodes = rawNodes.map((n) => ({
        id: String(n.id),
        type: n.type || 'log',
        label: n.label || n.type || 'Step',
        config: {
            ...(n.type === 'trigger' ? { eventName: n.eventName || 'user.signup', conditions: n.conditions || { match: {} } } : {}),
            ...(n.type === 'email' ? { to: n.to || '{{email}}', subject: n.subject || '', text: n.text || n.message || '' } : {}),
            ...(n.type === 'user_notification' ? { message: n.message || '' } : {}),
            ...(n.type === 'call_api' ? { baseUrl: n.baseUrl || '', path: n.path || n.url || '', method: n.method || 'GET', body: n.body ?? null } : {}),
            ...(n.type === 'condition' ? {
                field: n.field || n.condition?.field || 'role',
                operator: n.operator || n.condition?.operator || '=',
                value: n.value || n.condition?.value || 'business',
                trueLabel: n.trueLabel || 'True',
                falseLabel: n.falseLabel || 'False'
            } : {}),
            ...(n.type === 'timer' ? { delay: n.delay || '5m' } : {}),
            ...(n.type === 'delay' ? { delay: n.delay || '5m' } : {}),
            ...(n.type === 'loop' ? { maxIterations: n.maxIterations || 3 } : {}),
            ...(n.type === 'screen' ? { title: n.title || 'Screen', description: n.description || '', inputs: n.inputs || [] } : {}),
            ...(n.type === 'get_records' ? { source: n.source || 'users', query: n.query || '{}' } : {}),
            ...(n.type === 'load_config' ? { key: n.key || '' } : {}),
            ...(n.type === 'create_record' ? { table: n.table || 'users', payload: n.payload || {} } : {}),
            ...(n.type === 'update_record' ? { table: n.table || 'users', match: n.match || { id: '{{userId}}' }, payload: n.payload || {} } : {}),
            ...(n.type === 'delete_record' ? { table: n.table || 'users', match: n.match || { id: '{{userId}}' } } : {}),
            ...(n.type === 'subflow' ? { flowId: n.flowId || n.flow_id || '' } : {}),
            ...(n.type === 'custom_logic' ? { logicId: n.logicId || n.logic_id || '' } : {})
        }
    }));

    const edges = [];
    rawNodes.forEach((n) => {
        if (!n?.id) return;
        if (n.type === 'condition' && n.next && typeof n.next === 'object') {
            const yes = Array.isArray(n.next.branches) ? n.next.branches[0]?.next : null;
            if (yes) {
                const uiEdge = uiEdgeMap.get(`${n.id}-${yes}-yes`);
                edges.push({
                    id: `${n.id}-yes-${yes}`,
                    from: String(n.id),
                    to: String(yes),
                    handle: 'yes',
                    label: uiEdge?.label || n.trueLabel || 'TRUE'
                });
            }
            if (n.next.default) {
                const uiEdge = uiEdgeMap.get(`${n.id}-${n.next.default}-no`);
                edges.push({
                    id: `${n.id}-no-${n.next.default}`,
                    from: String(n.id),
                    to: String(n.next.default),
                    handle: 'no',
                    label: uiEdge?.label || n.falseLabel || 'FALSE'
                });
            }
            return;
        }
        if (typeof n.next === 'string') {
            const uiEdge = uiEdgeMap.get(`${n.id}-${n.next}-out`);
            edges.push({
                id: `${n.id}-${n.next}`,
                from: String(n.id),
                to: String(n.next),
                handle: 'out',
                label: uiEdge?.label || 'NEXT'
            });
        }
    });

    const pos = {};
    nodes.forEach((n, i) => {
        const p = positions?.[n.id];
        pos[n.id] = p && typeof p.x === 'number' ? p : { x: 200, y: 100 + (i * 120) };
    });

    return { nodes, edges, positions: pos, viewport, mode, customLogic };
};

const toDefinition = ({ nodes, edges, positions, viewport, mode, customLogic }) => {
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
            const operator = node.config.operator || '=';
            const condition = operator === '='
                ? { match: { [node.config.field]: node.config.value } }
                : { condition: { field: node.config.field, operator, value: node.config.value } };
            next = { branches: yes ? [{ when: condition, next: yes }] : [], default: no };
        } else if (node.type !== 'end') {
            next = outs[0]?.to || null;
        }

        const payload = { id: node.id, type: node.type, label: node.label, ...node.config };
        if (next) payload.next = next;
        return payload;
    });

    const startNodeId = nodes.find((n) => n.type === 'start')?.id
        || nodes.find((n) => n.type === 'trigger')?.id
        || definitionNodes[0]?.id
        || null;
    return {
        version: 2,
        meta: { lifecycle: { mode } },
        startNodeId,
        nodes: definitionNodes,
        customLogic: Array.isArray(customLogic) ? customLogic : [],
        ui: {
            nodes: positions,
            viewport,
            edges: edges.map((edge) => ({
                id: edge.id,
                from: edge.from,
                to: edge.to,
                handle: edge.handle,
                label: edge.label || 'NEXT'
            }))
        }
    };
};

const sanitizeDefinition = (definition) => {
    const seen = new WeakSet();
    const replacer = (key, value) => {
        if (typeof value === 'function') return undefined;
        if (typeof value === 'object' && value !== null) {
            if (typeof Element !== 'undefined' && value instanceof Element) return undefined;
            if (typeof Event !== 'undefined' && value instanceof Event) return undefined;
            if (value?.nodeType === 1) return undefined;
            if (seen.has(value)) return undefined;
            seen.add(value);
        }
        return value;
    };
    try {
        return JSON.parse(JSON.stringify(definition, replacer));
    } catch (error) {
        console.error('Unable to sanitize flow definition', error);
        return definition;
    }
};

const detectCycle = (nodes, edges) => {
    const adjacency = new Map();
    edges.forEach((edge) => {
        if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
        adjacency.get(edge.from).push(edge.to);
    });

    const visiting = new Set();
    const visited = new Set();

    const dfs = (id, stack) => {
        if (visiting.has(id)) return stack.slice(stack.indexOf(id));
        if (visited.has(id)) return null;
        visiting.add(id);
        const nexts = adjacency.get(id) || [];
        for (const next of nexts) {
            const cycle = dfs(next, [...stack, next]);
            if (cycle) return cycle;
        }
        visiting.delete(id);
        visited.add(id);
        return null;
    };

    for (const node of nodes) {
        const cycle = dfs(node.id, [node.id]);
        if (cycle) return cycle;
    }
    return null;
};

const validateFlow = ({ flowType, nodes, edges }) => {
    const errors = [];
    if (!nodes.length) return ['Add at least one step.'];
    if (!nodes.some((n) => n.type === 'start')) errors.push('Flow must include a Start node.');
    if (!nodes.some((n) => n.type === 'end')) errors.push('Flow must include an End node.');
    const normalizedType = String(flowType).toLowerCase();
    if (['trigger', 'event', 'event-based'].includes(normalizedType)) {
        const trigger = nodes.find((n) => n.type === 'trigger');
        if (!trigger) errors.push('Trigger flow needs a trigger step.');
        if (trigger && !trigger.config?.eventName) errors.push('Select a trigger event.');
    }
    const outgoing = new Map();
    edges.forEach((e) => {
        if (!outgoing.has(e.from)) outgoing.set(e.from, []);
        outgoing.get(e.from).push(e);
    });
    const canReachEnd = (startId, visited = new Set()) => {
        if (visited.has(startId)) return false;
        visited.add(startId);
        const node = nodes.find((n) => n.id === startId);
        if (!node) return false;
        if (node.type === 'end') return true;
        const outs = outgoing.get(startId) || [];
        for (const edge of outs) {
            if (canReachEnd(edge.to, new Set(visited))) return true;
        }
        return false;
    };
    nodes.forEach((n) => {
        if (n.type === 'end') return;
        const outs = outgoing.get(n.id) || [];
        if (!outs.length) errors.push('This flow has a step that is not connected.');
        if (n.type === 'condition') {
            const yes = outs.find((e) => e.handle === 'yes');
            const no = outs.find((e) => e.handle === 'no');
            if (!yes || !no) errors.push('Decision nodes must have Yes/No branches.');
            if (yes && !canReachEnd(yes.to)) errors.push('Decision TRUE branch must reach End.');
            if (no && !canReachEnd(no.to)) errors.push('Decision FALSE branch must reach End.');
        }
        if (n.type === 'start') {
            const hasIncoming = edges.some((e) => e.to === n.id);
            if (hasIncoming) errors.push('Start node cannot have incoming connections.');
        }
    });
    const cycle = detectCycle(nodes, edges);
    if (cycle) {
        const cycleHasLoop = cycle.some((id) => nodes.find((n) => n.id === id)?.type === 'loop');
        if (!cycleHasLoop) {
            errors.push('Cycles are not allowed unless a Loop node is part of the cycle.');
        }
    }
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
    const [flowList, setFlowList] = useState([]);
    const [events, setEvents] = useState([]);
    const [triggers, setTriggers] = useState([]);

    const [nodes, setNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [positions, setPositions] = useState({});
    const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
    const [mode, setMode] = useState('draft');
    const [customLogic, setCustomLogic] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [connecting, setConnecting] = useState(null);
    const [run, setRun] = useState({ running: false, activeId: null });
    const [addMenu, setAddMenu] = useState({ open: false, x: 0, y: 0, from: null, edge: null, query: '' });
    const [logicModal, setLogicModal] = useState({ open: false, name: '', code: '', from: null, edge: null });
    const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
    const [hoveredEdge, setHoveredEdge] = useState(null);
    const historyRef = useRef([]);
    const historyIndexRef = useRef(-1);
    const restoringRef = useRef(false);
    const readyRef = useRef(false);

    const selected = useMemo(() => nodes.find((n) => n.id === selectedId) || null, [nodes, selectedId]);

    useEffect(() => {
        if (!canEdit) return;
        (async () => {
            setLoading(true);
            try {
                const [{ data: flowRes }, { data: eventsRes }, { data: triggersRes }, { data: flowsRes }] = await Promise.all([
                    fetchFlowById(id),
                    fetchFlowEvents(),
                    fetchFlowTriggers(),
                    fetchFlows()
                ]);
                const record = flowRes?.data;
                setFlow(record);
                setEvents(eventsRes?.events || []);
                setTriggers(triggersRes?.data || []);
                setFlowList(flowsRes?.data || []);
                const parsed = fromDefinition(record?.definition || {});
                let nextNodes = parsed.nodes;
                let nextPositions = parsed.positions;
                let nextEdges = parsed.edges;
                setCustomLogic(parsed.customLogic || []);

                if (!nextNodes.length) {
                    const startId = makeId();
                    const endId = makeId();
                    nextNodes = [
                        { id: startId, type: 'start', label: 'Start Flow', config: {} },
                        { id: endId, type: 'end', label: 'End Flow', config: {} }
                    ];
                    nextPositions = {
                        [startId]: { x: 400, y: 80 },
                        [endId]: { x: 400, y: 280 }
                    };
                    nextEdges = [{ id: `${startId}-out-${endId}`, from: startId, to: endId, handle: 'out', label: 'NEXT' }];
                } else if (!nextNodes.some((n) => n.type === 'start')) {
                    const startId = makeId();
                    const startTarget = record?.definition?.startNodeId
                        || record?.definition?.startNode
                        || record?.definition?.start
                        || nextNodes[0]?.id
                        || null;
                    nextNodes = [{ id: startId, type: 'start', label: 'Start Flow', config: {} }, ...nextNodes];
                    const targetPos = startTarget ? nextPositions?.[startTarget] : null;
                    nextPositions = { [startId]: { x: targetPos?.x ?? 400, y: (targetPos?.y ?? 280) - 160 }, ...nextPositions };
                    if (startTarget) {
                        nextEdges = [...nextEdges, { id: `${startId}-out-${startTarget}`, from: startId, to: String(startTarget), handle: 'out', label: 'NEXT' }];
                    }
                } else if (!nextEdges.some((e) => nextNodes.find((n) => n.id === e.from)?.type === 'start')) {
                    const startNode = nextNodes.find((n) => n.type === 'start');
                    const endNode = nextNodes.find((n) => n.type === 'end');
                    if (startNode && endNode) {
                        nextEdges = [...nextEdges, { id: `${startNode.id}-out-${endNode.id}`, from: startNode.id, to: endNode.id, handle: 'out', label: 'NEXT' }];
                    }
                }

                setNodes(nextNodes);
                setEdges(nextEdges);
                setPositions(nextPositions);
                setViewport(parsed.viewport);
                setMode(parsed.mode);
            } catch (e) {
                console.error(e);
                toast.error('Unable to load flow');
            } finally {
                setLoading(false);
                readyRef.current = true;
            }
        })();
    }, [id, canEdit]);

    useEffect(() => {
        if (!readyRef.current) return undefined;
        const snapshot = { nodes, edges, positions, customLogic };
        const handle = setTimeout(() => {
            if (restoringRef.current) return;
            const next = historyRef.current.slice(0, historyIndexRef.current + 1);
            next.push(snapshot);
            if (next.length > 50) next.shift();
            historyRef.current = next;
            historyIndexRef.current = next.length - 1;
            setHistoryState({ canUndo: historyIndexRef.current > 0, canRedo: historyIndexRef.current < next.length - 1 });
        }, 300);
        return () => clearTimeout(handle);
    }, [nodes, edges, positions, customLogic]);

    const screenToCanvas = (clientX, clientY) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return { x: 120, y: 120 };
        return { x: (clientX - rect.left - viewport.x) / viewport.zoom, y: (clientY - rect.top - viewport.y) / viewport.zoom };
    };

    const getLastLinearNode = () => {
        const eligible = nodes.filter((n) => n.type !== 'end');
        if (!eligible.length) return null;
        return eligible.reduce((best, node) => {
            const a = positions[best?.id]?.y ?? -Infinity;
            const b = positions[node.id]?.y ?? -Infinity;
            return b >= a ? node : best;
        }, eligible[0]);
    };

    const addNodeFromItem = (item, point, connectFromId = null, edgeContext = null) => {
        const nodeId = makeId();
        const endNode = nodes.find((n) => n.type === 'end') || null;
        const anchorNode = connectFromId
            ? nodes.find((n) => n.id === connectFromId)
            : edgeContext
                ? nodes.find((n) => n.id === edgeContext.from)
                : getLastLinearNode();

        const anchorPos = anchorNode ? (positions[anchorNode.id] || { x: 400, y: 120 }) : { x: 400, y: 120 };
        const verticalSpacing = 140;
        const nextPos = {
            x: anchorPos.x,
            y: anchorPos.y + verticalSpacing
        };

        const shiftNodesBelowY = (startY, deltaY) => {
            if (startY === undefined || startY === null) return;
            setPositions((prev) => {
                const next = { ...prev };
                Object.keys(next).forEach((id) => {
                    if ((next[id]?.y ?? 0) >= startY) {
                        next[id] = { ...next[id], y: (next[id].y || 0) + deltaY };
                    }
                });
                return next;
            });
        };

        setNodes((prev) => [...prev, { id: nodeId, type: item.nodeType, label: item.help || item.label, config: item.config || {} }]);
        setPositions((prev) => ({ ...prev, [nodeId]: { x: nextPos.x, y: nextPos.y } }));

        if (edgeContext) {
            setEdges((prev) => {
                const filtered = prev.filter((e) => e.id !== edgeContext.id);
                const chainEdges = [
                    {
                        id: `${edgeContext.from}-${edgeContext.handle}-${nodeId}`,
                        from: edgeContext.from,
                        to: nodeId,
                        handle: edgeContext.handle || 'out',
                        label: edgeContext.label || 'NEXT'
                    }
                ];
                if (item.nodeType === 'condition') {
                    chainEdges.push(
                        { id: `${nodeId}-yes-${edgeContext.to}`, from: nodeId, to: edgeContext.to, handle: 'yes', label: 'TRUE' },
                        { id: `${nodeId}-no-${edgeContext.to}`, from: nodeId, to: edgeContext.to, handle: 'no', label: 'FALSE' }
                    );
                } else {
                    chainEdges.push({ id: `${nodeId}-out-${edgeContext.to}`, from: nodeId, to: edgeContext.to, handle: 'out', label: 'NEXT' });
                }
                return [...filtered, ...chainEdges];
            });
            const targetY = positions[edgeContext.to]?.y ?? anchorPos.y + verticalSpacing;
            shiftNodesBelowY(targetY, verticalSpacing);
        } else if (connectFromId || anchorNode) {
            const baseFromId = connectFromId || anchorNode?.id;
            const fromNode = nodes.find((n) => n.id === baseFromId);
            if (fromNode?.type === 'end') {
                toast.error('End nodes cannot connect forward.');
            } else {
                setEdges((prev) => {
                    const base = prev.filter((e) => !(endNode && e.from === baseFromId && e.to === endNode.id && e.handle === 'out'));
                    base.push({ id: `${baseFromId}-out-${nodeId}`, from: baseFromId, to: nodeId, handle: 'out', label: 'NEXT' });
                    if (item.nodeType === 'condition' && endNode?.id) {
                        base.push(
                            { id: `${nodeId}-yes-${endNode.id}`, from: nodeId, to: endNode.id, handle: 'yes', label: 'TRUE' },
                            { id: `${nodeId}-no-${endNode.id}`, from: nodeId, to: endNode.id, handle: 'no', label: 'FALSE' }
                        );
                    } else if (endNode?.id && item.nodeType !== 'condition') {
                        base.push({ id: `${nodeId}-out-${endNode.id}`, from: nodeId, to: endNode.id, handle: 'out', label: 'NEXT' });
                    }
                    return base;
                });
            }
        }
        setSelectedId(nodeId);
    };

    const onDrop = (e) => {
        e.preventDefault();
        const raw = e.dataTransfer.getData('application/flow-node');
        if (!raw) return;
        const item = JSON.parse(raw);
        const point = screenToCanvas(e.clientX, e.clientY);
        addNodeFromItem(item, point);
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
        if (toNode.type === 'start') return toast.error('Start nodes cannot have incoming connections.');
        if (fromNode.type === 'end') return toast.error('End nodes cannot connect forward.');
        setEdges((prev) => {
            const filtered = prev.filter((e) => !(e.from === connecting.from && e.handle === connecting.handle));
            const label = fromNode?.type === 'condition'
                ? (connecting.handle === 'yes' ? (fromNode.config?.trueLabel || 'TRUE') : (fromNode.config?.falseLabel || 'FALSE'))
                : 'NEXT';
            return [...filtered, { id: `${connecting.from}-${connecting.handle}-${to}`, from: connecting.from, to, handle: connecting.handle, label }];
        });
        setConnecting(null);
    };

    const updateSelected = (patch) => {
        if (!selected) return;
        setNodes((prev) => prev.map((n) => (n.id === selected.id ? { ...n, config: { ...n.config, ...patch } } : n)));
    };

    const openAddMenu = ({ x, y, from = null, edge = null }) => {
        setAddMenu({ open: true, x, y, from, edge, query: '' });
    };

    const closeAddMenu = () => {
        setAddMenu({ open: false, x: 0, y: 0, from: null, edge: null, query: '' });
    };

    const openLogicModal = ({ from, edge }) => {
        setLogicModal({ open: true, name: '', code: '', from, edge });
        closeAddMenu();
    };

    const saveCustomLogic = () => {
        if (!logicModal.name.trim()) {
            toast.error('Custom logic needs a name.');
            return;
        }
        const logicId = `logic-${Date.now().toString(36)}`;
        const entry = { id: logicId, name: logicModal.name.trim(), code: logicModal.code || '' };
        setCustomLogic((prev) => [...prev, entry]);
        const point = selectedId
            ? { x: (positions[selectedId]?.x || 400) + 260, y: positions[selectedId]?.y || 120 }
            : { x: 400, y: 140 };
        addNodeFromItem(
            { nodeType: 'custom_logic', label: entry.name, help: entry.name, config: { logicId } },
            point,
            logicModal.from,
            logicModal.edge
        );
        setLogicModal({ open: false, name: '', code: '', from: null, edge: null });
    };

    const applySnapshot = (snapshot) => {
        if (!snapshot) return;
        restoringRef.current = true;
        setNodes(snapshot.nodes || []);
        setEdges(snapshot.edges || []);
        setPositions(snapshot.positions || {});
        setCustomLogic(snapshot.customLogic || []);
        setTimeout(() => {
            restoringRef.current = false;
            setHistoryState({
                canUndo: historyIndexRef.current > 0,
                canRedo: historyIndexRef.current < historyRef.current.length - 1
            });
        }, 0);
    };

    const undo = () => {
        if (historyIndexRef.current <= 0) return;
        historyIndexRef.current -= 1;
        applySnapshot(historyRef.current[historyIndexRef.current]);
    };

    const redo = () => {
        if (historyIndexRef.current >= historyRef.current.length - 1) return;
        historyIndexRef.current += 1;
        applySnapshot(historyRef.current[historyIndexRef.current]);
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
            const nextMode = typeof overrideMode === 'string' ? overrideMode : mode;
            const definition = toDefinition({ nodes, edges, positions, viewport, mode: nextMode, customLogic });
            const safeDefinition = sanitizeDefinition(definition);
            const { data } = await updateFlow(flow.id, { definition: safeDefinition });
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

    const getEdgePath = (edge) => {
        const from = positions[edge.from];
        const to = positions[edge.to];
        if (!from || !to) return null;

        // Calculate connection points
        const startX = from.x + 116; // Center of node horizontally
        const startY = from.y + 40; // Bottom of node header
        const endX = to.x + 116; // Center of target node horizontally
        const endY = to.y + 8; // Top of target node

        // Add offset for decision branches
        let offsetY = 0;
        if (edge.handle === 'yes') offsetY = -10;
        if (edge.handle === 'no') offsetY = 10;

        // Create draw.io style path with smooth curves
        const controlY1 = startY + (endY - startY) * 0.25 + offsetY;
        const controlY2 = endY - (endY - startY) * 0.25 + offsetY;

        return `M ${startX} ${startY} 
                C ${startX} ${controlY1}, 
                  ${endX} ${controlY2}, 
                  ${endX} ${endY}`;
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
                <button type="button" className="secondary" onClick={() => navigate('/admin/flows')}>← Back</button>
                <div className="fb-title">
                    <div className="fb-name">{flow?.name || 'Flow Builder'}</div>
                    <div className="fb-sub">
                        <span className={`badge badge-${mode}`}>{mode === 'published' ? 'Published' : 'Draft'}</span>
                        <span className={`badge badge-active-${flow?.isActive ? 'on' : 'off'}`}>{flow?.isActive ? 'Active' : 'Inactive'}</span>
                        {loading ? <span className="hint">Loading...</span> : <span className="hint">Shift+drag to pan | Ctrl+wheel to zoom</span>}
                    </div>
                </div>
                <div className="fb-actions">
                    <button type="button" className="secondary" onClick={undo} disabled={!historyState.canUndo}>Undo</button>
                    <button type="button" className="secondary" onClick={redo} disabled={!historyState.canRedo}>Redo</button>
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
                    <button type="button" className="primary" onClick={() => save()} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
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
                                    <div
                                        key={item.key}
                                        className="fb-item"
                                        draggable
                                        onDragStart={(e) => onDragStart(e, item)}
                                        onClick={() => {
                                            const point = selectedId
                                                ? { x: (positions[selectedId]?.x || 400) + 260, y: positions[selectedId]?.y || 120 }
                                                : { x: 400, y: 140 };
                                            addNodeFromItem(item, point, selectedId);
                                        }}
                                        title={item.help}
                                    >
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
                            closeAddMenu();
                        }}
                    >
                        <svg className="fb-edges">
                            <defs>
                                <marker
                                    id="arrowhead"
                                    markerWidth="10"
                                    markerHeight="10"
                                    refX="9"
                                    refY="5"
                                    orient="auto"
                                >
                                    <path d="M2,2 L8,5 L2,8 L4,5 L2,2" fill="#2563eb" stroke="none" />
                                </marker>
                                <marker
                                    id="arrowhead-yes"
                                    markerWidth="10"
                                    markerHeight="10"
                                    refX="9"
                                    refY="5"
                                    orient="auto"
                                >
                                    <path d="M2,2 L8,5 L2,8 L4,5 L2,2" fill="#10b981" stroke="none" />
                                </marker>
                                <marker
                                    id="arrowhead-no"
                                    markerWidth="10"
                                    markerHeight="10"
                                    refX="9"
                                    refY="5"
                                    orient="auto"
                                >
                                    <path d="M2,2 L8,5 L2,8 L4,5 L2,2" fill="#ef4444" stroke="none" />
                                </marker>
                            </defs>
                            {edges.map((edge) => {
                                const path = getEdgePath(edge);
                                if (!path) return null;

                                const isHovered = hoveredEdge === edge.id;
                                const markerEnd = edge.handle === 'yes' ? 'url(#arrowhead-yes)' :
                                    edge.handle === 'no' ? 'url(#arrowhead-no)' :
                                        'url(#arrowhead)';

                                return (
                                    <g key={edge.id}>
                                        <path
                                            d={path}
                                            className={`fb-edge-path ${isHovered ? 'hovered' : ''}`}
                                            data-handle={edge.handle || 'out'}
                                            markerEnd={markerEnd}
                                            onMouseEnter={() => setHoveredEdge(edge.id)}
                                            onMouseLeave={() => setHoveredEdge(null)}
                                        />
                                        {isHovered && (
                                            <text className="fb-edge-label">
                                                <textPath href={`#${edge.id}`} startOffset="50%">
                                                    {edge.label || (edge.handle === 'yes' ? 'Yes' : edge.handle === 'no' ? 'No' : 'Next')}
                                                </textPath>
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                        </svg>

                        <div className="fb-inner" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}>
                            {nodes.map((node) => {
                                const pos = positions[node.id] || { x: 400, y: 100 };
                                const active = node.id === selectedId;
                                const running = node.id === run.activeId;
                                const kind = NODE_KIND[node.type] || 'action';
                                const isConnecting = connecting && connecting.from === node.id;

                                return (
                                    <div
                                        key={node.id}
                                        className={`fb-node type-${kind} ${active ? 'active' : ''} ${running ? 'running' : ''} ${isConnecting ? 'connecting' : ''}`}
                                        style={{ left: pos.x, top: pos.y }}
                                        onMouseDown={(e) => {
                                            if (e.button !== 0 || e.target.closest('.fb-node-add') || e.target.closest('.port')) return;
                                            e.stopPropagation();
                                            setSelectedId(node.id);
                                            const start = { x: e.clientX, y: e.clientY };
                                            const initial = positions[node.id] || { x: 0, y: 0 };
                                            const move = (ev) => {
                                                const dx = (ev.clientX - start.x) / viewport.zoom;
                                                const dy = (ev.clientY - start.y) / viewport.zoom;
                                                const snap = (value) => Math.round(value / 20) * 20;
                                                setPositions((p) => ({ ...p, [node.id]: { x: snap(initial.x + dx), y: snap(initial.y + dy) } }));
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
                                            <button
                                                type="button"
                                                className="fb-node-add"
                                                title="Add step"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    openAddMenu({ x: rect.right, y: rect.top, from: node.id });
                                                }}
                                            >
                                                +
                                            </button>
                                        </div>
                                        <div className="fb-node-ports">
                                            {node.type !== 'trigger' && node.type !== 'start' && (
                                                <button
                                                    type="button"
                                                    className="port in"
                                                    title="Connect into this step"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        connectTo(node.id);
                                                    }}
                                                />
                                            )}
                                            <div className="fb-out">
                                                {node.type === 'condition' && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            className="port out yes"
                                                            title="Yes"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                connectFrom(node.id, 'yes');
                                                            }}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="port out no"
                                                            title="No"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                connectFrom(node.id, 'no');
                                                            }}
                                                        />
                                                    </>
                                                )}
                                                {node.type !== 'end' && node.type !== 'condition' && (
                                                    <button
                                                        type="button"
                                                        className="port out"
                                                        title="Next"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            connectFrom(node.id, 'out');
                                                        }}
                                                    />
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
                                            <option value="employee">employee</option>
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
                                    <label>
                                        Field
                                        <select value={selected.config.field || 'role'} onChange={(e) => updateSelected({ field: e.target.value })}>
                                            <option value="role">role</option>
                                            <option value="status">status</option>
                                            <option value="age">age</option>
                                            <option value="string">string</option>
                                        </select>
                                    </label>
                                    <label>
                                        Operator
                                        <select value={selected.config.operator || '='} onChange={(e) => updateSelected({ operator: e.target.value })}>
                                            <option value="=">=</option>
                                            <option value="!=">!=</option>
                                            <option value=">">&gt;</option>
                                            <option value="<">&lt;</option>
                                            <option value="contains">contains</option>
                                            <option value="startsWith">startsWith</option>
                                            <option value="endsWith">endsWith</option>
                                        </select>
                                    </label>
                                    <label>True Label<input value={selected.config.trueLabel || 'True'} onChange={(e) => updateSelected({ trueLabel: e.target.value })} /></label>
                                    <label>False Label<input value={selected.config.falseLabel || 'False'} onChange={(e) => updateSelected({ falseLabel: e.target.value })} /></label>
                                    <label>Value<input value={selected.config.value || ''} onChange={(e) => updateSelected({ value: e.target.value })} /></label>
                                </>
                            )}

                            {selected.type === 'loop' && (
                                <label>Max Iterations<input type="number" min="1" max="50" value={selected.config.maxIterations || 3} onChange={(e) => updateSelected({ maxIterations: Number(e.target.value) || 1 })} /></label>
                            )}

                            {selected.type === 'create_record' && (
                                <>
                                    <label>Table<input value={selected.config.table || ''} onChange={(e) => updateSelected({ table: e.target.value })} /></label>
                                    <label>Payload<textarea rows={5} value={typeof selected.config.payload === 'string' ? selected.config.payload : JSON.stringify(selected.config.payload ?? {}, null, 2)} onChange={(e) => {
                                        const text = e.target.value;
                                        try { updateSelected({ payload: text.trim() ? JSON.parse(text) : {} }); } catch { updateSelected({ payload: text }); }
                                    }} /></label>
                                </>
                            )}

                            {selected.type === 'update_record' && (
                                <>
                                    <label>Table<input value={selected.config.table || ''} onChange={(e) => updateSelected({ table: e.target.value })} /></label>
                                    <label>Match<textarea rows={4} value={typeof selected.config.match === 'string' ? selected.config.match : JSON.stringify(selected.config.match ?? {}, null, 2)} onChange={(e) => {
                                        const text = e.target.value;
                                        try { updateSelected({ match: text.trim() ? JSON.parse(text) : {} }); } catch { updateSelected({ match: text }); }
                                    }} /></label>
                                    <label>Payload<textarea rows={5} value={typeof selected.config.payload === 'string' ? selected.config.payload : JSON.stringify(selected.config.payload ?? {}, null, 2)} onChange={(e) => {
                                        const text = e.target.value;
                                        try { updateSelected({ payload: text.trim() ? JSON.parse(text) : {} }); } catch { updateSelected({ payload: text }); }
                                    }} /></label>
                                </>
                            )}

                            {selected.type === 'delete_record' && (
                                <>
                                    <label>Table<input value={selected.config.table || ''} onChange={(e) => updateSelected({ table: e.target.value })} /></label>
                                    <label>Match<textarea rows={4} value={typeof selected.config.match === 'string' ? selected.config.match : JSON.stringify(selected.config.match ?? {}, null, 2)} onChange={(e) => {
                                        const text = e.target.value;
                                        try { updateSelected({ match: text.trim() ? JSON.parse(text) : {} }); } catch { updateSelected({ match: text }); }
                                    }} /></label>
                                </>
                            )}

                            {selected.type === 'subflow' && (
                                <label>
                                    Subflow
                                    <select value={selected.config.flowId || ''} onChange={(e) => updateSelected({ flowId: e.target.value })}>
                                        <option value="">Select flow</option>
                                        {flowList.filter((item) => item.id !== flow?.id).map((item) => (
                                            <option key={item.id} value={item.id}>{item.name}</option>
                                        ))}
                                    </select>
                                </label>
                            )}

                            {selected.type === 'custom_logic' && (
                                <>
                                    <label>
                                        Logic
                                        <select
                                            value={selected.config.logicId || ''}
                                            onChange={(e) => updateSelected({ logicId: e.target.value })}
                                        >
                                            {customLogic.map((entry) => (
                                                <option key={entry.id} value={entry.id}>{entry.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                </>
                            )}

                            {selected.type !== 'start' && selected.type !== 'end' && (
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
                            )}
                        </div>
                    )}
                </aside>
            </div>

            {addMenu.open && (
                <div className="fb-add-menu" style={{ left: addMenu.x, top: addMenu.y }}>
                    <input
                        placeholder="Search components..."
                        value={addMenu.query}
                        onChange={(e) => setAddMenu((prev) => ({ ...prev, query: e.target.value }))}
                        autoFocus
                    />
                    <div className="fb-add-menu-list">
                        {LIBRARY.flatMap((group) => group.items)
                            .filter((item) => item.label.toLowerCase().includes(addMenu.query.toLowerCase()))
                            .map((item) => (
                                <button
                                    key={item.key}
                                    type="button"
                                    onClick={() => {
                                        const point = screenToCanvas(addMenu.x, addMenu.y);
                                        addNodeFromItem(item, point, addMenu.from, addMenu.edge);
                                        closeAddMenu();
                                    }}
                                >
                                    {item.label}
                                </button>
                            ))}
                        <button type="button" className="fb-add-custom" onClick={() => openLogicModal({ from: addMenu.from, edge: addMenu.edge })}>
                            + Custom Logic
                        </button>
                        {customLogic.length > 0 && (
                            <div className="fb-add-sublist">
                                {customLogic.map((entry) => (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        onClick={() => {
                                            const point = screenToCanvas(addMenu.x, addMenu.y);
                                            addNodeFromItem({ nodeType: 'custom_logic', label: entry.name, help: entry.name, config: { logicId: entry.id } }, point, addMenu.from, addMenu.edge);
                                            closeAddMenu();
                                        }}
                                    >
                                        {entry.name}
                                    </button>
                                ))}
                            </div>
                        )}
                        <button type="button" className="fb-add-cancel" onClick={closeAddMenu}>Cancel</button>
                    </div>
                </div>
            )}

            {logicModal.open && (
                <div className="fb-logic-modal-backdrop">
                    <div className="fb-logic-modal">
                        <h3>Custom Logic</h3>
                        <label>
                            Name
                            <input value={logicModal.name} onChange={(e) => setLogicModal((p) => ({ ...p, name: e.target.value }))} />
                        </label>
                        <label>
                            Code
                            <textarea rows={8} value={logicModal.code} onChange={(e) => setLogicModal((p) => ({ ...p, code: e.target.value }))} placeholder="// Write logic here" />
                        </label>
                        <div className="fb-logic-actions">
                            <button type="button" className="secondary" onClick={() => setLogicModal({ open: false, name: '', code: '', from: null, edge: null })}>Cancel</button>
                            <button type="button" className="primary" onClick={saveCustomLogic}>Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}