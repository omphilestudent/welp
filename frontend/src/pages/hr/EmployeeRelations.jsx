import React, { useState, useEffect } from 'react';
import {
    FaHandshake, FaExclamationTriangle, FaClipboardCheck,
    FaPlus, FaSearch, FaFilter, FaEdit, FaTrash, FaEye,
    FaUser, FaCalendarAlt, FaFlag, FaCheckCircle, FaTimesCircle,
    FaClock, FaComment, FaPaperclip, FaBell, FaHistory
} from 'react-icons/fa';
import './EmployeeRelations.css'

const EmployeeRelations = () => {
    // State management
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPriority, setFilterPriority] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [showFilters, setShowFilters] = useState(false);
    const [selectedCase, setSelectedCase] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('add'); // 'add', 'edit', 'view'
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [caseToDelete, setCaseToDelete] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: '' });
    const [formData, setFormData] = useState({
        caseId: '',
        employeeName: '',
        employeeId: '',
        issueType: '',
        priority: 'medium',
        status: 'open',
        description: '',
        dateReported: new Date().toISOString().split('T')[0],
        reportedBy: '',
        assignedTo: '',
        department: '',
        resolution: '',
        resolutionDate: '',
        attachments: [],
        notes: '',
        followUpDate: '',
        tags: [],
        confidentialityLevel: 'internal'
    });

    // Issue types for dropdown
    const issueTypes = [
        'Harassment', 'Discrimination', 'Workplace Conflict',
        'Performance Issue', 'Attendance Problem', 'Policy Violation',
        'Ethical Concern', 'Safety Issue', 'Grievance', 'Other'
    ];

    const priorities = ['low', 'medium', 'high', 'urgent'];
    const statuses = ['open', 'investigating', 'pending', 'resolved', 'closed'];
    const departments = ['HR', 'Engineering', 'Sales', 'Marketing', 'Operations', 'Finance', 'Legal'];
    const confidentialityLevels = ['internal', 'confidential', 'highly-confidential'];

    // Fetch cases from API
    useEffect(() => {
        fetchCases();
    }, []);

    const fetchCases = async () => {
        try {
            setLoading(true);
            // Replace with your actual API endpoint
            const response = await fetch('/api/employee-relations/cases');
            if (!response.ok) {
                throw new Error('Failed to fetch cases');
            }
            const data = await response.json();
            setCases(data);
            setError(null);
        } catch (err) {
            setError(err.message);
            showToast('Failed to load cases', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Show toast notification
    const showToast = (message, type) => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: '' }), 5000);
    };

    // Add ml-services case
    const addCase = async (caseData) => {
        try {
            const response = await fetch('/api/employee-relations/cases', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...caseData,
                    caseId: `ER-${Date.now()}`,
                    createdAt: new Date().toISOString()
                })
            });

            if (!response.ok) {
                throw new Error('Failed to add case');
            }

            const newCase = await response.json();
            setCases([newCase, ...cases]);
            setShowModal(false);
            resetForm();
            showToast('Case created successfully', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // Update case
    const updateCase = async (id, caseData) => {
        try {
            const response = await fetch(`/api/employee-relations/cases/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(caseData)
            });

            if (!response.ok) {
                throw new Error('Failed to update case');
            }

            const updatedCase = await response.json();
            setCases(cases.map(c => c.id === id ? updatedCase : c));
            setShowModal(false);
            resetForm();
            showToast('Case updated successfully', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // Delete case
    const deleteCase = async () => {
        if (!caseToDelete) return;

        try {
            const response = await fetch(`/api/employee-relations/cases/${caseToDelete.id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete case');
            }

            setCases(cases.filter(c => c.id !== caseToDelete.id));
            setShowDeleteConfirm(false);
            setCaseToDelete(null);
            showToast('Case deleted successfully', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    // Handle form input changes
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (modalMode === 'add') {
            await addCase(formData);
        } else if (modalMode === 'edit') {
            await updateCase(selectedCase.id, formData);
        }
    };

    // Open modal for adding
    const openAddModal = () => {
        setModalMode('add');
        resetForm();
        setShowModal(true);
    };

    // Open modal for editing
    const openEditModal = (caseItem, e) => {
        e.stopPropagation();
        setModalMode('edit');
        setSelectedCase(caseItem);
        setFormData(caseItem);
        setShowModal(true);
    };

    // Open modal for viewing
    const openViewModal = (caseItem) => {
        setModalMode('view');
        setSelectedCase(caseItem);
        setFormData(caseItem);
        setShowModal(true);
    };

    // Open delete confirmation
    const openDeleteConfirm = (caseItem, e) => {
        e.stopPropagation();
        setCaseToDelete(caseItem);
        setShowDeleteConfirm(true);
    };

    // Reset form data
    const resetForm = () => {
        setFormData({
            caseId: '',
            employeeName: '',
            employeeId: '',
            issueType: '',
            priority: 'medium',
            status: 'open',
            description: '',
            dateReported: new Date().toISOString().split('T')[0],
            reportedBy: '',
            assignedTo: '',
            department: '',
            resolution: '',
            resolutionDate: '',
            attachments: [],
            notes: '',
            followUpDate: '',
            tags: [],
            confidentialityLevel: 'internal'
        });
        setSelectedCase(null);
    };

    // Filter cases based on search and filters
    const filteredCases = cases.filter(caseItem => {
        const matchesSearch =
            caseItem.caseId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            caseItem.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            caseItem.issueType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            caseItem.description?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesPriority = filterPriority === 'all' || caseItem.priority === filterPriority;
        const matchesStatus = filterStatus === 'all' || caseItem.status === filterStatus;

        return matchesSearch && matchesPriority && matchesStatus;
    });

    // Calculate statistics
    const stats = {
        total: cases.length,
        open: cases.filter(c => c.status === 'open').length,
        investigating: cases.filter(c => c.status === 'investigating').length,
        resolved: cases.filter(c => c.status === 'resolved').length,
        urgent: cases.filter(c => c.priority === 'urgent').length
    };

    // Get priority color
    const getPriorityColor = (priority) => {
        switch(priority) {
            case 'urgent': return '#ef4444';
            case 'high': return '#f97316';
            case 'medium': return '#eab308';
            case 'low': return '#22c55e';
            default: return '#6b7280';
        }
    };

    // Get status color
    const getStatusColor = (status) => {
        switch(status) {
            case 'open': return '#3b82f6';
            case 'investigating': return '#8b5cf6';
            case 'pending': return '#f59e0b';
            case 'resolved': return '#22c55e';
            case 'closed': return '#6b7280';
            default: return '#6b7280';
        }
    };

    if (loading) {
        return (
            <div className="er-page">
                <div className="er-loading">
                    <div className="spinner"></div>
                    <p>Loading cases...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="er-page">
            {/* Toast Notification */}
            {toast.show && (
                <div className={`er-toast er-toast--${toast.type}`}>
                    <div className="er-toast__content">
                        {toast.type === 'success' ? <FaCheckCircle /> : <FaExclamationTriangle />}
                        <span>{toast.message}</span>
                    </div>
                    <button className="er-toast__close" onClick={() => setToast({ show: false })}>×</button>
                </div>
            )}

            {/* Header */}
            <div className="er-header">
                <div className="er-header__text">
                    <h1><FaHandshake /> Employee Relations</h1>
                    <p>Log workplace concerns, manage follow-ups, and maintain fair, documented resolution workflows.</p>
                </div>
                <button className="er-btn er-btn--primary" onClick={openAddModal}>
                    <FaPlus /> New Case
                </button>
            </div>

            {/* Statistics Cards */}
            <div className="er-stats">
                <div className="er-stat">
                    <span className="er-stat__value">{stats.total}</span>
                    <span className="er-stat__label">Total Cases</span>
                </div>
                <div className="er-stat">
                    <span className="er-stat__value">{stats.open}</span>
                    <span className="er-stat__label">Open</span>
                </div>
                <div className="er-stat">
                    <span className="er-stat__value">{stats.investigating}</span>
                    <span className="er-stat__label">Investigating</span>
                </div>
                <div className="er-stat">
                    <span className="er-stat__value">{stats.resolved}</span>
                    <span className="er-stat__label">Resolved</span>
                </div>
                <div className="er-stat">
                    <span className="er-stat__value">{stats.urgent}</span>
                    <span className="er-stat__label">Urgent</span>
                </div>
            </div>

            {/* Feature Cards */}
            <div className="er-features">
                <div className="er-feature">
                    <FaExclamationTriangle />
                    <div>
                        <h3>Case tracking</h3>
                        <p>Capture issue type, priority, and status updates to keep every employee relations case auditable.</p>
                    </div>
                </div>
                <div className="er-feature">
                    <FaClipboardCheck />
                    <div>
                        <h3>Resolution quality</h3>
                        <p>Track response timelines and outcomes so HR leaders can spot trends and improve policies.</p>
                    </div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="er-toolbar">
                <div className="er-search">
                    <FaSearch />
                    <input
                        type="text"
                        placeholder="Search cases by ID, employee, or issue..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button onClick={() => setShowFilters(!showFilters)}>
                        <FaFilter />
                    </button>
                </div>
                <div className="er-count">
                    {filteredCases.length} {filteredCases.length === 1 ? 'case' : 'cases'} found
                </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="er-filters">
                    <div className="er-filter-group">
                        <label>Priority:</label>
                        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
                            <option value="all">All Priorities</option>
                            {priorities.map(p => (
                                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                            ))}
                        </select>
                    </div>
                    <div className="er-filter-group">
                        <label>Status:</label>
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                            <option value="all">All Statuses</option>
                            {statuses.map(s => (
                                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Cases Table */}
            <div className="er-table-wrap">
                <table className="er-table">
                    <thead>
                    <tr>
                        <th>Case ID</th>
                        <th>Employee</th>
                        <th>Issue Type</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Date Reported</th>
                        <th>Assigned To</th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filteredCases.length > 0 ? (
                        filteredCases.map(caseItem => (
                            <tr key={caseItem.id} onClick={() => openViewModal(caseItem)}>
                                <td>
                                    <span className="er-case-id">{caseItem.caseId}</span>
                                </td>
                                <td>
                                    <div className="er-employee">
                                        <FaUser />
                                        {caseItem.employeeName}
                                    </div>
                                </td>
                                <td>{caseItem.issueType}</td>
                                <td>
                                        <span className="er-priority" style={{ backgroundColor: getPriorityColor(caseItem.priority) + '20', color: getPriorityColor(caseItem.priority) }}>
                                            {caseItem.priority}
                                        </span>
                                </td>
                                <td>
                                        <span className="er-status" style={{ backgroundColor: getStatusColor(caseItem.status) + '20', color: getStatusColor(caseItem.status) }}>
                                            {caseItem.status}
                                        </span>
                                </td>
                                <td>
                                    <div className="er-date">
                                        <FaCalendarAlt />
                                        {new Date(caseItem.dateReported).toLocaleDateString()}
                                    </div>
                                </td>
                                <td>{caseItem.assignedTo || 'Unassigned'}</td>
                                <td onClick={(e) => e.stopPropagation()}>
                                    <div className="er-actions">
                                        <button
                                            className="er-action-btn er-action-btn--edit"
                                            onClick={(e) => openEditModal(caseItem, e)}
                                        >
                                            <FaEdit />
                                        </button>
                                        <button
                                            className="er-action-btn er-action-btn--delete"
                                            onClick={(e) => openDeleteConfirm(caseItem, e)}
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="8" className="er-no-data">
                                <FaExclamationTriangle />
                                <p>No cases found</p>
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>

            {/* Case Modal */}
            {showModal && (
                <div className="er-overlay" onClick={() => setShowModal(false)}>
                    <div className="er-modal" onClick={e => e.stopPropagation()}>
                        <div className="er-modal__header">
                            <h2>
                                {modalMode === 'add' ? <FaPlus /> : modalMode === 'edit' ? <FaEdit /> : <FaEye />}
                                {modalMode === 'add' ? ' New Case' : modalMode === 'edit' ? ' Edit Case' : ' Case Details'}
                            </h2>
                            <button className="er-modal__close" onClick={() => setShowModal(false)}>×</button>
                        </div>

                        <form onSubmit={handleSubmit} className="er-form">
                            {/* Case ID (Read-only for edit/view) */}
                            {modalMode !== 'add' && (
                                <div className="er-form__group er-form__group--full">
                                    <label>Case ID</label>
                                    <input type="text" value={formData.caseId} disabled />
                                </div>
                            )}

                            {/* Employee Information */}
                            <div className="er-form__group">
                                <label>Employee Name <span className="req">*</span></label>
                                <input
                                    type="text"
                                    name="employeeName"
                                    value={formData.employeeName}
                                    onChange={handleInputChange}
                                    required
                                    disabled={modalMode === 'view'}
                                    placeholder="Full name"
                                />
                            </div>

                            <div className="er-form__group">
                                <label>Employee ID <span className="req">*</span></label>
                                <input
                                    type="text"
                                    name="employeeId"
                                    value={formData.employeeId}
                                    onChange={handleInputChange}
                                    required
                                    disabled={modalMode === 'view'}
                                    placeholder="EMP-12345"
                                />
                            </div>

                            {/* Issue Details */}
                            <div className="er-form__group">
                                <label>Issue Type <span className="req">*</span></label>
                                <select
                                    name="issueType"
                                    value={formData.issueType}
                                    onChange={handleInputChange}
                                    required
                                    disabled={modalMode === 'view'}
                                >
                                    <option value="">Select issue type</option>
                                    {issueTypes.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="er-form__group">
                                <label>Department</label>
                                <select
                                    name="department"
                                    value={formData.department}
                                    onChange={handleInputChange}
                                    disabled={modalMode === 'view'}
                                >
                                    <option value="">Select department</option>
                                    {departments.map(dept => (
                                        <option key={dept} value={dept}>{dept}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Priority and Status */}
                            <div className="er-form__group">
                                <label>Priority <span className="req">*</span></label>
                                <select
                                    name="priority"
                                    value={formData.priority}
                                    onChange={handleInputChange}
                                    required
                                    disabled={modalMode === 'view'}
                                >
                                    {priorities.map(p => (
                                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="er-form__group">
                                <label>Status</label>
                                <select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleInputChange}
                                    disabled={modalMode === 'view'}
                                >
                                    {statuses.map(s => (
                                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Dates */}
                            <div className="er-form__group">
                                <label>Date Reported <span className="req">*</span></label>
                                <input
                                    type="date"
                                    name="dateReported"
                                    value={formData.dateReported}
                                    onChange={handleInputChange}
                                    required
                                    disabled={modalMode === 'view'}
                                />
                            </div>

                            <div className="er-form__group">
                                <label>Follow-up Date</label>
                                <input
                                    type="date"
                                    name="followUpDate"
                                    value={formData.followUpDate}
                                    onChange={handleInputChange}
                                    disabled={modalMode === 'view'}
                                />
                            </div>

                            {/* Assignment */}
                            <div className="er-form__group">
                                <label>Reported By</label>
                                <input
                                    type="text"
                                    name="reportedBy"
                                    value={formData.reportedBy}
                                    onChange={handleInputChange}
                                    disabled={modalMode === 'view'}
                                    placeholder="Person reporting the issue"
                                />
                            </div>

                            <div className="er-form__group">
                                <label>Assigned To</label>
                                <input
                                    type="text"
                                    name="assignedTo"
                                    value={formData.assignedTo}
                                    onChange={handleInputChange}
                                    disabled={modalMode === 'view'}
                                    placeholder="HR representative"
                                />
                            </div>

                            {/* Description */}
                            <div className="er-form__group er-form__group--full">
                                <label>Description <span className="req">*</span></label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    required
                                    disabled={modalMode === 'view'}
                                    rows="4"
                                    placeholder="Detailed description of the issue..."
                                />
                            </div>

                            {/* Resolution (show only if status is resolved or closed) */}
                            {(formData.status === 'resolved' || formData.status === 'closed') && (
                                <>
                                    <div className="er-form__group er-form__group--full">
                                        <label>Resolution</label>
                                        <textarea
                                            name="resolution"
                                            value={formData.resolution}
                                            onChange={handleInputChange}
                                            disabled={modalMode === 'view'}
                                            rows="3"
                                            placeholder="How was this case resolved?"
                                        />
                                    </div>

                                    <div className="er-form__group">
                                        <label>Resolution Date</label>
                                        <input
                                            type="date"
                                            name="resolutionDate"
                                            value={formData.resolutionDate}
                                            onChange={handleInputChange}
                                            disabled={modalMode === 'view'}
                                        />
                                    </div>
                                </>
                            )}

                            {/* Notes */}
                            <div className="er-form__group er-form__group--full">
                                <label>Additional Notes</label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleInputChange}
                                    disabled={modalMode === 'view'}
                                    rows="2"
                                    placeholder="Any additional notes or comments..."
                                />
                            </div>

                            {/* Confidentiality */}
                            <div className="er-form__group">
                                <label>Confidentiality Level</label>
                                <select
                                    name="confidentialityLevel"
                                    value={formData.confidentialityLevel}
                                    onChange={handleInputChange}
                                    disabled={modalMode === 'view'}
                                >
                                    {confidentialityLevels.map(level => (
                                        <option key={level} value={level}>
                                            {level.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Meta Information (for view/edit mode) */}
                            {modalMode !== 'add' && (
                                <div className="er-form__meta">
                                    <div className="er-meta-row">
                                        <span>Created:</span>
                                        <span>{new Date(formData.createdAt).toLocaleString()}</span>
                                    </div>
                                    <div className="er-meta-row">
                                        <span>Last Updated:</span>
                                        <span>{new Date(formData.updatedAt || formData.createdAt).toLocaleString()}</span>
                                    </div>
                                </div>
                            )}

                            {/* Form Actions */}
                            {modalMode !== 'view' ? (
                                <div className="er-modal__actions">
                                    <button type="button" className="er-btn er-btn--ghost" onClick={() => setShowModal(false)}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="er-btn er-btn--primary">
                                        {modalMode === 'add' ? 'Create Case' : 'Save Changes'}
                                    </button>
                                </div>
                            ) : (
                                <div className="er-modal__actions">
                                    <button type="button" className="er-btn er-btn--ghost" onClick={() => setShowModal(false)}>
                                        Close
                                    </button>
                                    <button
                                        type="button"
                                        className="er-btn er-btn--primary"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setModalMode('edit');
                                        }}
                                    >
                                        <FaEdit /> Edit
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="er-overlay" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="er-confirm" onClick={e => e.stopPropagation()}>
                        <div className="er-confirm__icon">
                            <FaExclamationTriangle />
                        </div>
                        <h3>Delete Case</h3>
                        <p>
                            Are you sure you want to delete case <strong>{caseToDelete?.caseId}</strong>?<br />
                            This action cannot be undone.
                        </p>
                        <div className="er-confirm__actions">
                            <button className="er-btn er-btn--ghost" onClick={() => setShowDeleteConfirm(false)}>
                                Cancel
                            </button>
                            <button className="er-btn er-btn--danger" onClick={deleteCase}>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeRelations;