import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import './HRMvp.css';

const ADMIN_ROLES = new Set(['admin', 'super_admin', 'superadmin', 'system_admin', 'hr_admin']);

const Documents = () => {
    const { user } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [documents, setDocuments] = useState([]);
    const [form, setForm] = useState({ name: '', file_url: '', type: 'contract', employee_id: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const isAdmin = ADMIN_ROLES.has(String(user?.role || '').toLowerCase());

    const fetchEmployees = async () => {
        try {
            const { data } = await api.get('/hr/employees');
            const list = data?.data?.employees || [];
            setEmployees(list);
            if (!isAdmin && list[0]) {
                setSelectedEmployee(list[0].id);
            }
        } catch {
            setEmployees([]);
        }
    };

    const fetchDocuments = async (employeeId) => {
        if (!employeeId) return;
        setLoading(true);
        setError('');
        try {
            const { data } = await api.get(`/hr/documents/${employeeId}`);
            setDocuments(data?.data?.documents || []);
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to load documents');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    useEffect(() => {
        if (selectedEmployee) {
            fetchDocuments(selectedEmployee);
        }
    }, [selectedEmployee]);

    const handleFormChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleUpload = async (event) => {
        event.preventDefault();
        setError('');
        const payload = { ...form, employee_id: isAdmin ? selectedEmployee || form.employee_id : undefined };
        try {
            const { data } = await api.post('/hr/documents/upload', payload);
            const document = data?.data?.document;
            if (document) {
                setDocuments((prev) => [document, ...prev]);
                setForm({ name: '', file_url: '', type: 'contract', employee_id: '' });
            }
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to upload document');
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/hr/documents/${id}`);
            setDocuments((prev) => prev.filter((doc) => doc.id !== id));
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to delete document');
        }
    };

    return (
        <div className="hr-mvp">
            <div className="hr-header">
                <div>
                    <h2>Documents</h2>
                    <p className="hr-subtitle">Upload and manage employee documents.</p>
                </div>
            </div>

            {error && <div className="hr-banner">{error}</div>}

            <div className="hr-card">
                <div className="hr-card-header">
                    <strong>Select Employee</strong>
                </div>
                {isAdmin ? (
                    <div className="hr-field">
                        <label>Employee</label>
                        <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}>
                            <option value="">Select employee</option>
                            {employees.map((emp) => (
                                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                            ))}
                        </select>
                    </div>
                ) : (
                    <div className="hr-empty">Viewing your own documents.</div>
                )}
            </div>

            <form className="hr-card" onSubmit={handleUpload}>
                <div className="hr-card-header">
                    <strong>Upload Document</strong>
                </div>
                <div className="hr-grid">
                    <div className="hr-field">
                        <label>Name</label>
                        <input name="name" value={form.name} onChange={handleFormChange} required />
                    </div>
                    <div className="hr-field">
                        <label>File URL</label>
                        <input name="file_url" value={form.file_url} onChange={handleFormChange} required />
                    </div>
                    <div className="hr-field">
                        <label>Type</label>
                        <select name="type" value={form.type} onChange={handleFormChange}>
                            <option value="contract">Contract</option>
                            <option value="id">ID</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                </div>
                <div className="hr-actions">
                    <button className="btn btn-primary" type="submit" disabled={!selectedEmployee && isAdmin}>Upload</button>
                </div>
            </form>

            <div className="hr-card">
                <div className="hr-card-header">
                    <strong>Documents List</strong>
                </div>
                {loading ? (
                    <div className="hr-empty">Loading documents...</div>
                ) : documents.length === 0 ? (
                    <div className="hr-empty">No documents uploaded.</div>
                ) : (
                    <table className="hr-table">
                        <thead>
                        <tr>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Uploaded</th>
                            <th>Action</th>
                        </tr>
                        </thead>
                        <tbody>
                        {documents.map((doc) => (
                            <tr key={doc.id}>
                                <td><a className="hr-link" href={doc.file_url} target="_blank" rel="noreferrer">{doc.name}</a></td>
                                <td>{doc.type}</td>
                                <td>{doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : '—'}</td>
                                <td>
                                    <button className="btn btn-text" onClick={() => handleDelete(doc.id)}>Delete</button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default Documents;
