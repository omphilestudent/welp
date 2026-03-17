import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import './HRMvp.css';

const ADMIN_ROLES = new Set(['admin', 'super_admin', 'superadmin', 'system_admin', 'hr_admin']);

const Employees = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [employees, setEmployees] = useState([]);
    const [filters, setFilters] = useState({ search: '', department: '', status: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [createForm, setCreateForm] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        department: '',
        job_title: ''
    });

    const isAdmin = ADMIN_ROLES.has(String(user?.role || '').toLowerCase());

    const departmentOptions = useMemo(() => {
        const set = new Set();
        employees.forEach((emp) => emp.department && set.add(emp.department));
        return Array.from(set);
    }, [employees]);

    const fetchEmployees = async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await api.get('/hr/employees', { params: filters });
            setEmployees(data?.data?.employees || []);
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to load employees');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    const handleFilterChange = (event) => {
        const { name, value } = event.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleCreateChange = (event) => {
        const { name, value } = event.target;
        setCreateForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleCreateEmployee = async (event) => {
        event.preventDefault();
        setError('');
        try {
            const { data } = await api.post('/hr/employees', createForm);
            const employee = data?.data?.employee;
            if (employee) {
                setEmployees((prev) => [employee, ...prev]);
                setCreateForm({ first_name: '', last_name: '', email: '', phone: '', department: '', job_title: '' });
            }
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to create employee');
        }
    };

    return (
        <div className="hr-mvp">
            <div className="hr-header">
                <div>
                    <h2>Employees</h2>
                    <p className="hr-subtitle">Manage employee profiles and access.</p>
                </div>
                <button className="btn btn-primary" onClick={fetchEmployees} disabled={loading}>
                    Refresh
                </button>
            </div>

            {error && <div className="hr-banner">{error}</div>}

            <div className="hr-card">
                <div className="hr-card-header">
                    <strong>Search & Filters</strong>
                </div>
                <div className="hr-grid">
                    <div className="hr-field">
                        <label htmlFor="search">Search</label>
                        <input id="search" name="search" value={filters.search} onChange={handleFilterChange} placeholder="Name or email" />
                    </div>
                    <div className="hr-field">
                        <label htmlFor="department">Department</label>
                        <select id="department" name="department" value={filters.department} onChange={handleFilterChange}>
                            <option value="">All</option>
                            {departmentOptions.map((dept) => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>
                    </div>
                    <div className="hr-field">
                        <label htmlFor="status">Status</label>
                        <select id="status" name="status" value={filters.status} onChange={handleFilterChange}>
                            <option value="">All</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </div>
                <div className="hr-actions">
                    <button className="btn btn-secondary" onClick={fetchEmployees} disabled={loading}>Apply</button>
                </div>
            </div>

            {isAdmin && (
                <form className="hr-card" onSubmit={handleCreateEmployee}>
                    <div className="hr-card-header">
                        <strong>Add Employee</strong>
                    </div>
                    <div className="hr-grid">
                        <div className="hr-field">
                            <label>First name</label>
                            <input name="first_name" value={createForm.first_name} onChange={handleCreateChange} required />
                        </div>
                        <div className="hr-field">
                            <label>Last name</label>
                            <input name="last_name" value={createForm.last_name} onChange={handleCreateChange} required />
                        </div>
                        <div className="hr-field">
                            <label>Email</label>
                            <input name="email" type="email" value={createForm.email} onChange={handleCreateChange} required />
                        </div>
                        <div className="hr-field">
                            <label>Phone</label>
                            <input name="phone" value={createForm.phone} onChange={handleCreateChange} />
                        </div>
                        <div className="hr-field">
                            <label>Department</label>
                            <input name="department" value={createForm.department} onChange={handleCreateChange} />
                        </div>
                        <div className="hr-field">
                            <label>Job title</label>
                            <input name="job_title" value={createForm.job_title} onChange={handleCreateChange} />
                        </div>
                    </div>
                    <div className="hr-actions">
                        <button className="btn btn-primary" type="submit">Create employee</button>
                    </div>
                </form>
            )}

            <div className="hr-card">
                <div className="hr-card-header">
                    <strong>Employee Directory</strong>
                </div>
                {loading ? (
                    <div className="hr-empty">Loading employees...</div>
                ) : employees.length === 0 ? (
                    <div className="hr-empty">No employees found.</div>
                ) : (
                    <table className="hr-table">
                        <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Department</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                        </thead>
                        <tbody>
                        {employees.map((emp) => (
                            <tr key={emp.id}>
                                <td>{emp.first_name} {emp.last_name}</td>
                                <td>{emp.email}</td>
                                <td>{emp.department || '—'}</td>
                                <td>
                                    <span className={`hr-status ${emp.status === 'active' ? 'success' : 'attention'}`}>
                                        {emp.status}
                                    </span>
                                </td>
                                <td>
                                    <button className="btn btn-text" onClick={() => navigate(`/hr/employees/${emp.id}`)}>View</button>
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

export default Employees;
