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
    const [filters, setFilters] = useState({ search: '', role: '', status: '' });
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/admin/users', {
                params: {
                    page: pagination.page,
                    limit: pagination.limit,
                    search: filters.search,
                    role: filters.role || undefined,
                    status: filters.status || undefined
                }
            });

            const mappedUsers = (data.users || []).map((u) => {
                const parts = (u.display_name || '').trim().split(/\s+/);
                return {
                    id: u.id,
                    email: u.email,
                    firstName: parts[0] || 'User',
                    lastName: parts.slice(1).join(' ') || '',
                    role: u.role,
                    department: u.department || '',
                    phoneNumber: u.phone_number || '',
                    profilePicture: u.avatar_url || '',
                    isActive: true,
                    emailVerified: Boolean(u.is_verified),
                    lastLogin: null
                };
            });

            setUsers(mappedUsers);
            const paginationData = data.pagination || {};
            setPagination((prev) => ({
                ...prev,
                total: Number(paginationData.total || 0),
                totalPages: Number(paginationData.pages || 0)
            }));
        } catch (error) {
            console.error('Error fetching users:', error);
            toast.error('Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    const fetchRoles = async () => {
        try {
            const { data } = await api.get('/admin/users', { params: { page: 1, limit: 100 } });
            const roleSet = new Set((data.users || []).map((u) => u.role).filter(Boolean));
            const derivedRoles = [...roleSet].map((name, idx) => ({ id: idx + 1, name }));
            setRoles(derivedRoles);
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
                await api.patch(`/admin/users/${selectedUser.id}`, {
                    role: userData.role || selectedUser.role,
                    displayName: `${userData.firstName} ${userData.lastName}`.trim(),
                    isVerified: Boolean(userData.isActive)
                });
                toast.success('User updated successfully');
            } else {
                await api.post('/admin/users', {
                    email: userData.email,
                    password: userData.password,
                    role: userData.role || 'employee',
                    displayName: `${userData.firstName} ${userData.lastName}`.trim(),
                    isAnonymous: false
                });
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
                await Promise.all(selectedUsers.map((id) => api.delete(`/admin/users/${id}`)));
                toast.success(`${selectedUsers.length} users deleted successfully`);
                setSelectedUsers([]);
            } else if (selectedUser) {
                await api.delete(`/admin/users/${selectedUser.id}`);
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

    const handleResetPassword = async () => {
        toast.error('Password reset endpoint is not available on current admin API');
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
        setPagination((prev) => ({ ...prev, page: 1 }));
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
                    <select name="role" value={filters.role} onChange={handleFilterChange} className="filter-select">
                        <option value="">All Roles</option>
                        {roles.map((role) => <option key={role.name} value={role.name}>{role.name}</option>)}
                    </select>
                </div>

                <div className="filter-group">
                    <select name="status" value={filters.status} onChange={handleFilterChange} className="filter-select">
                        <option value="">All Status</option>
                        <option value="verified">Verified</option>
                        <option value="pending">Pending</option>
                    </select>
                </div>

                {selectedUsers.length > 0 && (
                    <div className="bulk-actions">
                        <span className="selected-count">{selectedUsers.length} selected</span>
                        <button className="btn-danger" onClick={() => setShowDeleteConfirm(true)}>
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
