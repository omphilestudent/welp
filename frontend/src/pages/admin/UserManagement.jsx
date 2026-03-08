import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth'; // Add this import
import Modal from '../../components/common/Modal';
import UserForm from '../../components/admin/UserForm';
import UserTable from '../../components/admin/UserTable';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loading from '../../components/common/Loading';
import './UserManagement.css';

const UserManagement = () => {
    const navigate = useNavigate();
    const { user } = useAuth(); // Get user from auth context
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [filters, setFilters] = useState({
        search: '',
        roleId: '',
        department: '',
        isActive: ''
    });
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0
    });

    const {
        execute: fetchUsersApi,
        loading: usersLoading,
        error: usersError
    } = useApi('/rbac/users', 'get');

    const {
        execute: fetchRolesApi,
        data: rolesData,
        error: rolesError
    } = useApi('/rbac/users/roles/available', 'get');

    const {
        execute: createUserApi
    } = useApi('/rbac/users', 'post');

    const {
        execute: updateUserApi
    } = useApi('/rbac/users', 'put');

    const {
        execute: deleteUserApi
    } = useApi('/rbac/users', 'delete');

    const {
        execute: bulkDeleteUsersApi
    } = useApi('/rbac/users/bulk-delete', 'post');

    const {
        execute: resetPasswordApi
    } = useApi('/rbac/users/reset-password', 'post');

    const fetchUsers = async () => {
        try {
            const params = {
                page: pagination.page,
                limit: pagination.limit,
                ...filters
            };

            console.log('Fetching users with params:', params);
            const result = await fetchUsersApi(null, { params }); // Fixed: pass params correctly

            if (result?.success) {
                setUsers(result.data?.users || []);
                setPagination(prev => ({
                    ...prev,
                    total: result.data?.total || 0,
                    totalPages: result.data?.totalPages || 0
                }));
            } else {
                console.log('Fetch users result not successful:', result);
            }
        } catch (error) {
            console.error('Error in fetchUsers:', error);
            // Don't navigate on error, just show toast
            toast.error('Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    const fetchRoles = async () => {
        try {
            console.log('Fetching roles...');
            const result = await fetchRolesApi();
            console.log('Fetch roles result:', result);

            if (result?.success) {
                setRoles(result.data || []);
            } else {
                console.log('Fetch roles not successful:', result);
                // Set empty roles array if fetch fails
                setRoles([]);
            }
        } catch (error) {
            console.error('Error in fetchRoles:', error);
            // Don't navigate on error
            setRoles([]);
        }
    };

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // Fetch roles and users in parallel
                await Promise.all([
                    fetchRoles(),
                    fetchUsers()
                ]);
            } catch (error) {
                console.error('Error loading data:', error);
                // Check if it's an auth error
                if (error?.response?.status === 401) {
                    console.log('Auth error detected, but letting AdminRoute handle it');
                    // Don't navigate - let the AdminRoute component handle it
                } else {
                    toast.error('Failed to load data');
                }
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [pagination.page, filters.search, filters.roleId, filters.department, filters.isActive]); // Add all filter dependencies

    const handleSaveUser = async (userData) => {
        let result;

        try {
            if (selectedUser) {
                result = await updateUserApi(userData);
            } else {
                result = await createUserApi(userData);
            }

            if (result?.success) {
                toast.success(selectedUser ? 'User updated successfully' : 'User created successfully');
                setShowModal(false);
                setSelectedUser(null);
                fetchUsers(); // Refresh the list
            } else {
                toast.error(result?.error || 'Operation failed');
            }
        } catch (error) {
            console.error('Error saving user:', error);
            toast.error('Failed to save user');
        }
    };

    const handleDeleteUser = async () => {
        try {
            let result;

            if (selectedUsers.length > 0) {
                result = await bulkDeleteUsersApi({ userIds: selectedUsers });

                if (result?.success) {
                    toast.success(`${selectedUsers.length} users deleted successfully`);
                    setSelectedUsers([]);
                }
            } else if (selectedUser) {
                result = await deleteUserApi(null, { params: { id: selectedUser.id } });

                if (result?.success) {
                    toast.success('User deleted successfully');
                }
            }

            if (result?.success) {
                setShowDeleteConfirm(false);
                setSelectedUser(null);
                fetchUsers(); // Refresh the list
            } else {
                toast.error(result?.error || 'Delete failed');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            toast.error('Failed to delete user');
        }
    };

    const handleResetPassword = async (userId) => {
        const newPassword = window.prompt('Enter new password (min 8 characters):');

        if (!newPassword) return;

        if (newPassword.length < 8) {
            toast.error('Password must be at least 8 characters long');
            return;
        }

        try {
            const result = await resetPasswordApi({ userId, newPassword });

            if (result?.success) {
                toast.success('Password reset successfully');
            } else {
                toast.error(result?.error || 'Failed to reset password');
            }
        } catch (error) {
            console.error('Error resetting password:', error);
            toast.error('Failed to reset password');
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
        setPagination((prev) => ({ ...prev, page: 1 })); // Reset to first page on filter change
    };

    const handleBulkAction = (action) => {
        if (selectedUsers.length === 0) {
            toast.error('Please select users first');
            return;
        }

        if (action === 'delete') setShowDeleteConfirm(true);
    };

    // Add a check to verify user has access before rendering
    if (!user) {
        console.log('No user in UserManagement, but should be handled by AdminRoute');
        return null; // Let the AdminRoute handle the redirect
    }

    return (
        <div className="user-management">
            <div className="page-header">
                <h1>User Management</h1>
                <div className="header-actions">
                    <button
                        className="btn-primary"
                        onClick={() => {
                            setSelectedUser(null);
                            setShowModal(true);
                        }}
                    >
                        <i className="fas fa-plus" /> Create New User
                    </button>
                </div>
            </div>

            <div className="filters-section">
                <div className="filter-group">
                    <input
                        type="text"
                        name="search"
                        placeholder="Search by name or email..."
                        value={filters.search}
                        onChange={handleFilterChange}
                        className="search-input"
                    />
                </div>

                <div className="filter-group">
                    <select
                        name="roleId"
                        value={filters.roleId}
                        onChange={handleFilterChange}
                        className="filter-select"
                    >
                        <option value="">All Roles</option>
                        {roles && roles.map((role) => (
                            <option key={role.id || role._id} value={role.id || role._id}>
                                {role.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <select
                        name="isActive"
                        value={filters.isActive}
                        onChange={handleFilterChange}
                        className="filter-select"
                    >
                        <option value="">All Status</option>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                    </select>
                </div>

                {selectedUsers.length > 0 && (
                    <div className="bulk-actions">
                        <span className="selected-count">
                            {selectedUsers.length} selected
                        </span>
                        <button
                            className="btn-danger"
                            onClick={() => handleBulkAction('delete')}
                        >
                            <i className="fas fa-trash" /> Delete Selected
                        </button>
                    </div>
                )}
            </div>

            {(loading || usersLoading) ? (
                <Loading text="Loading users..." />
            ) : (
                <>
                    <UserTable
                        users={users}
                        roles={roles}
                        selectedUsers={selectedUsers}
                        setSelectedUsers={setSelectedUsers}
                        onEdit={(user) => {
                            setSelectedUser(user);
                            setShowModal(true);
                        }}
                        onDelete={(user) => {
                            setSelectedUser(user);
                            setShowDeleteConfirm(true);
                        }}
                        onResetPassword={handleResetPassword}
                    />

                    {pagination.totalPages > 1 && (
                        <div className="pagination">
                            <button
                                onClick={() => setPagination((prev) => ({
                                    ...prev,
                                    page: prev.page - 1
                                }))}
                                disabled={pagination.page === 1}
                                className="pagination-btn"
                            >
                                Previous
                            </button>
                            <span className="page-info">
                                Page {pagination.page} of {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => setPagination((prev) => ({
                                    ...prev,
                                    page: prev.page + 1
                                }))}
                                disabled={pagination.page === pagination.totalPages}
                                className="pagination-btn"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}

            <Modal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setSelectedUser(null);
                }}
                title={selectedUser ? 'Edit User' : 'Create New User'}
                size="large"
            >
                <UserForm
                    user={selectedUser}
                    roles={roles}
                    onSubmit={handleSaveUser}
                    onCancel={() => {
                        setShowModal(false);
                        setSelectedUser(null);
                    }}
                />
            </Modal>

            <ConfirmDialog
                isOpen={showDeleteConfirm}
                onClose={() => {
                    setShowDeleteConfirm(false);
                    setSelectedUser(null);
                    setSelectedUsers([]);
                }}
                onConfirm={handleDeleteUser}
                title="Confirm Deletion"
                message={
                    selectedUsers.length > 0
                        ? `Are you sure you want to delete ${selectedUsers.length} users? This action cannot be undone.`
                        : `Are you sure you want to delete ${selectedUser?.firstName || ''} ${selectedUser?.lastName || ''}? This action cannot be undone.`
                }
                confirmText="Delete"
                cancelText="Cancel"
                type="danger"
            />
        </div>
    );
};

export default UserManagement;