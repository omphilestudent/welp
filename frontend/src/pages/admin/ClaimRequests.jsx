import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ClaimRequests = () => {
    const [loading, setLoading] = useState(false);
    const [requests, setRequests] = useState([]);
    const [error, setError] = useState('');
    const [rejectReasons, setRejectReasons] = useState({});

    const fetchRequests = async () => {
        setLoading(true);
        setError('');
        try {
            const { data } = await api.get('/admin/claim-requests');
            setRequests(Array.isArray(data) ? data : data?.requests || []);
        } catch (err) {
            const message = err.response?.data?.error || 'Failed to load claim requests';
            setError(message);
            setRequests([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleApprove = async (id) => {
        try {
            await api.patch(`/admin/claim-requests/${id}/approve`);
            setRequests((prev) => prev.filter((r) => r.id !== id));
            toast.success('Claim approved');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to approve claim');
        }
    };

    const handleReject = async (id) => {
        const reason = rejectReasons[id] || '';
        try {
            await api.patch(`/admin/claim-requests/${id}/reject`, { reason });
            setRequests((prev) => prev.filter((r) => r.id !== id));
            toast.success('Claim rejected');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to reject claim');
        }
    };

    return (
        <div className="admin-page">
            <div className="admin-page-header">
                <div>
                    <h2>Business Claim Requests</h2>
                    <p>Review and approve ownership claims for business profiles.</p>
                </div>
                <button className="btn btn-secondary" onClick={fetchRequests} disabled={loading}>
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {loading ? (
                <div className="dashboard-loading">
                    <div className="spinner"></div>
                    <p>Loading claim requests...</p>
                </div>
            ) : requests.length === 0 ? (
                <div className="empty-message">No pending claim requests.</div>
            ) : (
                <div className="claim-request-grid">
                    {requests.map((req) => (
                        <div key={req.id} className="claim-request-card">
                            <div className="claim-request-header">
                                <div>
                                    <h3>{req.company?.name || 'Unknown Company'}</h3>
                                    <p className="claim-request-meta">
                                        Requested by {req.user?.displayName || req.user?.email || 'Unknown user'}
                                    </p>
                                </div>
                                <span className="claim-request-status">Pending</span>
                            </div>

                            <div className="claim-request-details">
                                <div>
                                    <strong>Business Email:</strong> {req.business_email || '-'}
                                </div>
                                <div>
                                    <strong>Business Phone:</strong> {req.business_phone || '-'}
                                </div>
                                <div>
                                    <strong>Position:</strong> {req.position || '-'}
                                </div>
                                {req.message && (
                                    <div>
                                        <strong>Message:</strong> {req.message}
                                    </div>
                                )}
                            </div>

                            <div className="claim-request-actions">
                                <button className="btn btn-primary" onClick={() => handleApprove(req.id)}>
                                    Approve
                                </button>
                                <div className="claim-request-reject">
                                    <input
                                        type="text"
                                        placeholder="Reject reason (optional)"
                                        value={rejectReasons[req.id] || ''}
                                        onChange={(e) =>
                                            setRejectReasons((prev) => ({ ...prev, [req.id]: e.target.value }))
                                        }
                                    />
                                    <button className="btn btn-outline" onClick={() => handleReject(req.id)}>
                                        Reject
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ClaimRequests;
