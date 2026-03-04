import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import UserForm from '../../components/admin/UserForm';
import UserTable from '../../components/admin/UserTable';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loading from '../../components/common/Loading';
import './UserManagement.css';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [filters, setFilters] = useState({ search: '', roleId: '', department: '', isActive: '' });
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/rbac/users', {
                params: {
                    page: pagination.page,
                    limit: pagination.limit,
                    ...filters
                }
            });

            setUsers(data.users || []);
            setPagination((prev) => ({ ...prev, total: data.total || 0, totalPages: data.totalPages || 0 }));
        } catch (error) {
            console.error('Error fetching users:', error);
            toast.error('Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    const fetchRoles = async () => {
        try {
            const { data } = await api.get('/rbac/users/roles/available');
            setRoles(data || []);
        } catch (error) {
            console.error('Error fetching roles:', error);
            toast.error('Failed to fetch roles');
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchRoles();
    }, [pagination.page, filters]);

    const handleSaveUser = async (userData) => {
        try {
            if (selectedUser) {
                await api.put(`/rbac/users/${selectedUser.id}`, userData);
                toast.success('User updated successfully');
            } else {
                await api.post('/rbac/users', userData);
                toast.success('User created successfully');
            }

            setShowModal(false);
            setSelectedUser(null);
            fetchUsers();
        } catch (error) {
            console.error('Error saving user:', error);
            toast.error(error.response?.data?.error || 'Failed to save user');
        }
    };

    const handleDeleteUser = async () => {
        try {
            if (selectedUsers.length > 0) {
                await api.post('/rbac/users/bulk-delete', { userIds: selectedUsers });
                toast.success(`${selectedUsers.length} users deleted successfully`);
                setSelectedUsers([]);
            } else if (selectedUser) {
                await api.delete(`/rbac/users/${selectedUser.id}`);
                toast.success('User deleted successfully');
            }

            setShowDeleteConfirm(false);
            setSelectedUser(null);
            fetchUsers();
        } catch (error) {
            console.error('Error deleting user:', error);
            toast.error(error.response?.data?.error || 'Failed to delete user');
        }
    };

    const handleResetPassword = async (userId) => {
        const newPassword = window.prompt('Enter new password (min 8 characters):');

        if (!newPassword || newPassword.length < 8) {
            toast.error('Password must be at least 8 characters long');
            return;
        }

        try {
            await api.post(`/rbac/users/${userId}/reset-password`, { newPassword });
            toast.success('Password reset successfully');
        } catch (error) {
            console.error('Error resetting password:', error);
            toast.error(error.response?.data?.error || 'Failed to reset password');
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
        setPagination((prev) => ({ ...prev, page: 1 }));
    };

    const handleBulkAction = (action) => {
        if (selectedUsers.length === 0) {
            toast('Please select users first');
            return;
        }

        if (action === 'delete') setShowDeleteConfirm(true);
    };

    return (
        <div className="user-management">
            <div className="page-header">
                <h1>User Management</h1>
                <button className="btn-primary" onClick={() => { setSelectedUser(null); setShowModal(true); }}>
                    <i className="fas fa-plus" /> Create New User
                </button>
            </div>

            <div className="filters-section">
                <div className="filter-group">
                    <input type="text" name="search" placeholder="Search by name or email..." value={filters.search} onChange={handleFilterChange} className="search-input" />
                </div>

                <div className="filter-group">
                    <select name="roleId" value={filters.roleId} onChange={handleFilterChange} className="filter-select">
                        <option value="">All Roles</option>
                        {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                </div>

                <div className="filter-group">
                    <select name="isActive" value={filters.isActive} onChange={handleFilterChange} className="filter-select">
                        <option value="">All Status</option>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                    </select>
                </div>

                {selectedUsers.length > 0 && (
                    <div className="bulk-actions">
                        <span className="selected-count">{selectedUsers.length} selected</span>
                        <button className="btn-danger" onClick={() => handleBulkAction('delete')}>
                            <i className="fas fa-trash" /> Delete Selected
                        </button>
                    </div>
                )}
            </div>

            {loading ? (
                <Loading text="Loading users..." />
            ) : (
                <>
                    <UserTable
                        users={users}
                        roles={roles}
                        selectedUsers={selectedUsers}
                        setSelectedUsers={setSelectedUsers}
                        onEdit={(user) => { setSelectedUser(user); setShowModal(true); }}
                        onDelete={(user) => { setSelectedUser(user); setShowDeleteConfirm(true); }}
                        onResetPassword={handleResetPassword}
                    />

                    {pagination.totalPages > 1 && (
                        <div className="pagination">
                            <button onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))} disabled={pagination.page === 1} className="pagination-btn">Previous</button>
                            <span className="page-info">Page {pagination.page} of {pagination.totalPages}</span>
                            <button onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))} disabled={pagination.page === pagination.totalPages} className="pagination-btn">Next</button>
                        </div>
                    )}
                </>
            )}

            <Modal isOpen={showModal} onClose={() => { setShowModal(false); setSelectedUser(null); }} title={selectedUser ? 'Edit User' : 'Create New User'} size="large">
                <UserForm user={selectedUser} roles={roles} onSubmit={handleSaveUser} onCancel={() => { setShowModal(false); setSelectedUser(null); }} />
            </Modal>

            <ConfirmDialog
                isOpen={showDeleteConfirm}
                onClose={() => { setShowDeleteConfirm(false); setSelectedUser(null); setSelectedUsers([]); }}
                onConfirm={handleDeleteUser}
                title="Confirm Deletion"
                message={selectedUsers.length > 0 ? `Are you sure you want to delete ${selectedUsers.length} users? This action cannot be undone.` : `Are you sure you want to delete ${selectedUser?.firstName || ''} ${selectedUser?.lastName || ''}? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                type="danger"
            />
        </div>
    );
};

export default UserManagement;
