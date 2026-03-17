import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import './HRMvp.css';

const EmployeeProfile = () => {
    const { id } = useParams();
    const [employee, setEmployee] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchProfile = async () => {
        setLoading(true);
        setError('');
        try {
            const [employeeRes, docRes, leaveRes, taskRes] = await Promise.all([
                api.get(`/hr/employees/${id}`),
                api.get(`/hr/documents/${id}`),
                api.get('/hr/leaves', { params: { employeeId: id } }),
                api.get(`/hr/onboarding/${id}`)
            ]);

            setEmployee(employeeRes?.data?.data?.employee || null);
            setDocuments(docRes?.data?.data?.documents || []);
            setLeaves(leaveRes?.data?.data?.leaves || []);
            setTasks(taskRes?.data?.data?.tasks || []);
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to load employee profile');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, [id]);

    if (loading) {
        return <div className="hr-mvp"><div className="hr-empty">Loading profile...</div></div>;
    }

    if (error) {
        return <div className="hr-mvp"><div className="hr-banner">{error}</div></div>;
    }

    if (!employee) {
        return <div className="hr-mvp"><div className="hr-empty">Employee not found.</div></div>;
    }

    return (
        <div className="hr-mvp">
            <div className="hr-header">
                <div>
                    <h2>{employee.first_name} {employee.last_name}</h2>
                    <p className="hr-subtitle">{employee.job_title || 'Employee'} · {employee.department || 'No department'}</p>
                </div>
                <span className={`hr-status ${employee.status === 'active' ? 'success' : 'attention'}`}>{employee.status}</span>
            </div>

            <div className="hr-card">
                <div className="hr-card-header">
                    <strong>Personal Info</strong>
                </div>
                <div className="hr-grid">
                    <div className="hr-field">
                        <label>Email</label>
                        <div>{employee.email}</div>
                    </div>
                    <div className="hr-field">
                        <label>Phone</label>
                        <div>{employee.phone || '—'}</div>
                    </div>
                    <div className="hr-field">
                        <label>Department</label>
                        <div>{employee.department || '—'}</div>
                    </div>
                    <div className="hr-field">
                        <label>Job Title</label>
                        <div>{employee.job_title || '—'}</div>
                    </div>
                </div>
            </div>

            <div className="hr-card">
                <div className="hr-card-header">
                    <strong>Documents</strong>
                </div>
                {documents.length === 0 ? (
                    <div className="hr-empty">No documents uploaded.</div>
                ) : (
                    <table className="hr-table">
                        <thead>
                        <tr>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Uploaded</th>
                        </tr>
                        </thead>
                        <tbody>
                        {documents.map((doc) => (
                            <tr key={doc.id}>
                                <td><a className="hr-link" href={doc.file_url} target="_blank" rel="noreferrer">{doc.name}</a></td>
                                <td>{doc.type}</td>
                                <td>{doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : '—'}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="hr-card">
                <div className="hr-card-header">
                    <strong>Leave Requests</strong>
                </div>
                {leaves.length === 0 ? (
                    <div className="hr-empty">No leave requests.</div>
                ) : (
                    <table className="hr-table">
                        <thead>
                        <tr>
                            <th>Type</th>
                            <th>Dates</th>
                            <th>Status</th>
                        </tr>
                        </thead>
                        <tbody>
                        {leaves.map((leave) => (
                            <tr key={leave.id}>
                                <td>{leave.type}</td>
                                <td>{leave.start_date} ? {leave.end_date}</td>
                                <td>
                                    <span className={`hr-status ${leave.status === 'approved' ? 'success' : leave.status === 'pending' ? 'pending' : 'attention'}`}>
                                        {leave.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="hr-card">
                <div className="hr-card-header">
                    <strong>Onboarding Tasks</strong>
                </div>
                {tasks.length === 0 ? (
                    <div className="hr-empty">No onboarding tasks.</div>
                ) : (
                    <div className="hr-grid">
                        {tasks.map((task) => (
                            <div key={task.id} className="hr-field">
                                <span className="hr-pill">{task.status}</span>
                                <strong>{task.task_name}</strong>
                                <span>{task.due_date ? `Due ${task.due_date}` : 'No due date'}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EmployeeProfile;
