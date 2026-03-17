import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import './HRMvp.css';

const ADMIN_ROLES = new Set(['admin', 'super_admin', 'superadmin', 'system_admin', 'hr_admin']);

const Leaves = () => {
    const { user } = useAuth();
    const [leaves, setLeaves] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [form, setForm] = useState({ type: 'annual', start_date: '', end_date: '', reason: '', employee_id: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const isAdmin = ADMIN_ROLES.has(String(user?.role || '').toLowerCase());

    const fetchLeaves = async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await api.get('/hr/leaves');
            setLeaves(data?.data?.leaves || []);
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to load leave requests');
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        if (!isAdmin) return;
        try {
            const { data } = await api.get('/hr/employees');
            setEmployees(data?.data?.employees || []);
        } catch {
            setEmployees([]);
        }
    };

    useEffect(() => {
        fetchLeaves();
        fetchEmployees();
    }, []);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        try {
            const payload = { ...form };
            if (!isAdmin) {
                delete payload.employee_id;
            }
            const { data } = await api.post('/hr/leaves', payload);
            const leave = data?.data?.leave;
            if (leave) {
                setLeaves((prev) => [leave, ...prev]);
                setForm({ type: 'annual', start_date: '', end_date: '', reason: '', employee_id: '' });
            }
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to submit leave request');
        }
    };

    const updateStatus = async (id, status) => {
        try {
            await api.put(`/hr/leaves/${id}/${status}`);
            fetchLeaves();
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to update leave status');
        }
    };

    return (
        <div className="hr-mvp">
            <div className="hr-header">
                <div>
                    <h2>Leave Management</h2>
                    <p className="hr-subtitle">Track leave requests and approvals.</p>
                </div>
                <button className="btn btn-primary" onClick={fetchLeaves} disabled={loading}>Refresh</button>
            </div>

            {error && <div className="hr-banner">{error}</div>}

            <form className="hr-card" onSubmit={handleSubmit}>
                <div className="hr-card-header">
                    <strong>Submit Leave Request</strong>
                </div>
                <div className="hr-grid">
                    {isAdmin && (
                        <div className="hr-field">
                            <label>Employee</label>
                            <select name="employee_id" value={form.employee_id} onChange={handleChange}>
                                <option value="">Select employee</option>
                                {employees.map((emp) => (
                                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="hr-field">
                        <label>Type</label>
                        <select name="type" value={form.type} onChange={handleChange}>
                            <option value="annual">Annual</option>
                            <option value="sick">Sick</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                    <div className="hr-field">
                        <label>Start date</label>
                        <input type="date" name="start_date" value={form.start_date} onChange={handleChange} required />
                    </div>
                    <div className="hr-field">
                        <label>End date</label>
                        <input type="date" name="end_date" value={form.end_date} onChange={handleChange} required />
                    </div>
                    <div className="hr-field">
                        <label>Reason</label>
                        <textarea name="reason" value={form.reason} onChange={handleChange} rows="2" />
                    </div>
                </div>
                <div className="hr-actions">
                    <button className="btn btn-primary" type="submit">Submit request</button>
                </div>
            </form>

            <div className="hr-card">
                <div className="hr-card-header">
                    <strong>Leave Requests</strong>
                </div>
                {loading ? (
                    <div className="hr-empty">Loading leave requests...</div>
                ) : leaves.length === 0 ? (
                    <div className="hr-empty">No leave requests found.</div>
                ) : (
                    <table className="hr-table">
                        <thead>
                        <tr>
                            <th>Employee ID</th>
                            <th>Type</th>
                            <th>Dates</th>
                            <th>Status</th>
                            {isAdmin && <th>Actions</th>}
                        </tr>
                        </thead>
                        <tbody>
                        {leaves.map((leave) => (
                            <tr key={leave.id}>
                                <td>{leave.employee_id}</td>
                                <td>{leave.type}</td>
                                <td>{leave.start_date} ? {leave.end_date}</td>
                                <td>
                                    <span className={`hr-status ${leave.status === 'approved' ? 'success' : leave.status === 'pending' ? 'pending' : 'attention'}`}>
                                        {leave.status}
                                    </span>
                                </td>
                                {isAdmin && (
                                    <td className="hr-inline">
                                        <button className="btn btn-text" onClick={() => updateStatus(leave.id, 'approve')}>Approve</button>
                                        <button className="btn btn-text" onClick={() => updateStatus(leave.id, 'reject')}>Reject</button>
                                    </td>
                                )}
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default Leaves;
