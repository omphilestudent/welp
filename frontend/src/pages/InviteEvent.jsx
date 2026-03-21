import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';

const InviteEvent = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [invite, setInvite] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadInvite = async () => {
            try {
                const { data } = await api.get(`/users/events/invite/${token}`);
                setInvite(data?.invite || null);
            } catch (err) {
                setError(err?.response?.data?.error || 'Invite not found');
            } finally {
                setLoading(false);
            }
        };
        loadInvite();
    }, [token]);

    const acceptInvite = async () => {
        try {
            await api.post(`/users/events/invite/${token}/accept`);
            if (invite?.conversation_id) {
                navigate(`/messages?conversation=${invite.conversation_id}&autostart=1`);
            }
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to accept invite');
        }
    };

    if (loading) return <p className="empty-message">Loading invite...</p>;
    if (error) return <div className="alert alert-error">{error}</div>;

    const startTime = invite?.starts_at ? new Date(invite.starts_at).toLocaleString() : '';

    return (
        <div className="profile-section-card" style={{ maxWidth: 720, margin: '2rem auto' }}>
            <h2>{invite?.title || 'Session invite'}</h2>
            <p>{invite?.description || 'You have been invited to a session.'}</p>
            <p><strong>When:</strong> {startTime}</p>
            <p><strong>Type:</strong> {invite?.event_type || 'meeting'}</p>

            {!user ? (
                <div style={{ marginTop: '1.5rem' }}>
                    <p>Please create an account or login to join this session.</p>
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            localStorage.setItem('welp_invite_return', `/invite/${token}`);
                            navigate('/register');
                        }}
                    >
                        Create account
                    </button>
                    <button
                        className="btn btn-outline"
                        style={{ marginLeft: '0.75rem' }}
                        onClick={() => {
                            localStorage.setItem('welp_invite_return', `/invite/${token}`);
                            navigate('/login');
                        }}
                    >
                        Login
                    </button>
                </div>
            ) : (
                <div style={{ marginTop: '1.5rem' }}>
                    <button className="btn btn-primary" onClick={acceptInvite}>
                        Accept & join
                    </button>
                </div>
            )}
        </div>
    );
};

export default InviteEvent;
