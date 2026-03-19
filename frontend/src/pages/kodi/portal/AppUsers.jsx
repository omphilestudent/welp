import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Loading from '../../../components/common/Loading';
import AppUsersTable from '../../../components/kodi/portal/AppUsersTable';
import AssignUserModal from '../../../components/kodi/portal/AssignUserModal';
import {
    assignPortalUser,
    listPortalUsers,
    resendPortalInvite,
    updatePortalUser,
    updatePortalUserStatus,
    deletePortalUser
} from '../../../services/kodiPortalService';

const AppUsers = () => {
    const { appId } = useParams();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [assignOpen, setAssignOpen] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const rows = await listPortalUsers(appId);
            setUsers(rows);
        } catch (error) {
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [appId]);

    const handleAssign = async (payload) => {
        try {
            await assignPortalUser(appId, payload);
            toast.success('Invitation sent');
            setAssignOpen(false);
            load();
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to assign user');
        }
    };

    const handleRoleChange = async (user, roleKey) => {
        try {
            await updatePortalUser(appId, user.user_id || user.id, { roleKey });
            load();
        } catch (error) {
            toast.error('Failed to update role');
        }
    };

    const handleStatusChange = async (user, status) => {
        try {
            await updatePortalUserStatus(appId, user.user_id || user.id, { status });
            load();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const handleResend = async (user) => {
        try {
            await resendPortalInvite(appId, user.user_id || user.id);
            toast.success('Invite resent');
        } catch (error) {
            toast.error('Failed to resend invite');
        }
    };

    const handleRemove = async (user) => {
        try {
            await deletePortalUser(appId, user.user_id || user.id);
            toast.success('User removed');
            load();
        } catch (error) {
            toast.error('Failed to remove user');
        }
    };

    return (
        <div className="kodi-portal-screen">
            <header className="kodi-portal-header">
                <div>
                    <p className="kodi-portal-eyebrow">Kodi Portal</p>
                    <h1>App Users</h1>
                </div>
                <button className="btn-primary" onClick={() => setAssignOpen(true)}>Assign User</button>
            </header>
            {loading ? (
                <Loading />
            ) : (
                <AppUsersTable
                    users={users}
                    onRoleChange={handleRoleChange}
                    onStatusChange={handleStatusChange}
                    onResend={handleResend}
                    onRemove={handleRemove}
                />
            )}
            <AssignUserModal open={assignOpen} onClose={() => setAssignOpen(false)} onSubmit={handleAssign} />
        </div>
    );
};

export default AppUsers;
