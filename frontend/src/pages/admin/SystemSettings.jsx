import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import AvatarImage from '../../components/common/AvatarImage';
import './SystemSettings.css';

const DEFAULT_SETTINGS = {
    siteName: 'Welp Hub',
    siteUrl: 'https://welphub.onrender.com',
    maintenanceMode: false,
    registrationEnabled: true,
    defaultUserRole: 'employee',
    sessionTimeout: 30,
    inactivityTimeoutMinutes: 30,
    autoLogoutEnabled: false,
    maxLoginAttempts: 5,
    twoFactorAuth: false,
    emailNotifications: true,
    backupFrequency: 'daily',
    logsRetention: '30 days',
    systemEmail: '',
    companyName: '',
    timezone: 'UTC',
    dateFormat: 'MM/DD/YYYY'
};

const KEY_MAP = {
    siteName: 'site_name',
    siteUrl: 'site_url',
    maintenanceMode: 'maintenance_mode',
    registrationEnabled: 'registration_enabled',
    defaultUserRole: 'default_user_role',
    sessionTimeout: 'session_timeout',
    inactivityTimeoutMinutes: 'inactivity_timeout_minutes',
    autoLogoutEnabled: 'auto_logout_enabled',
    maxLoginAttempts: 'max_login_attempts',
    twoFactorAuth: 'two_factor_auth',
    emailNotifications: 'email_notifications',
    backupFrequency: 'backup_frequency',
    logsRetention: 'logs_retention',
    systemEmail: 'system_email',
    companyName: 'company_name',
    timezone: 'timezone',
    dateFormat: 'date_format'
};

const REVERSE_KEY_MAP = Object.fromEntries(
    Object.entries(KEY_MAP).map(([uiKey, backendKey]) => [backendKey, uiKey])
);

const ROLE_OPTIONS = [
    { value: 'admin', label: 'Admin' },
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'hr_admin', label: 'HR Admin' },
    { value: 'psychologist', label: 'Psychologist' },
    { value: 'business', label: 'Business' },
    { value: 'employee', label: 'Employee' }
];

const ADMIN_ROLE_SET = new Set(['admin', 'super_admin', 'hr_admin']);

const TAB_OPTIONS = [
    { id: 'admins', label: 'Admin Management' },
    { id: 'general', label: 'General' },
    { id: 'security', label: 'Security' },
    { id: 'session', label: 'Session Management' },
    { id: 'system', label: 'System' }
];

const FIELD_GROUPS = {
    general: [
        { name: 'siteName', label: 'Site Name', type: 'text', placeholder: 'Welp Hub' },
        { name: 'siteUrl', label: 'Primary URL', type: 'url', placeholder: 'https://welphub.onrender.com' },
        { name: 'companyName', label: 'Company Name', type: 'text', placeholder: 'Welp Hub Inc.' },
        { name: 'systemEmail', label: 'System Email', type: 'email', placeholder: 'no-reply@welphub.com' },
        {
            name: 'timezone',
            label: 'Timezone',
            type: 'select',
            options: [
                { value: 'UTC', label: 'UTC' },
                { value: 'America/New_York', label: 'Eastern Time (ET)' },
                { value: 'America/Chicago', label: 'Central Time (CT)' },
                { value: 'America/Denver', label: 'Mountain Time (MT)' },
                { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' }
            ]
        },
        {
            name: 'dateFormat',
            label: 'Date Format',
            type: 'select',
            options: [
                { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }
            ]
        },
        {
            name: 'maintenanceMode',
            label: 'Enable Maintenance Mode',
            type: 'checkbox',
            helper: 'Blocks all user traffic except admins while maintenance is running.'
        },
        {
            name: 'registrationEnabled',
            label: 'Allow New User Registrations',
            type: 'checkbox',
            helper: 'Disable to temporarily prevent new accounts.'
        },
        {
            name: 'defaultUserRole',
            label: 'Default Role',
            type: 'select',
            options: [
                { value: 'employee', label: 'Employee' },
                { value: 'psychologist', label: 'Psychologist' },
                { value: 'business', label: 'Business' },
                { value: 'admin', label: 'Admin' },
                { value: 'super_admin', label: 'Super Admin' },
                { value: 'hr_admin', label: 'HR Admin' }
            ]
        }
    ],
    security: [
        {
            name: 'maxLoginAttempts',
            label: 'Max Login Attempts',
            type: 'number',
            min: 1,
            max: 10,
            helper: 'Account will be temporarily locked after exceeding this number.'
        },
        {
            name: 'twoFactorAuth',
            label: 'Require Two-Factor Authentication',
            type: 'checkbox'
        },
        {
            name: 'emailNotifications',
            label: 'Notify On Suspicious Logins',
            type: 'checkbox'
        }
    ],
    session: [
        {
            name: 'inactivityTimeoutMinutes',
            label: 'Inactivity Timeout (minutes)',
            type: 'number',
            min: 5,
            max: 240,
            helper: 'Suggested values: 5, 10, 15, 30, 60 minutes.'
        },
        {
            name: 'autoLogoutEnabled',
            label: 'Enable Auto Logout',
            type: 'checkbox',
            helper: 'Automatically sign out inactive users across all tabs.'
        }
    ],
    system: [
        {
            name: 'backupFrequency',
            label: 'Backup Frequency',
            type: 'select',
            options: [
                { value: 'hourly', label: 'Hourly' },
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' }
            ]
        },
        {
            name: 'logsRetention',
            label: 'Log Retention',
            type: 'select',
            options: [
                { value: '7 days', label: '7 days' },
                { value: '30 days', label: '30 days' },
                { value: '90 days', label: '90 days' },
                { value: '1 year', label: '1 year' }
            ]
        }
    ]
};

const FIELD_META = Object.values(FIELD_GROUPS)
    .flat()
    .reduce((acc, field) => ({ ...acc, [field.name]: field }), {});
const safeParseValue = (value) => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'object') return value;
    if (typeof value === 'boolean' || typeof value === 'number') return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
};

const normalizeSettingsPayload = (raw = {}) => {
    const normalized = { ...DEFAULT_SETTINGS };
    if (Array.isArray(raw)) {
        raw.forEach((item) => {
            if (!item || item.key === undefined) return;
            const uiKey = REVERSE_KEY_MAP[item.key] || item.key;
            if (!uiKey || !(uiKey in normalized)) return;
            normalized[uiKey] = safeParseValue(item.value);
        });
        return normalized;
    }
    Object.entries(raw).forEach(([backendKey, storedValue]) => {
        const uiKey = REVERSE_KEY_MAP[backendKey] || backendKey;
        if (!uiKey || !(uiKey in normalized)) return;
        const field = FIELD_META[uiKey];
        let parsed = safeParseValue(storedValue);
        if (field?.type === 'number' && parsed !== '' && parsed !== null && parsed !== undefined) {
            parsed = Number(parsed);
        }
        if (field?.type === 'checkbox') {
            parsed = Boolean(parsed);
        }
        normalized[uiKey] = parsed;
    });
    return normalized;
};

const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const formatDate = (value) => (value ? new Date(value).toLocaleString() : 'Never');

const getAdminInitials = (admin) => {
    if (admin?.display_name) {
        const [first, second] = admin.display_name.split(' ');
        const initials = `${first?.[0] || ''}${second?.[0] || ''}`.trim();
        return initials.toUpperCase() || 'A';
    }
    return (admin?.email?.[0] || 'A').toUpperCase();
};

const ADMIN_FORM_DEFAULT = {
    displayName: '',
    email: '',
    role: 'admin',
    password: '',
    confirmPassword: '',
    isActive: true
};
const SystemSettings = () => {
    const [activeTab, setActiveTab] = useState('admins');
    const [admins, setAdmins] = useState([]);
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [savedSettings, setSavedSettings] = useState(DEFAULT_SETTINGS);
    const [loadingStates, setLoadingStates] = useState({ admins: false, settings: false, action: false });
    const [feedback, setFeedback] = useState({ success: '', error: '' });
    const [showModal, setShowModal] = useState(false);
    const [adminForm, setAdminForm] = useState(ADMIN_FORM_DEFAULT);
    const [selectedAdmin, setSelectedAdmin] = useState(null);

    const setLoading = (key, value) => {
        setLoadingStates((prev) => ({ ...prev, [key]: value }));
    };

    const showError = (message) => setFeedback({ success: '', error: message });
    const showSuccess = (message) => setFeedback({ error: '', success: message });

    useEffect(() => {
        if (!feedback.error && !feedback.success) return undefined;
        const timer = setTimeout(() => setFeedback({ success: '', error: '' }), 4000);
        return () => clearTimeout(timer);
    }, [feedback]);

    const fetchSettings = useCallback(async () => {
        setLoading('settings', true);
        try {
            const { data } = await api.get('/admin/settings');
            const normalized = normalizeSettingsPayload(data);
            setSettings(normalized);
            setSavedSettings(normalized);
        } catch (error) {
            console.error('Settings fetch failed', error);
            showError(error?.response?.data?.error || 'Failed to load settings');
        } finally {
            setLoading('settings', false);
        }
    }, []);

    const fetchAdmins = useCallback(async () => {
        setLoading('admins', true);
        try {
            const { data } = await api.get('/admin/users', {
                params: { limit: 50 }
            });
            const users = data?.data?.users || data?.users || [];
            const filtered = users.filter((user) => ADMIN_ROLE_SET.has(String(user.role || '').toLowerCase()));
            setAdmins(filtered);
        } catch (error) {
            console.error('Admins fetch failed', error);
            showError(error?.response?.data?.error || 'Failed to load admins');
        } finally {
            setLoading('admins', false);
        }
    }, []);

    useEffect(() => {
        fetchAdmins();
        fetchSettings();
    }, [fetchAdmins, fetchSettings]);

    const handleSettingChange = (event) => {
        const { name, value, type, checked } = event.target;
        setSettings((prev) => {
            let nextValue = value;
            if (type === 'checkbox') {
                nextValue = checked;
            } else if (type === 'number') {
                nextValue = value === '' ? '' : Number(value);
            }
            return { ...prev, [name]: nextValue };
        });
    };

    const settingsDiff = useMemo(() => {
        const diff = [];
        Object.entries(settings).forEach(([uiKey, currentValue]) => {
            const previousValue = savedSettings[uiKey];
            if (!deepEqual(currentValue, previousValue)) {
                diff.push({
                    key: KEY_MAP[uiKey] || uiKey,
                    value: currentValue
                });
            }
        });
        return diff;
    }, [settings, savedSettings]);

    const persistSettings = async (entries) => {
        if (!entries.length) return;
        const requestBody = { entries };
        console.log('Sending settings update:', JSON.stringify(requestBody, null, 2));
        try {
            const { data } = await api.patch('/admin/settings', requestBody);
            console.log('Settings update response:', data);
            return data;
        } catch (error) {
            console.error('Settings update API error:', error);
            console.error('Error response:', error.response?.data);
            console.error('Error status:', error.response?.status);
            console.error('Error headers:', error.response?.headers);
            throw error;
        }
    };
    const handleSaveSettings = async () => {
        if (settingsDiff.length === 0) {
            showSuccess('No changes to save');
            return;
        }
        setLoading('action', true);
        try {
            const response = await persistSettings(settingsDiff);
            const payload = response?.settings || response?.data?.settings || null;
            if (payload) {
                const normalized = normalizeSettingsPayload(payload);
                setSavedSettings(normalized);
                setSettings(normalized);
            } else {
                setSavedSettings(settings);
            }
            showSuccess('Settings updated');
        } catch (error) {
            console.error('Settings save failed', error);
            showError(error?.response?.data?.error || 'Failed to save settings');
        } finally {
            setLoading('action', false);
        }
    };

    const handleResetSettings = async () => {
        if (!window.confirm('Reset all settings to default values?')) return;
        const defaultEntries = Object.entries(DEFAULT_SETTINGS).map(([uiKey, value]) => ({
            key: KEY_MAP[uiKey] || uiKey,
            value
        }));
        setLoading('action', true);
        try {
            await persistSettings(defaultEntries);
            setSettings(DEFAULT_SETTINGS);
            setSavedSettings(DEFAULT_SETTINGS);
            showSuccess('Settings reset to defaults');
        } catch (error) {
            console.error('Reset failed', error);
            showError(error?.response?.data?.error || 'Failed to reset settings');
        } finally {
            setLoading('action', false);
        }
    };

    const openModal = (admin = null) => {
        if (admin) {
            setSelectedAdmin(admin);
            setAdminForm({
                displayName: admin.display_name || admin.displayName || '',
                email: admin.email,
                role: admin.role || 'admin',
                password: '',
                confirmPassword: '',
                isActive: admin.is_active !== false
            });
        } else {
            setSelectedAdmin(null);
            setAdminForm(ADMIN_FORM_DEFAULT);
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedAdmin(null);
        setAdminForm(ADMIN_FORM_DEFAULT);
    };

    const handleAdminFormChange = (event) => {
        const { name, value, type, checked } = event.target;
        setAdminForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };
    const handleAdminSubmit = async (event) => {
        event.preventDefault();
        if (adminForm.password !== adminForm.confirmPassword) {
            showError('Passwords do not match');
            return;
        }
        if (!selectedAdmin && !adminForm.password) {
            showError('Password is required for new admins');
            return;
        }
        setLoading('action', true);
        try {
            if (selectedAdmin) {
                const payload = {
                    displayName: adminForm.displayName,
                    role: adminForm.role,
                    isActive: adminForm.isActive
                };
                if (adminForm.password) {
                    payload.password = adminForm.password;
                }
                const { data } = await api.patch(`/admin/users/${selectedAdmin.id}`, payload);
                const updated = data?.data || data;
                setAdmins((prev) =>
                    prev.map((admin) => (admin.id === updated.id ? updated : admin))
                );
                showSuccess('Admin updated successfully');
            } else {
                const payload = {
                    email: adminForm.email,
                    password: adminForm.password,
                    displayName: adminForm.displayName || adminForm.email.split('@')[0],
                    role: adminForm.role,
                    isActive: adminForm.isActive
                };
                try {
                    const { data } = await api.post('/admin/users', payload);
                    const created = data?.data || data;
                    setAdmins((prev) => [created, ...prev]);
                    showSuccess('Admin created successfully');
                } catch (error) {
                    const apiError = error?.response?.data?.error || '';
                    if (apiError !== 'Email already exists') {
                        throw error;
                    }
                    const { data: searchData } = await api.get('/admin/users', {
                        params: { search: adminForm.email, limit: 5 }
                    });
                    const candidates = searchData?.data?.users || searchData?.users || [];
                    const existing = candidates.find(
                        (user) => String(user.email || '').toLowerCase() === adminForm.email.toLowerCase()
                    );
                    if (!existing) {
                        throw error;
                    }
                    const updatePayload = {
                        displayName: adminForm.displayName || existing.display_name,
                        role: adminForm.role,
                        isActive: adminForm.isActive
                    };
                    if (adminForm.password) {
                        updatePayload.password = adminForm.password;
                    }
                    const { data: updatedData } = await api.patch(`/admin/users/${existing.id}`, updatePayload);
                    const updated = updatedData?.data || updatedData;
                    setAdmins((prev) => {
                        const next = prev.filter((admin) => admin.id !== updated.id);
                        if (ADMIN_ROLE_SET.has(String(updated.role || '').toLowerCase())) {
                            return [updated, ...next];
                        }
                        return next;
                    });
                    showSuccess('Admin updated successfully');
                }
            }
            closeModal();
        } catch (error) {
            console.error('Admin mutation failed', error);
            showError(error?.response?.data?.error || 'Unable to process admin request');
        } finally {
            setLoading('action', false);
        }
    };

    const handleDeleteAdmin = async (adminId) => {
        if (!window.confirm('Delete this admin account?')) return;
        setLoading('action', true);
        try {
            await api.delete(`/admin/users/${adminId}`);
            setAdmins((prev) => prev.filter((admin) => admin.id !== adminId));
            showSuccess('Admin deleted');
        } catch (error) {
            console.error('Delete admin failed', error);
            showError(error?.response?.data?.error || 'Failed to delete admin');
        } finally {
            setLoading('action', false);
        }
    };

    const handleToggleStatus = async (admin) => {
        const nextStatus = !admin.is_active;
        setLoading('action', true);
        try {
            const { data } = await api.patch(`/admin/users/${admin.id}`, {
                isActive: nextStatus
            });
            const updated = data?.data || data;
            setAdmins((prev) =>
                prev.map((current) => (current.id === admin.id ? updated : current))
            );
            showSuccess(`Admin ${nextStatus ? 'activated' : 'deactivated'}`);
        } catch (error) {
            console.error('Status toggle failed', error);
            showError(error?.response?.data?.error || 'Failed to update status');
        } finally {
            setLoading('action', false);
        }
    };

    const handleRoleChange = async (admin, newRole) => {
        setLoading('action', true);
        try {
            const { data } = await api.patch(`/admin/users/${admin.id}`, {
                role: newRole
            });
            const updated = data?.data || data;
            setAdmins((prev) =>
                prev.map((current) => (current.id === admin.id ? updated : current))
            );
            showSuccess('Role updated');
        } catch (error) {
            console.error('Role update failed', error);
            showError(error?.response?.data?.error || 'Failed to update role');
        } finally {
            setLoading('action', false);
        }
    };
    const renderField = (field) => {
        const value = settings[field.name];
        const disabled = loadingStates.settings || loadingStates.action;
        if (field.type === 'checkbox') {
            return (
                <div className="settings-field field-checkbox" key={field.name}>
                    <label className="toggle-control">
                        <input
                            type="checkbox"
                            name={field.name}
                            checked={Boolean(value)}
                            onChange={handleSettingChange}
                            disabled={disabled}
                        />
                        <span>{field.label}</span>
                    </label>
                    {field.helper && <p className="field-helper">{field.helper}</p>}
                </div>
            );
        }

        if (field.type === 'select') {
            return (
                <div className="settings-field" key={field.name}>
                    <label htmlFor={field.name}>{field.label}</label>
                    <select
                        id={field.name}
                        name={field.name}
                        value={value ?? ''}
                        onChange={handleSettingChange}
                        disabled={disabled}
                    >
                        {field.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    {field.helper && <p className="field-helper">{field.helper}</p>}
                </div>
            );
        }

        return (
            <div className="settings-field" key={field.name}>
                <label htmlFor={field.name}>{field.label}</label>
                <input
                    id={field.name}
                    name={field.name}
                    type={field.type === 'number' ? 'number' : field.type || 'text'}
                    min={field.min}
                    max={field.max}
                    value={value ?? ''}
                    onChange={handleSettingChange}
                    placeholder={field.placeholder}
                    disabled={disabled}
                />
                {field.helper && <p className="field-helper">{field.helper}</p>}
            </div>
        );
    };

    const isBusy = loadingStates.action;

    return (
        <div className="system-settings">
            <header className="settings-hero">
                <div>
                    <p className="kicker">Control Center</p>
                    <h1>System Settings</h1>
                    <p>Configure platform-wide defaults, manage admins, and keep compliance intact.</p>
                </div>
            </header>

            {(feedback.error || feedback.success) && (
                <div className={`alert ${feedback.error ? 'alert-error' : 'alert-success'}`}>
                    {feedback.error || feedback.success}
                </div>
            )}

            <nav className="settings-tabs">
                {TAB_OPTIONS.map((tab) => (
                    <button
                        key={tab.id}
                        className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </nav>
            {activeTab === 'admins' && (
                <section className="settings-card">
                    <div className="card-header">
                        <div>
                            <h2>Admin Management</h2>
                            <p>Invite, update, and audit elevated access accounts.</p>
                        </div>
                        <button className="btn btn-primary" onClick={() => openModal()} disabled={isBusy}>
                            Invite Admin
                        </button>
                    </div>

                    <div className="table-wrapper">
                        <table className="admins-table">
                            <thead>
                            <tr>
                                <th>Admin</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Last Active</th>
                                <th>Actions</th>
                            </tr>
                            </thead>
                            <tbody>
                            {admins.length === 0 ? (
                                <tr>
                                    <td colSpan="5">
                                        <div className="empty-state">
                                            {loadingStates.admins ? 'Loading admins...' : 'No admin accounts found.'}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                admins.map((admin) => (
                                    <tr key={admin.id}>
                                        <td>
                                            <div className="admin-identity">
                                                <div className="avatar-ring">
                                                    {admin.avatar_url ? (
                                                        <AvatarImage src={admin.avatar_url} alt={admin.display_name || admin.email} />
                                                    ) : (
                                                        <span>{getAdminInitials(admin)}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="admin-name">{admin.display_name || admin.displayName || admin.email}</p>
                                                    <p className="admin-email">{admin.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <select
                                                value={(admin.role || 'admin').toLowerCase()}
                                                onChange={(e) => handleRoleChange(admin, e.target.value)}
                                                disabled={isBusy}
                                            >
                                                {ROLE_OPTIONS.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td>
                                            <span className={`status-pill ${admin.is_active !== false ? 'status-active' : 'status-inactive'}`}>
                                                {admin.is_active !== false ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td>{formatDate(admin.last_login || admin.updated_at)}</td>
                                        <td className="admin-actions">
                                            <button className="btn btn-text" onClick={() => openModal(admin)} disabled={isBusy}>
                                                Edit
                                            </button>
                                            <button
                                                className="btn btn-text"
                                                onClick={() => handleToggleStatus(admin)}
                                                disabled={isBusy}
                                            >
                                                {admin.is_active !== false ? 'Deactivate' : 'Activate'}
                                            </button>
                                            <button
                                                className="btn btn-text danger"
                                                onClick={() => handleDeleteAdmin(admin.id)}
                                                disabled={isBusy}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
            {['general', 'security', 'session', 'system'].includes(activeTab) && (
                <section className="settings-card">
                    <div className="card-header">
                        <div>
                            <h2>{TAB_OPTIONS.find((tab) => tab.id === activeTab)?.label} Settings</h2>
                            <p>Updates apply instantly after saving.</p>
                        </div>
                    </div>

                    <div className="settings-grid">
                        {FIELD_GROUPS[activeTab].map((field) => renderField(field))}
                    </div>

                    <div className="settings-actions">
                        <button
                            className="btn btn-primary"
                            onClick={handleSaveSettings}
                            disabled={isBusy || settingsDiff.length === 0}
                        >
                            {isBusy ? 'Saving...' : 'Save Changes'}
                        </button>
                        <button className="btn btn-secondary" onClick={handleResetSettings} disabled={isBusy}>
                            Reset Defaults
                        </button>
                    </div>
                </section>
            )}
            {showModal && (
                <div className="modal-backdrop" role="dialog" aria-modal="true">
                    <div className="modal-card">
                        <div className="modal-header">
                            <div>
                                <p className="kicker">{selectedAdmin ? 'Update Admin' : 'Invite Admin'}</p>
                                <h3>{selectedAdmin ? 'Edit Access' : 'Create Admin Account'}</h3>
                            </div>
                            <button className="btn btn-icon" onClick={closeModal} aria-label="Close modal">
                                x
                            </button>
                        </div>
                        <form onSubmit={handleAdminSubmit} className="modal-body">
                            <label>
                                <span>Display Name</span>
                                <input
                                    type="text"
                                    name="displayName"
                                    value={adminForm.displayName}
                                    onChange={handleAdminFormChange}
                                    placeholder="Jane Doe"
                                    required
                                />
                            </label>
                            <label>
                                <span>Email</span>
                                <input
                                    type="email"
                                    name="email"
                                    value={adminForm.email}
                                    onChange={handleAdminFormChange}
                                    placeholder="jane@welphub.com"
                                    required
                                    disabled={Boolean(selectedAdmin)}
                                />
                            </label>
                            <label>
                                <span>Role</span>
                                <select name="role" value={adminForm.role} onChange={handleAdminFormChange}>
                                    {ROLE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="inline-toggle">
                                <input
                                    type="checkbox"
                                    name="isActive"
                                    checked={adminForm.isActive}
                                    onChange={handleAdminFormChange}
                                />
                                <span>Active immediately</span>
                            </label>
                            <label>
                                <span>Password {selectedAdmin && '(leave blank to keep current)'}</span>
                                <input
                                    type="password"
                                    name="password"
                                    value={adminForm.password}
                                    onChange={handleAdminFormChange}
                                    minLength={8}
                                    placeholder="Enter secure password"
                                    required={!selectedAdmin}
                                />
                            </label>
                            <label>
                                <span>Confirm Password</span>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={adminForm.confirmPassword}
                                    onChange={handleAdminFormChange}
                                    minLength={8}
                                    placeholder="Re-enter password"
                                    required={!selectedAdmin}
                                />
                            </label>

                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={isBusy}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={isBusy}>
                                    {isBusy ? 'Saving...' : selectedAdmin ? 'Save Changes' : 'Create Admin'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SystemSettings;
