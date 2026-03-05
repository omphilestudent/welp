
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import Modal from '../../components/common/Modal';
import UserForm from '../../components/admin/UserForm';
import UserTable from '../../components/admin/UserTable';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loading from '../../components/common/Loading';
import './UserManagement.css';

const UserManagement = () => {
    const navigate = useNavigate();
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
        loading: usersLoading
    } = useApi('/rbac/users', 'get');

    const {
        execute: fetchRolesApi,
        data: rolesData
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

            const result = await fetchUsersApi(null, params);

            if (result.success) {
                setUsers(result.data.users || []);
                setPagination(prev => ({
                    ...prev,
                    total: result.data.total || 0,
                    totalPages: result.data.totalPages || 0
                }));
            }
        } catch (error) {
            console.error('Error in fetchUsers:', error);
        } finally {
            setLoading(false);
        }
    };


    const fetchRoles = async () => {
        const result = await fetchRolesApi();
        if (result.success) {
            setRoles(result.data || []);
        }
    };


    useEffect(() => {
        const checkAuth = async () => {
            try {
                await fetchRoles();
                await fetchUsers();
            } catch (error) {


                if (error.response?.status === 401) {
                    navigate('/login');
                }
            }
        };

        checkAuth();
    }, [pagination.page, filters]);

    const handleSaveUser = async (userData) => {
        let result;

        if (selectedUser) {

            result = await updateUserApi(
                userData,
                null,
                true
            );
        } else {

            result = await createUserApi(
                userData,
                null,
                true
            );
        }

        if (result.success) {
            setShowModal(false);
            setSelectedUser(null);
            fetchUsers();
        }
    };

    const handleDeleteUser = async () => {
        let result;

        if (selectedUsers.length > 0) {

            result = await bulkDeleteUsersApi(
                { userIds: selectedUsers },
                null,
                true
            );

            if (result.success) {
                setSelectedUsers([]);
            }
        } else if (selectedUser) {

            result = await deleteUserApi(
                null,
                null,
                true
            );




        }

        if (result.success) {
            setShowDeleteConfirm(false);
            setSelectedUser(null);
            fetchUsers();
        }
    };

    const handleResetPassword = async (userId) => {
        const newPassword = window.prompt('Enter new password (min 8 characters):');

        if (!newPassword || newPassword.length < 8) {
            toast.error('Password must be at least 8 characters long');
            return;
        }

        const result = await resetPasswordApi(
            { userId, newPassword },
            null,
            true
        );
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
                        {roles.map((role) => (
                            <option key={role.id} value={role.id}>
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

            {loading || usersLoading ? (
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