import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { FaPlus, FaEdit, FaTrash, FaPaperPlane } from 'react-icons/fa';
import Loading from '../../components/common/Loading';

const emptyTemplate = {
    name: '',
    subject: '',
    body_html: '',
    body_text: '',
    is_active: true
};

const MarketingEmails = () => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyTemplate);
    const [saving, setSaving] = useState(false);
    const [testEmail, setTestEmail] = useState('');
    const [testMessage, setTestMessage] = useState('');

    const fetchTemplates = async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await api.get('/admin/marketing/templates');
            setTemplates(data.templates || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load templates');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []);

    const openNew = () => {
        setEditing(null);
        setForm(emptyTemplate);
        setShowModal(true);
    };

    const openEdit = (template) => {
        setEditing(template);
        setForm({
            name: template.name || '',
            subject: template.subject || '',
            body_html: template.body_html || '',
            body_text: template.body_text || '',
            is_active: template.is_active !== false
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            if (editing?.id) {
                await api.put(`/admin/marketing/templates/${editing.id}`, form);
            } else {
                await api.post('/admin/marketing/templates', form);
            }
            setShowModal(false);
            await fetchTemplates();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save template');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (templateId) => {
        if (!window.confirm('Delete this template?')) return;
        try {
            await api.delete(`/admin/marketing/templates/${templateId}`);
            await fetchTemplates();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete template');
        }
    };

    const handleSendTest = async (templateId) => {
        setTestMessage('');
        if (!testEmail) {
            setTestMessage('Enter a test email address first.');
            return;
        }
        try {
            await api.post(`/admin/marketing/templates/${templateId}/test`, { email: testEmail });
            setTestMessage('Test email sent.');
        } catch (err) {
            setTestMessage(err.response?.data?.error || 'Failed to send test email.');
        }
    };

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <div>
                    <h1>Marketing Emails</h1>
                    <p>Manage upgrade campaign templates and send test emails.</p>
                </div>
                <button className="btn btn-primary" onClick={openNew}>
                    <FaPlus /> New Template
                </button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="card" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label style={{ fontWeight: 600 }}>Test email address</label>
                    <input
                        type="email"
                        className="form-input"
                        style={{ minWidth: 260 }}
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        placeholder="admin@welp.com"
                    />
                    {testMessage && <span className="form-hint">{testMessage}</span>}
                </div>
            </div>

            {loading ? (
                <Loading />
            ) : (
                <div className="card">
                    <table className="admin-table">
                        <thead>
                        <tr>
                            <th>Name</th>
                            <th>Subject</th>
                            <th>Status</th>
                            <th>Updated</th>
                            <th>Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {templates.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center' }}>No templates found.</td>
                            </tr>
                        ) : (
                            templates.map((template) => (
                                <tr key={template.id}>
                                    <td>{template.name}</td>
                                    <td>{template.subject}</td>
                                    <td>{template.is_active ? 'Active' : 'Inactive'}</td>
                                    <td>{template.updated_at ? new Date(template.updated_at).toLocaleString() : '-'}</td>
                                    <td>
                                        <div className="action-buttons">
                                            <button className="btn-icon" title="Edit" onClick={() => openEdit(template)}>
                                                <FaEdit />
                                            </button>
                                            <button className="btn-icon" title="Send test" onClick={() => handleSendTest(template.id)}>
                                                <FaPaperPlane />
                                            </button>
                                            <button className="btn-icon" title="Delete" onClick={() => handleDelete(template.id)}>
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>{editing ? 'Edit Template' : 'New Template'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <label className="form-label">Name</label>
                            <input
                                className="form-input"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                            />

                            <label className="form-label">Subject</label>
                            <input
                                className="form-input"
                                value={form.subject}
                                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                            />

                            <label className="form-label">HTML Body</label>
                            <textarea
                                className="form-textarea"
                                rows={6}
                                value={form.body_html}
                                onChange={(e) => setForm({ ...form, body_html: e.target.value })}
                            />

                            <label className="form-label">Text Body (optional)</label>
                            <textarea
                                className="form-textarea"
                                rows={4}
                                value={form.body_text}
                                onChange={(e) => setForm({ ...form, body_text: e.target.value })}
                            />

                            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem' }}>
                                <input
                                    type="checkbox"
                                    checked={form.is_active}
                                    onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                />
                                Active
                            </label>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MarketingEmails;
