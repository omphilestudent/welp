const { query } = require('../utils/database');
const { sendTicketNotificationEmail } = require('../utils/emailService');

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITIES = ['low', 'medium', 'high'];

const isAdminRole = (role = '') => ['admin', 'super_admin'].includes(String(role).toLowerCase());

const generateTicketNumber = async () => {
    const prefix = 'TCK';
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const rand = Math.floor(1000 + Math.random() * 9000);
        const number = `${prefix}-${datePart}-${rand}`;
        const exists = await query(
            'SELECT 1 FROM tickets WHERE ticket_number = $1 LIMIT 1',
            [number]
        );
        if (exists.rows.length === 0) return number;
    }
    return `${prefix}-${datePart}-${Date.now().toString().slice(-6)}`;
};

const logHistory = async ({ ticketId, action, performedBy, notes }) => {
    try {
        await query(
            `INSERT INTO ticket_history (ticket_id, action, performed_by_user_id, notes)
             VALUES ($1, $2, $3, $4)`,
            [ticketId, action, performedBy || null, notes || null]
        );
    } catch (error) {
        console.warn('Ticket history log failed:', error.message);
    }
};

const sendTicketEmail = async ({ toUser, ticket, subject, notes }) => {
    if (!toUser?.email) return { success: false, reason: 'missing-email' };
    const result = await sendTicketNotificationEmail({
        receiverEmail: toUser.email,
        receiverName: toUser.display_name || toUser.email,
        ticketNumber: ticket.ticket_number,
        ticketTitle: ticket.title,
        ticketStatus: ticket.status,
        ticketId: ticket.id
    });
    if (!result?.success) {
        await logHistory({
            ticketId: ticket.id,
            action: 'email_failed',
            performedBy: null,
            notes: notes || result?.error || 'Email delivery failed'
        });
    }
    return result;
};

const fetchTicketById = async (ticketId) => {
    const result = await query(
        `SELECT *
         FROM tickets
         WHERE id = $1`,
        [ticketId]
    );
    return result.rows[0] || null;
};

const canAccessTicket = async ({ ticketId, userId, role }) => {
    if (isAdminRole(role)) return true;
    const access = await query(
        `SELECT 1
         FROM tickets t
         LEFT JOIN ticket_access a ON a.ticket_id = t.id AND a.user_id = $2
         WHERE t.id = $1
           AND (t.created_by_user_id = $2 OR t.assigned_to_user_id = $2 OR a.user_id IS NOT NULL)
         LIMIT 1`,
        [ticketId, userId]
    );
    return access.rows.length > 0;
};

const listTickets = async (req, res) => {
    try {
        const { status, priority, search } = req.query || {};
        const filters = [];
        const values = [];
        let idx = 1;

        if (status) {
            filters.push(`t.status = $${idx++}`);
            values.push(status);
        }
        if (priority) {
            filters.push(`t.priority = $${idx++}`);
            values.push(priority);
        }
        if (search) {
            filters.push(`(t.title ILIKE $${idx} OR t.ticket_number ILIKE $${idx})`);
            values.push(`%${search}%`);
            idx += 1;
        }

        if (isAdminRole(req.user.role)) {
            const result = await query(
                `SELECT t.*,
                        u.display_name as created_by_name,
                        a.display_name as assigned_to_name
                 FROM tickets t
                 LEFT JOIN users u ON t.created_by_user_id = u.id
                 LEFT JOIN users a ON t.assigned_to_user_id = a.id
                 ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
                 ORDER BY t.updated_at DESC`,
                values
            );
            return res.json({ success: true, data: result.rows });
        }

        values.unshift(req.user.id);
        const userFilters = [
            `(t.created_by_user_id = $1 OR t.assigned_to_user_id = $1 OR ta.user_id = $1)`
        ];
        if (filters.length) userFilters.push(...filters);
        const result = await query(
            `SELECT t.*,
                    u.display_name as created_by_name,
                    a.display_name as assigned_to_name
             FROM tickets t
             LEFT JOIN ticket_access ta ON ta.ticket_id = t.id
             LEFT JOIN users u ON t.created_by_user_id = u.id
             LEFT JOIN users a ON t.assigned_to_user_id = a.id
             WHERE ${userFilters.join(' AND ')}
             ORDER BY t.updated_at DESC`,
            values
        );
        return res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('List tickets error:', error);
        return res.status(500).json({ success: false, error: 'Failed to load tickets' });
    }
};

const getTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const allowed = await canAccessTicket({ ticketId: id, userId: req.user.id, role: req.user.role });
        if (!allowed) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        const result = await query(
            `SELECT t.*,
                    u.display_name as created_by_name,
                    a.display_name as assigned_to_name
             FROM tickets t
             LEFT JOIN users u ON t.created_by_user_id = u.id
             LEFT JOIN users a ON t.assigned_to_user_id = a.id
             WHERE t.id = $1`,
            [id]
        );
        if (!result.rows.length) {
            return res.status(404).json({ success: false, error: 'Ticket not found' });
        }
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Get ticket error:', error);
        return res.status(500).json({ success: false, error: 'Failed to load ticket' });
    }
};

const createTicket = async (req, res) => {
    try {
        const { title, description, priority, category } = req.body || {};
        if (!title || !description || !priority) {
            return res.status(400).json({ success: false, error: 'title, description, and priority are required' });
        }
        if (!PRIORITIES.includes(priority)) {
            return res.status(400).json({ success: false, error: 'Invalid priority' });
        }
        const ticketNumber = await generateTicketNumber();
        const result = await query(
            `INSERT INTO tickets (ticket_number, title, description, created_by_user_id, status, priority, category)
             VALUES ($1, $2, $3, $4, 'open', $5, $6)
             RETURNING *`,
            [ticketNumber, title, description, req.user.id, priority, category || null]
        );
        const ticket = result.rows[0];
        await logHistory({
            ticketId: ticket.id,
            action: 'created',
            performedBy: req.user.id,
            notes: 'Ticket created'
        });
        await sendTicketEmail({
            toUser: req.user,
            ticket,
            subject: 'Ticket created',
            notes: 'Ticket created email'
        });
        return res.status(201).json({ success: true, data: ticket });
    } catch (error) {
        console.error('Create ticket error:', error);
        return res.status(500).json({ success: false, error: 'Failed to create ticket' });
    }
};

const updateTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const ticket = await fetchTicketById(id);
        if (!ticket) {
            return res.status(404).json({ success: false, error: 'Ticket not found' });
        }
        const allowed = await canAccessTicket({ ticketId: id, userId: req.user.id, role: req.user.role });
        if (!allowed) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        const { status, priority, assignedToUserId, category } = req.body || {};
        const updates = [];
        const values = [];
        let idx = 1;

        const isAdmin = isAdminRole(req.user.role);
        if (status) {
            if (!STATUSES.includes(status)) {
                return res.status(400).json({ success: false, error: 'Invalid status' });
            }
            if (!isAdmin && ticket.assigned_to_user_id !== req.user.id) {
                return res.status(403).json({ success: false, error: 'Only assigned users can update status' });
            }
            updates.push(`status = $${idx++}`);
            values.push(status);
        }
        if (priority) {
            if (!isAdmin) {
                return res.status(403).json({ success: false, error: 'Only admins can update priority' });
            }
            if (!PRIORITIES.includes(priority)) {
                return res.status(400).json({ success: false, error: 'Invalid priority' });
            }
            updates.push(`priority = $${idx++}`);
            values.push(priority);
        }
        if (assignedToUserId !== undefined) {
            if (!isAdmin) {
                return res.status(403).json({ success: false, error: 'Only admins can assign tickets' });
            }
            updates.push(`assigned_to_user_id = $${idx++}`);
            values.push(assignedToUserId || null);
        }
        if (category !== undefined) {
            updates.push(`category = $${idx++}`);
            values.push(category || null);
        }

        if (!updates.length) {
            return res.status(400).json({ success: false, error: 'No updates provided' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        const result = await query(
            `UPDATE tickets
             SET ${updates.join(', ')}
             WHERE id = $${idx}
             RETURNING *`,
            values
        );
        const updated = result.rows[0];
        await logHistory({
            ticketId: id,
            action: 'updated',
            performedBy: req.user.id,
            notes: 'Ticket updated'
        });

        if (status && status !== ticket.status) {
            await logHistory({
                ticketId: id,
                action: 'status_changed',
                performedBy: req.user.id,
                notes: `Status changed to ${status}`
            });
            const recipients = [];
            if (ticket.created_by_user_id) recipients.push(ticket.created_by_user_id);
            if (ticket.assigned_to_user_id) recipients.push(ticket.assigned_to_user_id);
            const uniqueRecipients = [...new Set(recipients)];
            if (uniqueRecipients.length) {
                const users = await query(
                    `SELECT id, email, display_name
                     FROM users
                     WHERE id = ANY($1::uuid[])`,
                    [uniqueRecipients]
                );
                await Promise.all(
                    users.rows.map((user) => sendTicketEmail({
                        toUser: user,
                        ticket: updated,
                        subject: 'Ticket status updated',
                        notes: 'Status update email'
                    }))
                );
            }
        }

        return res.json({ success: true, data: updated });
    } catch (error) {
        console.error('Update ticket error:', error);
        return res.status(500).json({ success: false, error: 'Failed to update ticket' });
    }
};

const deleteTicket = async (req, res) => {
    try {
        if (!isAdminRole(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Only admins can delete tickets' });
        }
        const { id } = req.params;
        await query('DELETE FROM tickets WHERE id = $1', [id]);
        return res.json({ success: true });
    } catch (error) {
        console.error('Delete ticket error:', error);
        return res.status(500).json({ success: false, error: 'Failed to delete ticket' });
    }
};

const getTicketHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const allowed = await canAccessTicket({ ticketId: id, userId: req.user.id, role: req.user.role });
        if (!allowed) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        const result = await query(
            `SELECT h.*,
                    u.display_name as performed_by_name
             FROM ticket_history h
             LEFT JOIN users u ON h.performed_by_user_id = u.id
             WHERE h.ticket_id = $1
             ORDER BY h.created_at DESC`,
            [id]
        );
        return res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Get ticket history error:', error);
        return res.status(500).json({ success: false, error: 'Failed to load history' });
    }
};

const addTicketHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body || {};
        if (!notes) {
            return res.status(400).json({ success: false, error: 'notes is required' });
        }
        const allowed = await canAccessTicket({ ticketId: id, userId: req.user.id, role: req.user.role });
        if (!allowed) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        await logHistory({
            ticketId: id,
            action: 'comment_added',
            performedBy: req.user.id,
            notes
        });
        return res.status(201).json({ success: true });
    } catch (error) {
        console.error('Add ticket history error:', error);
        return res.status(500).json({ success: false, error: 'Failed to add comment' });
    }
};

const assignTicket = async (req, res) => {
    try {
        if (!isAdminRole(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Only admins can assign tickets' });
        }
        const { id } = req.params;
        const { assignedToUserId } = req.body || {};
        if (!assignedToUserId) {
            return res.status(400).json({ success: false, error: 'assignedToUserId is required' });
        }
        const ticket = await fetchTicketById(id);
        if (!ticket) {
            return res.status(404).json({ success: false, error: 'Ticket not found' });
        }
        const result = await query(
            `UPDATE tickets
             SET assigned_to_user_id = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING *`,
            [assignedToUserId, id]
        );
        await logHistory({
            ticketId: id,
            action: 'assigned',
            performedBy: req.user.id,
            notes: `Assigned to ${assignedToUserId}`
        });
        const assignee = await query(
            `SELECT id, email, display_name FROM users WHERE id = $1`,
            [assignedToUserId]
        );
        if (assignee.rows.length) {
            await sendTicketEmail({
                toUser: assignee.rows[0],
                ticket: result.rows[0],
                subject: 'New ticket assignment',
                notes: 'Assignment email'
            });
        }
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Assign ticket error:', error);
        return res.status(500).json({ success: false, error: 'Failed to assign ticket' });
    }
};

const addTicketAccess = async (req, res) => {
    try {
        if (!isAdminRole(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Only admins can grant access' });
        }
        const { id } = req.params;
        const { userId } = req.body || {};
        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }
        await query(
            `INSERT INTO ticket_access (ticket_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (ticket_id, user_id) DO NOTHING`,
            [id, userId]
        );
        await logHistory({
            ticketId: id,
            action: 'updated',
            performedBy: req.user.id,
            notes: `Granted access to ${userId}`
        });
        return res.status(201).json({ success: true });
    } catch (error) {
        console.error('Grant ticket access error:', error);
        return res.status(500).json({ success: false, error: 'Failed to grant access' });
    }
};

const removeTicketAccess = async (req, res) => {
    try {
        if (!isAdminRole(req.user.role)) {
            return res.status(403).json({ success: false, error: 'Only admins can revoke access' });
        }
        const { id, userId } = req.params;
        await query(
            `DELETE FROM ticket_access
             WHERE ticket_id = $1 AND user_id = $2`,
            [id, userId]
        );
        await logHistory({
            ticketId: id,
            action: 'updated',
            performedBy: req.user.id,
            notes: `Revoked access for ${userId}`
        });
        return res.json({ success: true });
    } catch (error) {
        console.error('Revoke ticket access error:', error);
        return res.status(500).json({ success: false, error: 'Failed to revoke access' });
    }
};

module.exports = {
    listTickets,
    getTicket,
    createTicket,
    updateTicket,
    deleteTicket,
    getTicketHistory,
    addTicketHistory,
    assignTicket,
    addTicketAccess,
    removeTicketAccess
};
