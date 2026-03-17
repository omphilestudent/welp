import React, { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high'];

const AdminTickets = () => {
    const [tickets, setTickets] = useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [history, setHistory] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ status: '', priority: '', search: '' });
    const [accessUserId, setAccessUserId] = useState('');

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/admin/tickets', {
                params: {
                    status: filters.status || undefined,
                    priority: filters.priority || undefined,
                    search: filters.search || undefined
                }
            });
            setTickets(data?.data || []);
        } catch (error) {
            toast.error('Failed to load tickets');
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const { data } = await api.get('/admin/users', { params: { limit: 200 } });
            const list = data?.data?.users || data?.users || [];
            setUsers(list);
        } catch (error) {
            console.error('Failed to load users', error);
        }
    };

    const fetchHistory = async (ticketId) => {
        if (!ticketId) return;
        try {
            const { data } = await api.get(`/tickets/${ticketId}/history`);
            setHistory(data?.data || []);
        } catch (error) {
            toast.error('Failed to load history');
        }
    };

    useEffect(() => {
        fetchTickets();
    }, [filters.status, filters.priority]);

    useEffect(() => {
        fetchUsers();
    }, []);

    const visibleTickets = useMemo(() => {
        if (!filters.search) return tickets;
        const term = filters.search.toLowerCase();
        return tickets.filter((ticket) =>
            ticket.title?.toLowerCase().includes(term)
            || ticket.ticket_number?.toLowerCase().includes(term)
        );
    }, [tickets, filters.search]);

    const handleSelect = (ticket) => {
        setSelectedTicket(ticket);
        fetchHistory(ticket.id);
    };

    const handleAssign = async (ticketId, userId) => {
        if (!userId) return;
        try {
            const { data } = await api.put(`/admin/tickets/${ticketId}/assign`, {
                assignedToUserId: userId
            });
            toast.success('Ticket assigned');
            setTickets((prev) => prev.map((item) => (item.id === ticketId ? data?.data : item)));
            if (selectedTicket?.id === ticketId) {
                setSelectedTicket(data?.data);
            }
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to assign ticket');
        }
    };

    const handleStatus = async (ticketId, status) => {
        try {
            const { data } = await api.put(`/tickets/${ticketId}`, { status });
            setTickets((prev) => prev.map((item) => (item.id === ticketId ? data?.data : item)));
            if (selectedTicket?.id === ticketId) {
                setSelectedTicket(data?.data);
            }
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const handlePriority = async (ticketId, priority) => {
        try {
            const { data } = await api.put(`/tickets/${ticketId}`, { priority });
            setTickets((prev) => prev.map((item) => (item.id === ticketId ? data?.data : item)));
            if (selectedTicket?.id === ticketId) {
                setSelectedTicket(data?.data);
            }
        } catch (error) {
            toast.error('Failed to update priority');
        }
    };

    const handleGrantAccess = async () => {
        if (!selectedTicket || !accessUserId) return;
        try {
            await api.post(`/admin/tickets/${selectedTicket.id}/access`, {
                userId: accessUserId
            });
            toast.success('Access granted');
            setAccessUserId('');
            fetchHistory(selectedTicket.id);
        } catch (error) {
            toast.error('Failed to grant access');
        }
    };

    if (loading) return <Loading />;

    return (
        <div className="tickets-page">
            <header className="tickets-hero">
                <div>
                    <h1>Ticket Admin</h1>
                    <p>Assign, track, and resolve all support tickets.</p>
                </div>
            </header>

            <section className="tickets-grid">
                <div className="tickets-panel">
                    <div className="tickets-panel-header">
                        <h2>All tickets</h2>
                        <div className="tickets-filters">
                            <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
                                <option value="">All statuses</option>
                                {STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>{status}</option>
                                ))}
                            </select>
                            <select value={filters.priority} onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))}>
                                <option value="">All priorities</option>
                                {PRIORITY_OPTIONS.map((priority) => (
                                    <option key={priority} value={priority}>{priority}</option>
                                ))}
                            </select>
                            <input
                                placeholder="Search"
                                value={filters.search}
                                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div className="tickets-list">
                        {visibleTickets.length === 0 ? (
                            <p className="tickets-empty">No tickets found.</p>
                        ) : (
                            visibleTickets.map((ticket) => (
                                <button
                                    key={ticket.id}
                                    className={`tickets-card ${selectedTicket?.id === ticket.id ? 'active' : ''}`}
                                    onClick={() => handleSelect(ticket)}
                                >
                                    <div>
                                        <span className={`status-pill status-${ticket.status}`}>{ticket.status}</span>
                                        <h4>{ticket.title}</h4>
                                        <p>{ticket.ticket_number}</p>
                                    </div>
                                    <span className={`priority-pill priority-${ticket.priority}`}>{ticket.priority}</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {selectedTicket && (
                    <div className="tickets-panel tickets-detail">
                        <div className="tickets-panel-header">
                            <div>
                                <h2>{selectedTicket.title}</h2>
                                <p>{selectedTicket.ticket_number}</p>
                            </div>
                            <div className="tickets-admin-actions">
                                <select value={selectedTicket.status} onChange={(e) => handleStatus(selectedTicket.id, e.target.value)}>
                                    {STATUS_OPTIONS.map((status) => (
                                        <option key={status} value={status}>{status}</option>
                                    ))}
                                </select>
                                <select value={selectedTicket.priority} onChange={(e) => handlePriority(selectedTicket.id, e.target.value)}>
                                    {PRIORITY_OPTIONS.map((priority) => (
                                        <option key={priority} value={priority}>{priority}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <p className="tickets-description">{selectedTicket.description}</p>

                        <div className="tickets-admin-assign">
                            <label>Assign to</label>
                            <select
                                value={selectedTicket.assigned_to_user_id || ''}
                                onChange={(e) => handleAssign(selectedTicket.id, e.target.value)}
                            >
                                <option value="">Unassigned</option>
                                {users.map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.display_name || user.email}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="tickets-admin-access">
                            <label>Grant access by user ID</label>
                            <div className="tickets-access-row">
                                <input
                                    placeholder="User UUID"
                                    value={accessUserId}
                                    onChange={(e) => setAccessUserId(e.target.value)}
                                />
                                <button className="btn btn-secondary" onClick={handleGrantAccess}>Grant</button>
                            </div>
                        </div>

                        <div className="tickets-history">
                            <h3>History</h3>
                            {history.length === 0 ? (
                                <p className="tickets-empty">No history yet.</p>
                            ) : (
                                history.map((item) => (
                                    <div key={item.id} className="tickets-history-row">
                                        <div>
                                            <strong>{item.action.replace('_', ' ')}</strong>
                                            <span>{item.notes}</span>
                                        </div>
                                        <span>{new Date(item.created_at).toLocaleString()}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
};

export default AdminTickets;
