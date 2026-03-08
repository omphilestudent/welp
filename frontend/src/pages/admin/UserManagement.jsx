import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { useAuth } from '../../hooks/useAuth';
import Modal from '../../components/common/Modal';
import UserForm from '../../components/admin/UserForm';
import UserTable from '../../components/admin/UserTable';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Loading from '../../components/common/Loading';
import './UserManagement.css';

const UserManagement = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated, loading: authLoading } = useAuth();
    const [adminProfile, setAdminProfile] = useState(null);
    const [checkingAdmin, setCheckingAdmin] = useState(true);
    const [adminCheckComplete, setAdminCheckComplete] = useState(false);
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
        isActive: ''
    });
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0
    });

    // API hooks
    const {
        execute: fetchAdminProfile,
        loading: adminProfileLoading
    } = useApi('/admin/profile', 'get');

    const {
        execute: fetchUsersApi,
        loading: usersLoading
    } = useApi('/admin/users', 'get');

    const {
        execute: fetchRolesApi
    } = useApi('/admin/roles', 'get');

    const {
        execute: createUserApi
    } = useApi('/admin/users', 'post');

    const {
        execute: updateUserApi
    } = useApi('/admin/users', 'put');

    const {
        execute: deleteUserApi
    } = useApi('/admin/users', 'delete');

    const {
        execute: bulkDeleteUsersApi
    } = useApi('/admin/users/bulk-delete', 'post');

    const {
        execute: resetPasswordApi
    } = useApi('/admin/users/reset-password', 'post');

    // Combined auth and admin check
    useEffect(() => {
        let isMounted = true;

        const initializePage = async () => {
            // Wait for auth to load
            if (authLoading) {
                console.log('Auth loading...');
                return;
            }

            // Check if authenticated
            if (!isAuthenticated || !user) {
                console.log('User not authenticated, redirecting to login');
                navigate('/login', {
                    replace: true,
                    state: { from: '/admin/users', message: 'Please login to access user management' }
                });
                return;
            }

            // User is authenticated, now check admin profile
            console.log('User authenticated, checking admin profile...');
            setCheckingAdmin(true);

            try {
                const result = await fetchAdminProfile();

                if (!isMounted) return;

                if (result && result.data) {
                    console.log('✅ Admin access granted - role:', result.data.role_name);
                    setAdminProfile(result.data);
                    // Success - we have admin access, now load data
                } else {
                    console.log('❌ No admin profile found');
                    toast.error('You do not have admin access');
                    navigate('/dashboard', { replace: true });
                }
            } catch (error) {
                console.error('❌ Error checking admin profile:', error);

                if (!isMounted) return;

                // Check if it's a 403 (forbidden - not admin)
                if (error.response?.status === 403) {
                    toast.error('You do not have admin access');
                    navigate('/dashboard', { replace: true });
                } else if (error.response?.status === 401) {
                    // Session expired
                    navigate('/login', {
                        replace: true,
                        state: { from: '/admin/users', message: 'Session expired. Please login again.' }
                    });
                } else {
                    // For other errors, show error but don't redirect
                    toast.error('Error verifying admin access');
                }
            } finally {
                if (isMounted) {
                    setCheckingAdmin(false);
                    setAdminCheckComplete(true);
                }
            }
        };

        initializePage();

        return () => {
            isMounted = false;
        };
    }, [authLoading, isAuthenticated, user]);

    // Load data when admin profile is confirmed
    useEffect(() => {
        if (!adminCheckComplete || !adminProfile) return;

        const loadData = async () => {
            setLoading(true);
            try {
                await Promise.all([
                    fetchRolesData(),
                    fetchUsersData()
                ]);
            } catch (error) {
                console.error('Error loading data:', error);
                toast.error('Failed to load some data');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [adminCheckComplete, adminProfile, pagination.page, filters.search, filters.roleId, filters.isActive]);

    const fetchRolesData = async () => {
        try {
            const result = await fetchRolesApi();
            if (result?.success && result.data) {
                setRoles(result.data);
            } else {
                // Default roles as fallback
                setRoles([
                    { id: 'admin', name: 'Admin' },
                    { id: 'super_admin', name: 'Super Admin' },
                    { id: 'user', name: 'User' },
                    { id: 'psychologist', name: 'Psychologist' },
                    { id: 'business', name: 'Business' },
                    { id: 'employee', name: 'Employee' }
                ]);
            }
        } catch (error) {
            console.error('Error fetching roles:', error);
            setRoles([
                { id: 'admin', name: 'Admin' },
                { id: 'super_admin', name: 'Super Admin' },
                { id: 'user', name: 'User' },
                { id: 'psychologist', name: 'Psychologist' },
                { id: 'business', name: 'Business' },
                { id: 'employee', name: 'Employee' }
            ]);
        }
    };

    const fetchUsersData = async () => {
        try {
            const params = {
                page: pagination.page,
                limit: pagination.limit,
                search: filters.search || undefined,
                role: filters.roleId || undefined,
                isActive: filters.isActive || undefined
            };

            // Remove undefined values
            Object.keys(params).forEach(key =>
                params[key] === undefined && delete params[key]
            );

            const result = await fetchUsersApi(null, { params });

            if (result?.success) {
                setUsers(result.data?.users || []);
                setPagination(prev => ({
                    ...prev,
                    total: result.data?.total || 0,
                    totalPages: Math.ceil((result.data?.total || 0) / prev.limit)
                }));
            } else {
                setUsers([]);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            setUsers([]);
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
        setPagination((prev) => ({ ...prev, page: 1 }));
    };

    const handleSaveUser = async (userData) => {
        if (!adminProfile) {
            toast.error('Admin access required');
            return;
        }

        try {
            const result = selectedUser
                ? await updateUserApi({ ...userData, id: selectedUser.id })
                : await createUserApi(userData);

            if (result?.success) {
                toast.success(selectedUser ? 'User updated successfully' : 'User created successfully');
                setShowModal(false);
                setSelectedUser(null);
                await fetchUsersData();
            } else {
                toast.error(result?.error || 'Operation failed');
            }
        } catch (error) {
            console.error('Error saving user:', error);
            toast.error('Failed to save user');
        }
    };

    const handleDeleteUser = async () => {
        if (!adminProfile) {
            toast.error('Admin access required');
            return;
        }

        try {
            let result;

            if (selectedUsers.length > 0) {
                result = await bulkDeleteUsersApi({ userIds: selectedUsers });
            } else if (selectedUser) {
                result = await deleteUserApi(null, { params: { id: selectedUser.id } });
            }

            if (result?.success) {
                toast.success(selectedUsers.length > 0
                    ? `${selectedUsers.length} users deleted successfully`
                    : 'User deleted successfully'
                );
                setShowDeleteConfirm(false);
                setSelectedUser(null);
                setSelectedUsers([]);
                await fetchUsersData();
            } else {
                toast.error(result?.error || 'Delete failed');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            toast.error('Failed to delete user');
        }
    };

    const handleResetPassword = async (userId) => {
        if (!adminProfile) {
            toast.error('Admin access required');
            return;
        }

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

    const handleBulkAction = (action) => {
        if (selectedUsers.length === 0) {
            toast.error('Please select users first');
            return;
        }
        if (action === 'delete') setShowDeleteConfirm(true);
    };

    const handleRefresh = () => {
        setLoading(true);
        Promise.all([fetchRolesData(), fetchUsersData()]).finally(() => setLoading(false));
    };

    // Show loading while checking auth
    if (authLoading) {
        return <Loading text="Checking authentication..." />;
    }

    // Don't render anything if not authenticated (redirect will happen in useEffect)
    if (!isAuthenticated || !user) {
        return null;
    }

    // Show loading while checking admin profile
    if (checkingAdmin) {
        return <Loading text="Verifying admin access..." />;
    }

    // If admin check is complete but no profile, don't render (redirect will happen)
    if (adminCheckComplete && !adminProfile) {
        return null;
    }

    // Render the page
    return (
        <div className="user-management">
            <div className="page-header">
                <h1>User Management</h1>
                <div className="header-actions">
                    <button
                        className="btn-secondary"
                        onClick={handleRefresh}
                        disabled={loading || usersLoading}
                    >
                        <i className="fas fa-sync-alt" /> Refresh
                    </button>
                    <button
                        className="btn-primary"
                        onClick={() => {
                            setSelectedUser(null);
                            setShowModal(true);
                        }}
                        disabled={loading || usersLoading}
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
                        disabled={loading || usersLoading}
                    />
                </div>

                <div className="filter-group">
                    <select
                        name="roleId"
                        value={filters.roleId}
                        onChange={handleFilterChange}
                        className="filter-select"
                        disabled={loading || usersLoading}
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
                        disabled={loading || usersLoading}
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
                            disabled={loading || usersLoading}
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
                        isLoading={loading || usersLoading}
                    />

                    {pagination.totalPages > 1 && (
                        <div className="pagination">
                            <button
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                disabled={pagination.page === 1 || loading || usersLoading}
                                className="pagination-btn"
                            >
                                Previous
                            </button>
                            <span className="page-info">
                                Page {pagination.page} of {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                disabled={pagination.page === pagination.totalPages || loading || usersLoading}
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
                    isLoading={loading || usersLoading}
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
                        : `Are you sure you want to delete ${selectedUser?.displayName || selectedUser?.email || ''}? This action cannot be undone.`
                }
                confirmText="Delete"
                cancelText="Cancel"
                type="danger"
                isLoading={loading || usersLoading}
            />
        </div>
    );
};

export default UserManagement;