import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { isWelpStaff } from '../../utils/roleUtils';
import './HRMvp.css';

const Onboarding = () => {
    const { user } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState('');
    const [tasks, setTasks] = useState([]);
    const [form, setForm] = useState({ task_name: '', due_date: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const isAdmin = isWelpStaff(user);

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

    const fetchTasks = async (employeeId) => {
        if (!employeeId) return;
        setLoading(true);
        setError('');
        try {
            const { data } = await api.get(`/hr/onboarding/${employeeId}`);
            setTasks(data?.data?.tasks || []);
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to load onboarding tasks');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    useEffect(() => {
        if (selectedEmployee) {
            fetchTasks(selectedEmployee);
        }
    }, [selectedEmployee]);

    const handleFormChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleAddTask = async (event) => {
        event.preventDefault();
        setError('');
        try {
            const { data } = await api.post('/hr/onboarding/tasks', {
                employee_id: selectedEmployee,
                task_name: form.task_name,
                due_date: form.due_date || null
            });
            const task = data?.data?.task;
            if (task) {
                setTasks((prev) => [task, ...prev]);
                setForm({ task_name: '', due_date: '' });
            }
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to add onboarding task');
        }
    };

    const markComplete = async (taskId) => {
        try {
            const { data } = await api.put(`/hr/onboarding/tasks/${taskId}`, { status: 'completed' });
            const updated = data?.data?.task;
            if (updated) {
                setTasks((prev) => prev.map((task) => task.id === updated.id ? updated : task));
            }
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to update task');
        }
    };

    return (
        <div className="hr-mvp">
            <div className="hr-header">
                <div>
                    <h2>Onboarding</h2>
                    <p className="hr-subtitle">Assign and track onboarding tasks.</p>
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
                    <div className="hr-empty">Viewing your onboarding tasks.</div>
                )}
            </div>

            {isAdmin && (
                <form className="hr-card" onSubmit={handleAddTask}>
                    <div className="hr-card-header">
                        <strong>Add Task</strong>
                    </div>
                    <div className="hr-grid">
                        <div className="hr-field">
                            <label>Task name</label>
                            <input name="task_name" value={form.task_name} onChange={handleFormChange} required />
                        </div>
                        <div className="hr-field">
                            <label>Due date</label>
                            <input type="date" name="due_date" value={form.due_date} onChange={handleFormChange} />
                        </div>
                    </div>
                    <div className="hr-actions">
                        <button className="btn btn-primary" type="submit" disabled={!selectedEmployee}>Add task</button>
                    </div>
                </form>
            )}

            <div className="hr-card">
                <div className="hr-card-header">
                    <strong>Tasks</strong>
                </div>
                {loading ? (
                    <div className="hr-empty">Loading tasks...</div>
                ) : tasks.length === 0 ? (
                    <div className="hr-empty">No onboarding tasks found.</div>
                ) : (
                    <div className="hr-grid">
                        {tasks.map((task) => (
                            <div key={task.id} className="hr-field">
                                <span className={`hr-status ${task.status === 'completed' ? 'success' : 'pending'}`}>{task.status}</span>
                                <strong>{task.task_name}</strong>
                                <span>{task.due_date ? `Due ${task.due_date}` : 'No due date'}</span>
                                {task.status !== 'completed' && (
                                    <button className="btn btn-text" onClick={() => markComplete(task.id)}>Mark complete</button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Onboarding;

