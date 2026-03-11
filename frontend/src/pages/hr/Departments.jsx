import React, { useState, useEffect, useCallback } from 'react';
import {
    FaBuilding, FaUsers, FaSitemap, FaEdit, FaTrash,
    FaPlus, FaSearch, FaTimes, FaUserTie, FaSpinner,
    FaExclamationTriangle, FaCheckCircle, FaChevronRight
} from 'react-icons/fa';

// ─────────────────────────────────────────────────────────────────────────────
// Token resolution
//
// Your auth middleware (auth.js) checks:
//   1. req.cookies.token
//   2. Authorization: Bearer <token>
//
// Your authController login response returns: { token, user }
// Most apps store this as localStorage.setItem('token', data.token)
//
// The function below tries every realistic key your app might use.
// Open DevTools → Application → Local Storage to see which key is set,
// then put that key FIRST in CANDIDATE_KEYS.
// ─────────────────────────────────────────────────────────────────────────────
const CANDIDATE_KEYS = [
    'token',          // most common — matches authController response field name
    'authToken',
    'auth_token',
    'accessToken',
    'access_token',
    'jwt',
    'jwtToken',
    'userToken',
    'id_token',
];

const getAuthToken = () => {
    // 1 — Try each known key as a plain string
    for (const key of CANDIDATE_KEYS) {
        const raw = localStorage.getItem(key);
        if (!raw || raw === 'null' || raw === 'undefined') continue;

        // Some apps store JSON objects e.g. { token, user }
        try {
            const obj = JSON.parse(raw);
            const t = obj?.token || obj?.accessToken || obj?.access_token || obj?.jwt;
            if (t) return t;
        } catch {
            // plain string — use directly
            return raw;
        }
    }

    // 2 — Scan all keys for a value that looks like a JWT (starts with eyJ)
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const raw = localStorage.getItem(key);
        if (raw && raw.startsWith('eyJ')) return raw;
        // Try parsing JSON values too
        try {
            const obj = JSON.parse(raw);
            const candidates = [obj?.token, obj?.accessToken, obj?.jwt, obj?.access_token];
            for (const t of candidates) {
                if (t && typeof t === 'string' && t.startsWith('eyJ')) return t;
            }
        } catch { /* skip */ }
    }

    return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// API fetch helper
// Sends token as Authorization: Bearer header (matches your auth middleware).
// Also sends credentials: 'include' for cookie fallback.
// ─────────────────────────────────────────────────────────────────────────────
const API_BASE = '/api/hr';

const apiFetch = async (path, options = {}) => {
    const token = getAuthToken();

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
    };

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        credentials: 'include', // sends cookies too (req.cookies.token fallback)
    });

    if (res.status === 401) {
        throw new Error('Authentication required — please log in again.');
    }
    if (res.status === 403) {
        throw new Error('You do not have permission to perform this action.');
    }
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || `HTTP ${res.status}`);
    }
    return res.json();
};

// ─────────────────────────────────────────────────────────────────────────────
// Form defaults — only real DB columns
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
    name: '',
    description: '',
    manager_id: '',
    parent_department_id: '',
};

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const css = {
    page:        { padding: '1.5rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'inherit', position: 'relative' },
    header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' },
    h1:          { fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary,#111827)' },
    sub:         { color: 'var(--text-muted,#6b7280)', margin: 0, fontSize: '0.95rem' },
    statsGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '1rem', marginBottom: '1.5rem' },
    statCard:    { background: 'var(--bg-card,#fff)', border: '1px solid var(--border-color,#e5e7eb)', borderRadius: '0.75rem', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
    statVal:     { fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary,#4f46e5)', lineHeight: 1 },
    statLbl:     { fontSize: '0.78rem', color: 'var(--text-muted,#6b7280)', textTransform: 'uppercase', letterSpacing: '0.04em' },
    featGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '1rem', marginBottom: '1.75rem' },
    featCard:    { background: 'var(--bg-card,#fff)', border: '1px solid var(--border-color,#e5e7eb)', borderRadius: '0.75rem', padding: '1rem 1.25rem', display: 'flex', gap: '0.875rem', alignItems: 'flex-start', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
    toolbar:     { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' },
    searchBox:   { display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-card,#fff)', border: '1px solid var(--border-color,#e5e7eb)', borderRadius: '0.5rem', padding: '0.5rem 0.875rem', flex: 1, minWidth: '220px', maxWidth: '400px' },
    searchInput: { border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: '0.9rem', color: 'var(--text-primary,#111827)' },
    tableWrap:   { background: 'var(--bg-card,#fff)', border: '1px solid var(--border-color,#e5e7eb)', borderRadius: '0.75rem', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflowX: 'auto' },
    table:       { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
    thead:       { background: 'var(--bg-secondary,#f9fafb)', borderBottom: '1px solid var(--border-color,#e5e7eb)' },
    th:          { padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted,#6b7280)', whiteSpace: 'nowrap' },
    td:          { padding: '0.75rem 1rem', verticalAlign: 'middle' },
    empty:       { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '3rem 2rem', color: 'var(--text-muted,#9ca3af)', textAlign: 'center' },
    overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
    modal:       { background: 'var(--bg-primary,#fff)', borderRadius: '0.875rem', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' },
    mHead:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color,#e5e7eb)', position: 'sticky', top: 0, background: 'var(--bg-primary,#fff)', zIndex: 1 },
    mTitle:      { margin: 0, fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' },
    mBody:       { padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' },
    mRow:        { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' },
    fGroup:      { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
    label:       { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary,#374151)', textTransform: 'uppercase', letterSpacing: '0.03em' },
    inp:  (dis) => ({ padding: '0.6rem 0.75rem', border: '1px solid var(--border-color,#d1d5db)', borderRadius: '0.5rem', fontSize: '0.9rem', color: 'var(--text-primary,#111827)', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box', background: dis ? 'var(--bg-secondary,#f9fafb)' : 'var(--bg-input,#fff)', cursor: dis ? 'default' : 'auto' }),
    mFoot:       { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color,#f3f4f6)' },
    confirm:     { background: 'var(--bg-primary,#fff)', borderRadius: '0.875rem', padding: '2rem', maxWidth: '380px', width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
    toast: (t)  => ({ position: 'fixed', top: '1.25rem', right: '1.25rem', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', fontSize: '0.9rem', fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', maxWidth: '420px', background: t === 'success' ? '#ecfdf5' : '#fef2f2', color: t === 'success' ? '#065f46' : '#991b1b', border: `1px solid ${t === 'success' ? '#6ee7b7' : '#fca5a5'}` }),
    alertBox:    { background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '0.5rem', padding: '0.875rem 1rem', marginBottom: '1rem', fontSize: '0.88rem', color: '#92400e', lineHeight: 1.6 },
};

const Btn = ({ variant = 'primary', children, style, ...props }) => {
    const variants = {
        primary: { background: 'var(--primary,#4f46e5)', color: '#fff', borderColor: 'var(--primary,#4f46e5)' },
        ghost:   { background: 'transparent', color: 'var(--text-secondary,#374151)', borderColor: 'var(--border-color,#d1d5db)' },
        danger:  { background: '#ef4444', color: '#fff', borderColor: '#ef4444' },
    };
    return (
        <button
            style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.55rem 1.1rem', borderRadius: '0.5rem', fontSize: '0.9rem',
                fontWeight: 500, cursor: props.disabled ? 'not-allowed' : 'pointer',
                border: '1px solid transparent', whiteSpace: 'nowrap', fontFamily: 'inherit',
                opacity: props.disabled ? 0.55 : 1,
                ...variants[variant], ...style,
            }}
            {...props}
        >
            {children}
        </button>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
const Departments = () => {
    const [departments,  setDepartments]  = useState([]);
    const [managers,     setManagers]     = useState([]);
    const [loading,      setLoading]      = useState(true);
    const [saving,       setSaving]       = useState(false);
    const [searchTerm,   setSearchTerm]   = useState('');
    const [showModal,    setShowModal]    = useState(false);
    const [modalMode,    setModalMode]    = useState('add');
    const [selected,     setSelected]     = useState(null);
    const [formData,     setFormData]     = useState(EMPTY_FORM);
    const [toast,        setToast]        = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [authWarning,  setAuthWarning]  = useState('');

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 5000);
    }, []);

    // ── Token check on mount ───────────────────────────────────────────────────
    useEffect(() => {
        const token = getAuthToken();
        if (!token) {
            const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
            const warning = `No auth token found in localStorage. Keys present: [${keys.join(', ') || 'none'}]. ` +
                `Check your login code for localStorage.setItem(KEY, token) and add KEY to CANDIDATE_KEYS in Departments.jsx.`;
            console.error('[Departments]', warning);
            setAuthWarning(warning);
        } else {
            console.log('[Departments] Token resolved, length:', token.length);
        }
    }, []);

    // ── Fetch departments ──────────────────────────────────────────────────────
    const fetchDepartments = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiFetch('/departments');
            setDepartments(Array.isArray(data) ? data : []);
            setAuthWarning(''); // clear warning if request succeeded
        } catch (err) {
            console.error('[Departments] fetch error:', err.message);
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    // ── Fetch managers ─────────────────────────────────────────────────────────
    const fetchManagers = useCallback(async () => {
        try {
            const data = await apiFetch('/users/managers');
            setManagers(Array.isArray(data) ? data : []);
        } catch (err) {
            // Non-fatal — managers dropdown just stays empty
            console.warn('[Departments] managers fetch failed:', err.message);
        }
    }, []);

    useEffect(() => {
        fetchDepartments();
        fetchManagers();
    }, [fetchDepartments, fetchManagers]);

    // ── Create / Update ────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            showToast('Department name is required', 'error');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                name:                 formData.name.trim(),
                description:          formData.description?.trim()  || null,
                manager_id:           formData.manager_id            || null,
                parent_department_id: formData.parent_department_id  || null,
            };

            if (modalMode === 'add') {
                const created = await apiFetch('/departments', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                });
                setDepartments(prev => [...prev, created]);
                showToast(`"${created.name}" created`);
            } else {
                const updated = await apiFetch(`/departments/${selected.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(payload),
                });
                setDepartments(prev =>
                    prev.map(d => d.id === selected.id ? { ...d, ...updated } : d)
                );
                showToast(`"${updated.name}" updated`);
            }
            closeModal();
        } catch (err) {
            showToast(err.message || 'Operation failed', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ── Delete ─────────────────────────────────────────────────────────────────
    const handleDelete = async () => {
        if (!deleteTarget) return;
        setSaving(true);
        try {
            await apiFetch(`/departments/${deleteTarget.id}`, { method: 'DELETE' });
            setDepartments(prev => prev.filter(d => d.id !== deleteTarget.id));
            showToast(`"${deleteTarget.name}" deleted`);
            setDeleteTarget(null);
        } catch (err) {
            showToast(err.message || 'Delete failed', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ── Modal helpers ──────────────────────────────────────────────────────────
    const openAdd = () => { setModalMode('add'); setSelected(null); setFormData(EMPTY_FORM); setShowModal(true); };
    const openEdit = (dept, e) => {
        e?.stopPropagation();
        setModalMode('edit'); setSelected(dept);
        setFormData({ name: dept.name || '', description: dept.description || '', manager_id: dept.manager_id || '', parent_department_id: dept.parent_department_id || '' });
        setShowModal(true);
    };
    const openView = (dept) => {
        setModalMode('view'); setSelected(dept);
        setFormData({ name: dept.name || '', description: dept.description || '', manager_id: dept.manager_id || '', parent_department_id: dept.parent_department_id || '' });
        setShowModal(true);
    };
    const closeModal = () => { setShowModal(false); setSelected(null); setFormData(EMPTY_FORM); };
    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    // ── Derived ────────────────────────────────────────────────────────────────
    const filtered = departments.filter(d =>
        (d.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (d.manager_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    const getManagerLabel = (dept) => dept.manager_name || managers.find(u => u.id === dept.manager_id)?.display_name || null;
    const getParentName   = (dept) => departments.find(d => d.id === dept.parent_department_id)?.name || null;

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div style={css.page}>
            <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

            {/* Toast */}
            {toast && (
                <div style={css.toast(toast.type)}>
                    {toast.type === 'success' ? <FaCheckCircle /> : <FaExclamationTriangle />}
                    <span style={{ flex: 1 }}>{toast.message}</span>
                    <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}><FaTimes /></button>
                </div>
            )}

            {/* Auth warning banner */}
            {authWarning && (
                <div style={css.alertBox}>
                    <strong>⚠ Authentication issue detected</strong><br />
                    {authWarning}
                </div>
            )}

            {/* Delete confirm dialog */}
            {deleteTarget && (
                <div style={css.overlay}>
                    <div style={css.confirm}>
                        <FaExclamationTriangle style={{ fontSize: '2.5rem', color: '#f59e0b', marginBottom: '0.75rem' }} />
                        <h3 style={{ margin: '0 0 0.5rem' }}>Delete Department</h3>
                        <p style={{ margin: '0 0 1.5rem', color: 'var(--text-muted,#6b7280)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <Btn variant="ghost" onClick={() => setDeleteTarget(null)} disabled={saving}>Cancel</Btn>
                            <Btn variant="danger" onClick={handleDelete} disabled={saving}>
                                {saving ? <FaSpinner style={{ animation: 'spin 0.7s linear infinite' }} /> : <FaTrash />} Delete
                            </Btn>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div style={css.header}>
                <div>
                    <h1 style={css.h1}><FaBuilding /> Departments</h1>
                    <p style={css.sub}>Organise teams, assign managers, and maintain your org structure.</p>
                </div>
                <Btn variant="primary" onClick={openAdd}><FaPlus /> Add Department</Btn>
            </div>

            {/* Stats */}
            <div style={css.statsGrid}>
                {[
                    { label: 'Total',          value: departments.length },
                    { label: 'Top-level',       value: departments.filter(d => !d.parent_department_id).length },
                    { label: 'Sub-departments', value: departments.filter(d =>  d.parent_department_id).length },
                    { label: 'Has manager',     value: departments.filter(d => d.manager_id).length },
                ].map(s => (
                    <div key={s.label} style={css.statCard}>
                        <span style={css.statVal}>{s.value}</span>
                        <span style={css.statLbl}>{s.label}</span>
                    </div>
                ))}
            </div>

            {/* Feature blurbs */}
            <div style={css.featGrid}>
                {[
                    { icon: <FaSitemap />, title: 'Hierarchy',           desc: 'Build parent-child trees to mirror your org chart.' },
                    { icon: <FaUsers />,   title: 'Team visibility',      desc: 'Track manager assignments across every team.' },
                    { icon: <FaUserTie />, title: 'Manager assignments',  desc: 'Link users as department managers for clear accountability.' },
                ].map(f => (
                    <div key={f.title} style={css.featCard}>
                        <span style={{ fontSize: '1.25rem', color: 'var(--primary,#4f46e5)', flexShrink: 0, marginTop: '0.1rem' }}>{f.icon}</span>
                        <div>
                            <h3 style={{ margin: '0 0 0.2rem', fontSize: '0.95rem', fontWeight: 600 }}>{f.title}</h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted,#6b7280)', lineHeight: 1.5 }}>{f.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div style={css.toolbar}>
                <div style={css.searchBox}>
                    <FaSearch style={{ color: 'var(--text-muted,#9ca3af)', flexShrink: 0 }} />
                    <input style={css.searchInput} type="text" placeholder="Search departments or managers…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    {searchTerm && <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted,#9ca3af)', display: 'flex' }}><FaTimes /></button>}
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted,#6b7280)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                    {filtered.length} of {departments.length} departments
                </span>
            </div>

            {/* Table */}
            <div style={css.tableWrap}>
                {loading ? (
                    <div style={css.empty}>
                        <FaSpinner style={{ fontSize: '2rem', opacity: 0.4, animation: 'spin 0.7s linear infinite' }} />
                        <span>Loading departments…</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={css.empty}>
                        <FaBuilding style={{ fontSize: '2.5rem', opacity: 0.25 }} />
                        <p style={{ margin: 0 }}>{searchTerm ? 'No departments match your search.' : 'No departments yet.'}</p>
                        {!searchTerm && <Btn variant="primary" onClick={openAdd}><FaPlus /> Add Department</Btn>}
                    </div>
                ) : (
                    <table style={css.table}>
                        <thead style={css.thead}>
                        <tr>
                            {['Name', 'Description', 'Manager', 'Parent', 'Actions'].map(h => (
                                <th key={h} style={css.th}>{h}</th>
                            ))}
                        </tr>
                        </thead>
                        <tbody>
                        {filtered.map((dept, i) => {
                            const isChild = !!dept.parent_department_id;
                            return (
                                <tr key={dept.id} onClick={() => openView(dept)}
                                    style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border-color,#f3f4f6)' : 'none', cursor: 'pointer', background: isChild ? 'var(--bg-secondary,#fafafa)' : 'transparent' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary,#f9fafb)'}
                                    onMouseLeave={e => e.currentTarget.style.background = isChild ? 'var(--bg-secondary,#fafafa)' : 'transparent'}
                                >
                                    <td style={css.td}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            {isChild && <FaChevronRight style={{ color: 'var(--text-muted,#d1d5db)', fontSize: '0.7rem' }} />}
                                            <strong style={{ color: 'var(--text-primary,#111827)' }}>{dept.name}</strong>
                                        </div>
                                    </td>
                                    <td style={{ ...css.td, color: 'var(--text-secondary,#4b5563)', maxWidth: '240px' }}>
                                        {dept.description
                                            ? dept.description.length > 60 ? dept.description.substring(0, 60) + '…' : dept.description
                                            : <span style={{ color: 'var(--text-muted,#9ca3af)', fontStyle: 'italic' }}>—</span>}
                                    </td>
                                    <td style={css.td}>
                                        {getManagerLabel(dept)
                                            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.875rem' }}><FaUserTie style={{ color: 'var(--primary,#4f46e5)' }} />{getManagerLabel(dept)}</span>
                                            : <span style={{ color: 'var(--text-muted,#9ca3af)', fontStyle: 'italic' }}>Unassigned</span>}
                                    </td>
                                    <td style={css.td}>
                                        {getParentName(dept)
                                            ? <span style={{ display: 'inline-block', padding: '0.2rem 0.6rem', background: '#eff6ff', color: '#3b82f6', borderRadius: '1rem', fontSize: '0.78rem', fontWeight: 500 }}>{getParentName(dept)}</span>
                                            : <span style={{ color: 'var(--text-muted,#9ca3af)', fontStyle: 'italic' }}>Top-level</span>}
                                    </td>
                                    <td style={css.td} onClick={e => e.stopPropagation()}>
                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            <button title="Edit" onClick={e => openEdit(dept, e)} style={{ width: 32, height: 32, borderRadius: '0.4rem', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaEdit /></button>
                                            <button title="Delete" onClick={e => { e.stopPropagation(); setDeleteTarget(dept); }} style={{ width: 32, height: 32, borderRadius: '0.4rem', border: '1px solid #fecaca', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FaTrash /></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div style={css.overlay} onClick={closeModal}>
                    <div style={css.modal} onClick={e => e.stopPropagation()}>
                        <div style={css.mHead}>
                            <h2 style={css.mTitle}>
                                {modalMode === 'add'  && <><FaPlus />     Add Department</>}
                                {modalMode === 'edit' && <><FaEdit />     Edit Department</>}
                                {modalMode === 'view' && <><FaBuilding /> Department Details</>}
                            </h2>
                            <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted,#9ca3af)', fontSize: '1.1rem', display: 'flex', padding: '0.25rem' }}><FaTimes /></button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div style={css.mBody}>
                                {/* Name */}
                                <div style={css.fGroup}>
                                    <label style={css.label}>Department Name <span style={{ color: '#ef4444' }}>*</span></label>
                                    <input name="name" type="text" value={formData.name} onChange={handleChange} required disabled={modalMode === 'view'} placeholder="e.g. Engineering" style={css.inp(modalMode === 'view')} />
                                </div>

                                {/* Description */}
                                <div style={css.fGroup}>
                                    <label style={css.label}>Description</label>
                                    <textarea name="description" value={formData.description} onChange={handleChange} rows={3} disabled={modalMode === 'view'} placeholder="Briefly describe this department's purpose…" style={{ ...css.inp(modalMode === 'view'), resize: 'vertical', minHeight: '80px' }} />
                                </div>

                                {/* Manager + Parent */}
                                <div style={css.mRow}>
                                    <div style={css.fGroup}>
                                        <label style={css.label}>Manager</label>
                                        <select name="manager_id" value={formData.manager_id} onChange={handleChange} disabled={modalMode === 'view'} style={css.inp(modalMode === 'view')}>
                                            <option value="">— Unassigned —</option>
                                            {managers.map(u => (
                                                <option key={u.id} value={u.id}>{u.display_name || u.email}</option>
                                            ))}
                                            {selected?.manager_id && selected?.manager_name && !managers.find(u => u.id === selected.manager_id) && (
                                                <option value={selected.manager_id}>{selected.manager_name}</option>
                                            )}
                                        </select>
                                        {managers.length === 0 && modalMode !== 'view' && (
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted,#9ca3af)', marginTop: '0.2rem' }}>
                                                No managers loaded — check /api/hr/users/managers
                                            </span>
                                        )}
                                    </div>
                                    <div style={css.fGroup}>
                                        <label style={css.label}>Parent Department</label>
                                        <select name="parent_department_id" value={formData.parent_department_id} onChange={handleChange} disabled={modalMode === 'view'} style={css.inp(modalMode === 'view')}>
                                            <option value="">— Top-level —</option>
                                            {departments.filter(d => d.id !== selected?.id).map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* View-mode metadata */}
                                {modalMode === 'view' && selected && (
                                    <div style={{ background: 'var(--bg-secondary,#f9fafb)', borderRadius: '0.5rem', padding: '0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {[['ID', selected.id], ['Created', selected.created_at ? new Date(selected.created_at).toLocaleString() : '—'], ['Updated', selected.updated_at ? new Date(selected.updated_at).toLocaleString() : '—']].map(([k, v]) => (
                                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                                <span style={{ color: 'var(--text-muted,#9ca3af)' }}>{k}</span>
                                                <span style={{ color: 'var(--text-primary,#374151)', fontWeight: 500, wordBreak: 'break-all', maxWidth: '65%', textAlign: 'right' }}>{v}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div style={css.mFoot}>
                                {modalMode === 'view' ? (
                                    <>
                                        <Btn variant="ghost" type="button" onClick={closeModal}>Close</Btn>
                                        <Btn variant="primary" type="button" onClick={e => { closeModal(); setTimeout(() => openEdit(selected, e), 50); }}><FaEdit /> Edit</Btn>
                                    </>
                                ) : (
                                    <>
                                        <Btn variant="ghost" type="button" onClick={closeModal} disabled={saving}>Cancel</Btn>
                                        <Btn variant="primary" type="submit" disabled={saving}>
                                            {saving ? <><FaSpinner style={{ animation: 'spin 0.7s linear infinite' }} /> Saving…</> : modalMode === 'add' ? 'Create Department' : 'Save Changes'}
                                        </Btn>
                                    </>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Departments;