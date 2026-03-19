import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Loading from '../../components/common/Loading';
import api from '../../services/api';
import './UserManagement.css';

// ─── Permission sets available to assign ────────────────────────────────────
const PERMISSION_SETS = {
    business: {
        label: 'Business',
        color: '#d97706',
        permissions: ['companies:read', 'companies:write', 'reviews:read', 'analytics:read'],
        description: 'Manage company profiles'
    },
    psychologist: {
        label: 'Psychologist',
        color: '#0891b2',
        permissions: ['users:read', 'reviews:read', 'analytics:read'],
        description: 'View users and reviews'
    },
    employee: {
        label: 'Employee',
        color: '#4f46e5',
        permissions: ['reviews:read', 'reviews:write'],
        description: 'Submit and view reviews'
    }
};

const CLIENT_ROLES = ['employee', 'psychologist', 'business'];

const ALL_PERMISSIONS = [
    { key: 'users:read',      label: 'View Users',         group: 'Users' },
    { key: 'users:write',     label: 'Edit Users',         group: 'Users' },
    { key: 'users:delete',    label: 'Delete Users',       group: 'Users' },
    { key: 'companies:read',  label: 'View Companies',     group: 'Companies' },
    { key: 'companies:write', label: 'Edit Companies',     group: 'Companies' },
    { key: 'reviews:read',    label: 'View Reviews',       group: 'Reviews' },
    { key: 'reviews:write',   label: 'Edit Reviews',       group: 'Reviews' },
    { key: 'hr:read',         label: 'View HR Data',       group: 'HR' },
    { key: 'hr:write',        label: 'Edit HR Data',       group: 'HR' },
    { key: 'analytics:read',  label: 'View Analytics',     group: 'Analytics' },
    { key: 'settings:write',  label: 'Edit Settings',      group: 'System' },
];

// ─── UserModal: create / edit a user ────────────────────────────────────────
const UserModal = ({ user, onClose, onSaved }) => {
    const isEdit = !!user;
    const [form, setForm] = useState({
        email:       user?.email       ?? '',
        displayName: user?.display_name ?? '',
        role:        user?.role        ?? 'employee',
        password:    '',
        isActive:    user?.is_active   ?? true,
        permissions: user?.permissions ?? PERMISSION_SETS['employee'].permissions,
    });
    const [saving, setSaving] = useState(false);
    const [customPerms, setCustomPerms] = useState(false);

    // Sync permissions when role changes (unless user has manually customised)
    const handleRoleChange = (role) => {
        setForm(f => ({
            ...f,
            role,
            permissions: customPerms ? f.permissions : (PERMISSION_SETS[role]?.permissions ?? [])
        }));
    };

    const togglePerm = (key) => {
        setCustomPerms(true);
        setForm(f => ({
            ...f,
            permissions: f.permissions.includes(key)
                ? f.permissions.filter(p => p !== key)
                : [...f.permissions, key]
        }));
    };

    const applyPreset = (role) => {
        setCustomPerms(false);
        setForm(f => ({ ...f, permissions: PERMISSION_SETS[role]?.permissions ?? [] }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.email) return toast.error('Email is required');
        if (!isEdit && !form.password) return toast.error('Password is required for new users');
        if (!isEdit && form.password.length < 8) return toast.error('Password must be at least 8 characters');

        setSaving(true);
        try {
            const payload = {
                email:       form.email,
                displayName: form.displayName,
                role:        form.role,
                isActive:    form.isActive,
                permissions: form.permissions,
                ...(form.password ? { password: form.password } : {})
            };

            if (isEdit) {
                await api.put(`/admin/users/${user.id}`, payload);
                toast.success('User updated successfully');
            } else {
                await api.post('/admin/users', payload);
                toast.success('User created successfully');
            }
            onSaved();
            onClose();
        } catch (err) {
            toast.error(err?.response?.data?.error || 'Failed to save user');
        } finally {
            setSaving(false);
        }
    };

    // Group permissions for display
    const grouped = ALL_PERMISSIONS.reduce((acc, p) => {
        (acc[p.group] = acc[p.group] || []).push(p);
        return acc;
    }, {});

    const hasAll = form.permissions.includes('*');

    return (
        <div className="um-modal-backdrop" onClick={onClose}>
            <div className="um-modal" onClick={e => e.stopPropagation()}>
                <div className="um-modal-header">
                    <h2>{isEdit ? `Edit User` : 'Create New User'}</h2>
                    <button className="um-close-btn" onClick={onClose}>✕</button>
                </div>

                <form className="um-modal-body" onSubmit={handleSubmit}>
                    {/* Basic Info */}
                    <div className="um-section-title">Account Details</div>
                    <div className="um-form-row">
                        <div className="um-field">
                            <label>Email *</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                placeholder="user@example.com"
                                required
                            />
                        </div>
                        <div className="um-field">
                            <label>Display Name</label>
                            <input
                                type="text"
                                value={form.displayName}
                                onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                                placeholder="Full name"
                            />
                        </div>
                    </div>

                    <div className="um-form-row">
                        <div className="um-field">
                            <label>{isEdit ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                            <input
                                type="password"
                                value={form.password}
                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                placeholder={isEdit ? 'Leave blank to keep current' : 'Min 8 characters'}
                                minLength={form.password ? 8 : undefined}
                            />
                        </div>
                        <div className="um-field">
                            <label>Status</label>
                            <div className="um-toggle-row">
                                <label className="um-toggle">
                                    <input
                                        type="checkbox"
                                        checked={form.isActive}
                                        onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                                    />
                                    <span className="um-toggle-slider" />
                                </label>
                                <span className={form.isActive ? 'status-active' : 'status-inactive'}>
                                    {form.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Role */}
                    <div className="um-section-title">Role</div>
                    <div className="um-role-grid">
                        {Object.entries(PERMISSION_SETS).map(([key, set]) => (
                            <button
                                key={key}
                                type="button"
                                className={`um-role-card ${form.role === key ? 'selected' : ''}`}
                                style={{ '--role-color': set.color }}
                                onClick={() => handleRoleChange(key)}
                            >
                                <span className="um-role-badge" style={{ background: set.color }}>{set.label}</span>
                                <span className="um-role-desc">{set.description}</span>
                            </button>
                        ))}
                    </div>

                    {/* Permissions */}
                    <div className="um-section-title">
                        Permissions
                        <span className="um-section-hint">
                            Quick presets:
                            {Object.entries(PERMISSION_SETS).slice(0, 4).map(([k, s]) => (
                                <button key={k} type="button" className="um-preset-btn" onClick={() => applyPreset(k)}>
                                    {s.label}
                                </button>
                            ))}
                        </span>
                    </div>

                    {hasAll ? (
                        <div className="um-all-perms-badge">⭐ Full System Access (all permissions)</div>
                    ) : (
                        <div className="um-perms-grid">
                            {Object.entries(grouped).map(([group, perms]) => (
                                <div key={group} className="um-perm-group">
                                    <div className="um-perm-group-label">{group}</div>
                                    {perms.map(p => (
                                        <label key={p.key} className="um-perm-item">
                                            <input
                                                type="checkbox"
                                                checked={form.permissions.includes(p.key)}
                                                onChange={() => togglePerm(p.key)}
                                            />
                                            {p.label}
                                        </label>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="um-modal-footer">
                        <button type="button" className="um-btn-ghost" onClick={onClose} disabled={saving}>
                            Cancel
                        </button>
                        <button type="submit" className="um-btn-primary" disabled={saving}>
                            {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create User')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── ConfirmModal ────────────────────────────────────────────────────────────
const ConfirmModal = ({ title, message, onConfirm, onClose, danger = true }) => (
    <div className="um-modal-backdrop" onClick={onClose}>
        <div className="um-modal um-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="um-modal-header">
                <h2>{title}</h2>
                <button className="um-close-btn" onClick={onClose}>✕</button>
            </div>
            <div className="um-modal-body">
                <p className="um-confirm-msg">{message}</p>
            </div>
            <div className="um-modal-footer">
                <button className="um-btn-ghost" onClick={onClose}>Cancel</button>
                <button className={danger ? 'um-btn-danger' : 'um-btn-primary'} onClick={onConfirm}>
                    Confirm
                </button>
            </div>
        </div>
    </div>
);

// ─── Main UserManagement component ──────────────────────────────────────────
const UserManagement = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated, loading: authLoading } = useAuth();

    const [adminProfile, setAdminProfile]     = useState(null);
    const [checkingAdmin, setCheckingAdmin]   = useState(true);
    const [users, setUsers]                   = useState([]);
    const [loadingUsers, setLoadingUsers]     = useState(false);
    const [selectedUsers, setSelectedUsers]   = useState([]);
    const [showModal, setShowModal]           = useState(false);
    const [editingUser, setEditingUser]       = useState(null);
    const [deleteTarget, setDeleteTarget]     = useState(null); // single user or 'bulk'
    const [filters, setFilters]               = useState({ search: '', role: '', isActive: '' });
    const [pagination, setPagination]         = useState({ page: 1, limit: 15, total: 0, totalPages: 0 });
    const [resetTarget, setResetTarget]       = useState(null);
    const [newPasswordInput, setNewPasswordInput] = useState('');

    // ── Auth + admin gate ──────────────────────────────────────────────────
    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated || !user) {
            navigate('/login', { replace: true, state: { from: '/admin/users' } });
            return;
        }

        (async () => {
            try {
                const { data } = await api.get('/admin/profile');
                const profile = data?.data ?? data;
                if (profile?.role_name || profile?.id) {
                    setAdminProfile(profile);
                } else {
                    toast.error('You do not have admin access');
                    navigate('/dashboard', { replace: true });
                }
            } catch (err) {
                if (err.response?.status === 403) {
                    toast.error('You do not have admin access');
                    navigate('/dashboard', { replace: true });
                } else if (err.response?.status === 401) {
                    navigate('/login', { replace: true, state: { from: '/admin/users' } });
                } else {
                    toast.error('Error verifying admin access');
                }
            } finally {
                setCheckingAdmin(false);
            }
        })();
    }, [authLoading, isAuthenticated, user]);

    // ── Fetch users ────────────────────────────────────────────────────────
    const fetchUsers = useCallback(async () => {
        setLoadingUsers(true);
        try {
            const params = new URLSearchParams({
                page:  pagination.page,
                limit: pagination.limit,
                ...(filters.search   ? { search:   filters.search   } : {}),
                ...(filters.role     ? { role:     filters.role     } : {}),
                ...(filters.isActive ? { isActive: filters.isActive } : {}),
            });

            const { data } = await api.get(`/admin/users?${params}`);
            // Support both { success, data: { users, total } } and { users, pagination }
            const usersArr = data?.data?.users ?? data?.users ?? [];
            const clientUsers = usersArr.filter((userRow) =>
                CLIENT_ROLES.includes(String(userRow.role || '').toLowerCase())
            );

            setUsers(clientUsers);
            setPagination(p => ({
                ...p,
                total: clientUsers.length,
                totalPages: Math.ceil(clientUsers.length / p.limit)
            }));
        } catch (err) {
            toast.error('Failed to load users');
            setUsers([]);
        } finally {
            setLoadingUsers(false);
        }
    }, [pagination.page, pagination.limit, filters]);

    useEffect(() => {
        if (adminProfile) fetchUsers();
    }, [adminProfile, fetchUsers]);

    // ── Handlers ───────────────────────────────────────────────────────────
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(f => ({ ...f, [name]: value }));
        setPagination(p => ({ ...p, page: 1 }));
    };

    const handleDeleteUser = async () => {
        try {
            if (deleteTarget === 'bulk') {
                await api.post('/admin/users/bulk-delete', { userIds: selectedUsers });
                toast.success(`${selectedUsers.length} users deleted`);
                setSelectedUsers([]);
            } else {
                await api.delete(`/admin/users/${deleteTarget.id}`);
                toast.success('User deleted successfully');
            }
            setDeleteTarget(null);
            fetchUsers();
        } catch (err) {
            toast.error(err?.response?.data?.error || 'Failed to delete user');
        }
    };

    const handleResetPassword = async () => {
        if (!newPasswordInput || newPasswordInput.length < 8) {
            return toast.error('Password must be at least 8 characters');
        }
        try {
            await api.post('/admin/users/reset-password', {
                userId: resetTarget.id,
                newPassword: newPasswordInput
            });
            toast.success('Password reset successfully');
            setResetTarget(null);
            setNewPasswordInput('');
        } catch (err) {
            toast.error(err?.response?.data?.error || 'Failed to reset password');
        }
    };

    const toggleSelectAll = () => {
        setSelectedUsers(selectedUsers.length === users.length ? [] : users.map(u => u.id));
    };

    const toggleSelect = (id) => {
        setSelectedUsers(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    // ── Loading states ─────────────────────────────────────────────────────
    if (authLoading || checkingAdmin) return <Loading text="Verifying access…" />;
    if (!adminProfile) return null;

    const roleKeys = Object.keys(PERMISSION_SETS);

    return (
        <div className="um-page">
            {/* ── Header ── */}
            <div className="um-page-header">
                <div>
                    <h1>User Management</h1>
                    <p className="um-subtitle">
                        {pagination.total} total user{pagination.total !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className="um-header-actions">
                    <button className="um-btn-ghost" onClick={fetchUsers} disabled={loadingUsers}>
                        ↻ Refresh
                    </button>
                    <button className="um-btn-primary" onClick={() => { setEditingUser(null); setShowModal(true); }}>
                        + Create User
                    </button>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="um-filters">
                <input
                    type="text"
                    name="search"
                    placeholder="Search by name or email…"
                    value={filters.search}
                    onChange={handleFilterChange}
                    className="um-search-input"
                />
                <select name="role" value={filters.role} onChange={handleFilterChange} className="um-select">
                    <option value="">All Client Types</option>
                    {roleKeys.map(k => (
                        <option key={k} value={k}>{PERMISSION_SETS[k].label}</option>
                    ))}
                </select>
                <select name="isActive" value={filters.isActive} onChange={handleFilterChange} className="um-select">
                    <option value="">All Status</option>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                </select>

                {selectedUsers.length > 0 && (
                    <div className="um-bulk-bar">
                        <span>{selectedUsers.length} selected</span>
                        <button
                            className="um-btn-danger-sm"
                            onClick={() => setDeleteTarget('bulk')}
                        >
                            🗑 Delete Selected
                        </button>
                    </div>
                )}
            </div>

            {/* ── Table ── */}
            {loadingUsers ? (
                <Loading text="Loading users…" />
            ) : users.length === 0 ? (
                <div className="um-empty">
                    <span>👥</span>
                    <p>No users found</p>
                </div>
            ) : (
                <div className="um-table-wrap">
                    <table className="um-table">
                        <thead>
                        <tr>
                            <th className="um-th-check">
                                <input
                                    type="checkbox"
                                    checked={selectedUsers.length === users.length && users.length > 0}
                                    onChange={toggleSelectAll}
                                />
                            </th>
                            <th>User</th>
                            <th>Client Type</th>
                            <th>Permissions</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {users.map(u => {
                            const roleSet   = PERMISSION_SETS[u.role];
                            const perms     = u.permissions ?? roleSet?.permissions ?? [];
                            const hasAll    = perms.includes('*');
                            const permCount = hasAll ? 'Full access' : `${perms.length} permission${perms.length !== 1 ? 's' : ''}`;
                            const isActive  = u.is_active !== false;

                            return (
                                <tr key={u.id} className={selectedUsers.includes(u.id) ? 'um-row-selected' : ''}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={selectedUsers.includes(u.id)}
                                            onChange={() => toggleSelect(u.id)}
                                        />
                                    </td>
                                    <td>
                                        <div className="um-user-cell">
                                            <div className="um-avatar" style={{ background: roleSet?.color ?? '#6b7280' }}>
                                                {(u.display_name || u.email || '?')[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="um-user-name">{u.display_name || '—'}</div>
                                                <div className="um-user-email">{u.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                            <span
                                                className="um-role-pill"
                                                style={{ background: roleSet?.color + '20', color: roleSet?.color ?? '#6b7280', borderColor: roleSet?.color + '40' }}
                                            >
                                                {roleSet?.label ?? u.role}
                                            </span>
                                    </td>
                                    <td>
                                            <span className={`um-perm-summary ${hasAll ? 'um-perm-all' : ''}`}>
                                                {permCount}
                                            </span>
                                    </td>
                                    <td>
                                            <span className={`um-status-pill ${isActive ? 'um-status-active' : 'um-status-inactive'}`}>
                                                {isActive ? '● Active' : '○ Inactive'}
                                            </span>
                                    </td>
                                    <td className="um-date-cell">
                                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                                    </td>
                                    <td>
                                        <div className="um-action-btns">
                                            <button
                                                className="um-action-btn um-edit-btn"
                                                title="Edit user"
                                                onClick={() => { setEditingUser(u); setShowModal(true); }}
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="um-action-btn um-key-btn"
                                                title="Reset password"
                                                onClick={() => { setResetTarget(u); setNewPasswordInput(''); }}
                                            >
                                                🔑
                                            </button>
                                            <button
                                                className="um-action-btn um-del-btn"
                                                title="Delete user"
                                                onClick={() => setDeleteTarget(u)}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Pagination ── */}
            {pagination.totalPages > 1 && (
                <div className="um-pagination">
                    <button
                        className="um-page-btn"
                        disabled={pagination.page === 1 || loadingUsers}
                        onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                    >
                        ← Previous
                    </button>
                    <span className="um-page-info">
                        Page {pagination.page} of {pagination.totalPages}
                        <span className="um-page-total"> ({pagination.total} users)</span>
                    </span>
                    <button
                        className="um-page-btn"
                        disabled={pagination.page === pagination.totalPages || loadingUsers}
                        onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                    >
                        Next →
                    </button>
                </div>
            )}

            {/* ── Create / Edit Modal ── */}
            {showModal && (
                <UserModal
                    user={editingUser}
                    onClose={() => { setShowModal(false); setEditingUser(null); }}
                    onSaved={fetchUsers}
                />
            )}

            {/* ── Delete Confirm ── */}
            {deleteTarget && (
                <ConfirmModal
                    title="Confirm Deletion"
                    message={
                        deleteTarget === 'bulk'
                            ? `Delete ${selectedUsers.length} users? This cannot be undone.`
                            : `Delete "${deleteTarget.display_name || deleteTarget.email}"? This cannot be undone.`
                    }
                    onConfirm={handleDeleteUser}
                    onClose={() => setDeleteTarget(null)}
                />
            )}

            {/* ── Reset Password Modal ── */}
            {resetTarget && (
                <div className="um-modal-backdrop" onClick={() => setResetTarget(null)}>
                    <div className="um-modal um-modal-sm" onClick={e => e.stopPropagation()}>
                        <div className="um-modal-header">
                            <h2>Reset Password</h2>
                            <button className="um-close-btn" onClick={() => setResetTarget(null)}>✕</button>
                        </div>
                        <div className="um-modal-body">
                            <p style={{ marginBottom: '1rem', color: '#4a5568' }}>
                                Setting new password for <strong>{resetTarget.display_name || resetTarget.email}</strong>
                            </p>
                            <input
                                type="password"
                                placeholder="New password (min 8 characters)"
                                value={newPasswordInput}
                                onChange={e => setNewPasswordInput(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div className="um-modal-footer">
                            <button className="um-btn-ghost" onClick={() => setResetTarget(null)}>Cancel</button>
                            <button className="um-btn-primary" onClick={handleResetPassword}>Reset Password</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
