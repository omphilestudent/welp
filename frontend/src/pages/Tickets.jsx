import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import Loading from '../components/common/Loading';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high'];

const Tickets = () => {
    const { user } = useAuth();
    const [tickets, setTickets] = useState([]);
    const [history, setHistory] = useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [search, setSearch] = useState('');
    const [form, setForm] = useState({
        title: '',
        description: '',
        priority: 'medium',
        category: ''
    });
    const [note, setNote] = useState('');

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/tickets', {
                params: {
                    status: filterStatus || undefined,
                    priority: filterPriority || undefined,
                    search: search || undefined
                }
            });
            setTickets(data?.data || []);
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to load tickets');
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async (ticketId) => {
        if (!ticketId) return;
        try {
            const { data } = await api.get(`/tickets/${ticketId}/history`);
            setHistory(data?.data || []);
        } catch (error) {
            toast.error('Failed to load ticket history');
        }
    };

    useEffect(() => {
        fetchTickets();
    }, [filterStatus, filterPriority]);

    const visibleTickets = useMemo(() => {
        if (!search) return tickets;
        const term = search.toLowerCase();
        return tickets.filter((ticket) =>
            ticket.title?.toLowerCase().includes(term)
            || ticket.ticket_number?.toLowerCase().includes(term)
        );
    }, [tickets, search]);

    const handleSelect = (ticket) => {
        setSelectedTicket(ticket);
        fetchHistory(ticket.id);
    };

    const handleFormChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleCreate = async (event) => {
        event.preventDefault();
        try {
            const { data } = await api.post('/tickets', form);
            toast.success('Ticket created');
            setForm({ title: '', description: '', priority: 'medium', category: '' });
            setTickets((prev) => [data?.data, ...prev]);
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to create ticket');
        }
    };

    const handleStatusUpdate = async (ticket, status) => {
        try {
            const { data } = await api.put(`/tickets/${ticket.id}`, { status });
            toast.success('Status updated');
            setTickets((prev) => prev.map((item) => (item.id === ticket.id ? data?.data : item)));
            if (selectedTicket?.id === ticket.id) {
                setSelectedTicket(data?.data);
            }
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to update status');
        }
    };

    const handleAddNote = async () => {
        if (!note.trim() || !selectedTicket) return;
        try {
            await api.post(`/tickets/${selectedTicket.id}/history`, { notes: note.trim() });
            setNote('');
            fetchHistory(selectedTicket.id);
        } catch (error) {
            toast.error('Failed to add note');
        }
    };

    const canUpdateStatus = (ticket) => {
        if (!ticket) return false;
        if (ticket.assigned_to_user_id === user?.id) return true;
        if (ticket.created_by_user_id === user?.id && !ticket.assigned_to_user_id) return true;
        return false;
    };

    if (loading) {
        return <Loading />;
    }

    return (
        <div className="tickets-page">
            <header className="tickets-hero">
                <div>
                    <h1>Support Tickets</h1>
                    <p>Log an issue, track updates, and collaborate with support.</p>
                </div>
            </header>

            <section className="tickets-grid">
                <div className="tickets-panel">
                    <div className="tickets-panel-header">
                        <h2>Create a ticket</h2>
                    </div>
                    <form className="tickets-form" onSubmit={handleCreate}>
                        <label>
                            <span>Title</span>
                            <input
                                name="title"
                                value={form.title}
                                onChange={handleFormChange}
                                required
                            />
                        </label>
                        <label>
                            <span>Description</span>
                            <textarea
                                name="description"
                                value={form.description}
                                onChange={handleFormChange}
                                required
                                rows="4"
                            />
                        </label>
                        <div className="tickets-form-row">
                            <label>
                                <span>Priority</span>
                                <select name="priority" value={form.priority} onChange={handleFormChange}>
                                    {PRIORITY_OPTIONS.map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                <span>Category</span>
                                <input name="category" value={form.category} onChange={handleFormChange} />
                            </label>
                        </div>
                        <button className="btn btn-primary" type="submit">Submit ticket</button>
                    </form>
                </div>

                <div className="tickets-panel">
                    <div className="tickets-panel-header">
                        <h2>Your tickets</h2>
                        <div className="tickets-filters">
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                                <option value="">All statuses</option>
                                {STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>{status}</option>
                                ))}
                            </select>
                            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
                                <option value="">All priorities</option>
                                {PRIORITY_OPTIONS.map((priority) => (
                                    <option key={priority} value={priority}>{priority}</option>
                                ))}
                            </select>
                            <input
                                placeholder="Search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
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
            </section>

            {selectedTicket && (
                <section className="tickets-panel tickets-detail">
                    <div className="tickets-panel-header">
                        <div>
                            <h2>{selectedTicket.title}</h2>
                            <p>{selectedTicket.ticket_number}</p>
                        </div>
                        {canUpdateStatus(selectedTicket) && (
                            <select
                                value={selectedTicket.status}
                                onChange={(e) => handleStatusUpdate(selectedTicket, e.target.value)}
                            >
                                {STATUS_OPTIONS.map((status) => (
                                    <option key={status} value={status}>{status}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <p className="tickets-description">{selectedTicket.description}</p>

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
                    <div className="tickets-note">
                        <textarea
                            placeholder="Add a note..."
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                        <button className="btn btn-secondary" onClick={handleAddNote}>Add note</button>
                    </div>
                </section>
            )}
        </div>
    );
};

export default Tickets;
