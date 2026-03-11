import React, { useEffect, useMemo, useState } from 'react';
import { FaBuilding, FaPlus, FaSync, FaUsers } from 'react-icons/fa';
import api from '../../services/api';

const EMPTY_FORM = {
    name: '',
    description: ''
};

const Departments = () => {
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState(EMPTY_FORM);

    const sortedDepartments = useMemo(
        () => [...departments].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
        [departments]
    );

    const fetchDepartments = async () => {
        try {
            setError('');
            setLoading(true);
            const { data } = await api.get('/hr/departments');
            setDepartments(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e.response?.data?.error || 'Could not load departments from the database.');
            setDepartments([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDepartments();
    }, []);

    const handleCreateDepartment = async (event) => {
        event.preventDefault();

        if (!form.name.trim()) {
            setError('Department name is required.');
            return;
        }

        try {
            setSaving(true);
            setError('');
            await api.post('/hr/departments', {
                name: form.name.trim(),
                description: form.description.trim() || null
            });
            setForm(EMPTY_FORM);
            await fetchDepartments();
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to create department.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="hr-page-content">
            <h1><FaBuilding /> Departments</h1>
            <p>Create and manage departments using live data from the project database.</p>

            <section className="hr-card" style={{ marginBottom: '1rem' }}>
                <h3><FaPlus /> Add Department</h3>
                <form onSubmit={handleCreateDepartment} className="hr-department-form">
                    <input
                        type="text"
                        placeholder="Department name"
                        value={form.name}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        disabled={saving}
                    />
                    <textarea
                        rows={3}
                        placeholder="Description (optional)"
                        value={form.description}
                        onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                        disabled={saving}
                    />
                    <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add Department'}</button>
                </form>
            </section>

            <section className="hr-card">
                <div className="hr-list-header">
                    <h3><FaUsers /> Departments ({sortedDepartments.length})</h3>
                    <button type="button" onClick={fetchDepartments} disabled={loading}>
                        <FaSync /> Refresh
                    </button>
                </div>

                {error && <p className="hr-error">{error}</p>}

                {loading ? (
                    <p>Loading departments…</p>
                ) : sortedDepartments.length === 0 ? (
                    <p>No departments found in the database.</p>
                ) : (
                    <ul className="hr-department-list">
                        {sortedDepartments.map((department) => (
                            <li key={department.id || department.department_id}>
                                <strong>{department.name}</strong>
                                <p>{department.description || 'No description provided.'}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
};

export default Departments;
