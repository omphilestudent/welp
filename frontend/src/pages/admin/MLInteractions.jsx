import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

const normalizeInteractions = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.interactions)) return payload.interactions;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
};

const MLInteractions = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [interactions, setInteractions] = useState([]);

    useEffect(() => {
        const fetchInteractions = async () => {
            try {
                setLoading(true);
                setError('');

                const { data } = await api.get('/admin/ml-interactions');
                setInteractions(normalizeInteractions(data));
            } catch (err) {
                setError(err?.response?.data?.message || 'Failed to load ML interactions.');
            } finally {
                setLoading(false);
            }
        };

        fetchInteractions();
    }, []);


    const userRole = String(user?.role || '').toLowerCase().trim();
    const isSuperAdmin = ['super_admin', 'superadmin', 'system_admin'].includes(userRole);

    if (!isSuperAdmin) {
        return (
            <div className="admin-page-container">
                <div className="page-header">
                    <h1>ML Interactions</h1>
                    <p>This section is restricted to super administrators.</p>
                </div>
            </div>
        );
    }

    const summary = useMemo(() => {
        const total = interactions.length;
        const pending = interactions.filter((item) => String(item?.status || '').toLowerCase() === 'pending').length;
        const edited = interactions.filter((item) => String(item?.status || '').toLowerCase() === 'edited').length;
        return { total, pending, edited };
    }, [interactions]);

    const markAsEdited = async (item) => {
        const id = item?.id || item?._id;
        if (!id) return;

        try {
            await api.patch(`/admin/ml-interactions/${id}`, { status: 'edited' });
            setInteractions((prev) => prev.map((row) => ((row.id || row._id) === id ? { ...row, status: 'edited' } : row)));
        } catch (err) {
            setError(err?.response?.data?.message || 'Unable to update interaction status.');
        }
    };

    return (
        <div className="admin-page-container">
            <div className="page-header">
                <h1>ML Interactions</h1>
                <p>Super admins can review AI activity and mark records that required human edits.</p>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div className="stat-card"><strong>Total:</strong> {summary.total}</div>
                <div className="stat-card"><strong>Pending review:</strong> {summary.pending}</div>
                <div className="stat-card"><strong>Edited:</strong> {summary.edited}</div>
            </div>

            {loading && <p>Loading ML interactions...</p>}
            {!loading && error && <p style={{ color: '#e53e3e' }}>{error}</p>}

            {!loading && !error && interactions.length === 0 && (
                <p>No ML interactions found.</p>
            )}

            {!loading && interactions.length > 0 && (
                <div className="table-container" style={{ overflowX: 'auto' }}>
                    <table className="admin-table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Type</th>
                                <th>User</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {interactions.map((item) => {
                                const id = item?.id || item?._id || '-';
                                const status = String(item?.status || 'pending').toLowerCase();
                                return (
                                    <tr key={id}>
                                        <td>{id}</td>
                                        <td>{item?.type || item?.interaction_type || 'N/A'}</td>
                                        <td>{item?.user_email || item?.userId || item?.user_id || 'N/A'}</td>
                                        <td>{status}</td>
                                        <td>{item?.created_at ? new Date(item.created_at).toLocaleString() : 'N/A'}</td>
                                        <td>
                                            <button
                                                className="btn btn-sm"
                                                onClick={() => markAsEdited(item)}
                                                disabled={status === 'edited'}
                                            >
                                                {status === 'edited' ? 'Edited' : 'Mark edited'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default MLInteractions;
