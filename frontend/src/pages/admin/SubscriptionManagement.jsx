// src/pages/admin/SubscriptionManagement.jsx
import React, { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { guessCurrencySymbol } from '../../utils/currency';
import {
    FaCreditCard,
    FaUsers,
    FaChartLine,
    FaDollarSign,
    FaCalendarAlt,
    FaCheckCircle,
    FaTimesCircle,
    FaBan,
    FaSync,
    FaDownload,
    FaFilter,
    FaSearch,
    FaPlus,
    FaEdit,
    FaTrash,
    FaToggleOn,
    FaToggleOff,
    FaExclamationTriangle,
    FaCrown,
    FaUserTie,
    FaUserMd
} from 'react-icons/fa';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';

const SubscriptionManagement = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [subscriptions, setSubscriptions] = useState([]);
    const [pricingData, setPricingData] = useState([]);
    const [revenueData, setRevenueData] = useState([]);
    const [stats, setStats] = useState({});
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterPlan, setFilterPlan] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSubscription, setSelectedSubscription] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [editingPricing, setEditingPricing] = useState(null);
    const [dateRange, setDateRange] = useState('30d');
    const [currencyCode, setCurrencyCode] = useState('ZAR');
    const [currencySymbol, setCurrencySymbol] = useState('R');
    const [formData, setFormData] = useState({
        user_id: '',
        role: 'employee',
        plan_type: 'premium',
        status: 'active',
        country_code: 'US',
        auto_renew: true,
        chat_hours_per_day: 2,
        video_calls_per_week: 1,
        leads_per_month: 0,
        accepts_assignments: false
    });

    const [pricingForm, setPricingForm] = useState({
        country_code: 'US',
        country_name: 'United States',
        currency_symbol: '$',
        currency: 'USD',
        multiplier: 1
    });

    const COLORS = ['#4299e1', '#48bb78', '#ed8936', '#9f7aea', '#f687b3', '#fc8181'];

    useEffect(() => {
        fetchAllData();
    }, [dateRange]);

    const fetchAllData = async () => {
        try {
            setLoading(true);
            const period = dateRange === '7d' ? 'day' : dateRange === '30d' ? 'day' : dateRange === '90d' ? 'week' : 'month';
            const [subsRes, pricingRes, revenueRes, statsRes, settingsRes] = await Promise.all([
                api.get('/admin/subscriptions', { params: { range: dateRange } }),
                api.get('/admin/pricing/countries'),
                api.get('/admin/analytics/revenue', { params: { period } }),
                api.get('/admin/analytics/subscriptions'),
                api.get('/admin/settings')
            ]);

            const rawSubs = subsRes.data.subscriptions || subsRes.data || [];
            const normalizedSubs = rawSubs.map((sub) => ({
                ...sub,
                plan_type: sub.plan_type || sub.plan || sub.plan_code || sub.planTier || sub.tier,
                role: sub.role || sub.owner_type || sub.ownerType
            }));
            setSubscriptions(normalizedSubs);
            setPricingData(pricingRes.data.pricing || pricingRes.data || []);
            setRevenueData(revenueRes.data || []);
            setStats(statsRes.data || {});

            const settings = settingsRes.data || {};
            const code = (settings.currency_code || settings.currencyCode || 'ZAR').toUpperCase();
            const symbol = settings.currency_symbol || settings.currencySymbol || guessCurrencySymbol(code);
            setCurrencyCode(code);
            setCurrencySymbol(symbol);
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to load subscription data');
        } finally {
            setLoading(false);
        }
    };

    // Filter subscriptions
    const filteredSubscriptions = useMemo(() => {
        return subscriptions.filter(sub => {
            const statusMatch = filterStatus === 'all' || sub.status === filterStatus;
            const planMatch = filterPlan === 'all' || sub.plan_type === filterPlan;
            const searchMatch = !searchTerm ||
                sub.user_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                sub.user_name?.toLowerCase().includes(searchTerm.toLowerCase());
            return statusMatch && planMatch && searchMatch;
        });
    }, [subscriptions, filterStatus, filterPlan, searchTerm]);

    // Calculate summary statistics
    const summaryStats = useMemo(() => {
        const total = subscriptions.length;
        const active = subscriptions.filter(s => s.status === 'active').length;
        const cancelled = subscriptions.filter(s => s.status === 'cancelled').length;
        const expired = subscriptions.filter(s => s.status === 'expired').length;

        const premium = subscriptions.filter(s => s.plan_type === 'premium').length;
        const free = subscriptions.filter(s => s.plan_type === 'free').length;

        const totalRevenue = subscriptions
            .filter(s => s.status === 'active')
            .reduce((sum, s) => sum + parseFloat(s.price || 0), 0);

        const employeeSubs = subscriptions.filter(s => s.role === 'employee').length;
        const psychologistSubs = subscriptions.filter(s => s.role === 'psychologist').length;

        return {
            total,
            active,
            cancelled,
            expired,
            premium,
            free,
            totalRevenue,
            employeeSubs,
            psychologistSubs,
            conversionRate: total ? ((premium / total) * 100).toFixed(1) : 0
        };
    }, [subscriptions]);

    // Chart data preparation
    const subscriptionTrend = useMemo(() => {
        const last30Days = [...Array(30)].map((_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - i);
            return date.toISOString().split('T')[0];
        }).reverse();

        return last30Days.map(date => {
            const daySubs = subscriptions.filter(s =>
                s.created_at?.startsWith(date)
            );
            return {
                date,
                newSubscriptions: daySubs.length,
                revenue: daySubs.reduce((sum, s) => sum + parseFloat(s.price || 0), 0)
            };
        });
    }, [subscriptions]);

    // Handle subscription update
    const handleUpdateSubscription = async (id, updates) => {
        try {
            await api.patch(`/admin/subscriptions/${id}`, updates);
            await fetchAllData();
            setShowEditModal(false);
        } catch (err) {
            setError('Failed to update subscription');
        }
    };

    // Handle subscription cancellation
    const handleCancelSubscription = async (id) => {
        if (!window.confirm('Are you sure you want to cancel this subscription?')) return;

        try {
            await api.patch(`/admin/subscriptions/${id}/cancel`);
            await fetchAllData();
        } catch (err) {
            setError('Failed to cancel subscription');
        }
    };

    // Handle pricing create/update
    const handleSavePricing = async () => {
        try {
            if (editingPricing?.country_code) {
                await api.put(`/admin/pricing/countries/${editingPricing.country_code}`, pricingForm);
            } else {
                await api.post('/admin/pricing/countries', pricingForm);
            }
            await fetchAllData();
            setShowPricingModal(false);
            setEditingPricing(null);
        } catch (err) {
            setError('Failed to update pricing');
        }
    };

    // Export subscriptions
    const exportSubscriptions = async () => {
        try {
            const response = await api.get('/admin/subscriptions/export', {
                params: { format: 'csv' },
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `subscriptions-${new Date().toISOString()}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            setError('Export failed');
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading subscription data...</p>
            </div>
        );
    }

    return (
        <div className="subscription-management" style={{ padding: '24px' }}>
            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>Subscription Management</h1>
                    <p style={styles.subtitle}>Manage user subscriptions and pricing</p>
                </div>

                <div style={styles.headerActions}>
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        style={styles.select}
                    >
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="90d">Last 90 Days</option>
                        <option value="12m">Last 12 Months</option>
                    </select>

                    <button onClick={exportSubscriptions} style={styles.button.primary}>
                        <FaDownload /> Export
                    </button>

                    <button onClick={() => setShowAddModal(true)} style={styles.button.success}>
                        <FaPlus /> Add Subscription
                    </button>

                    <button onClick={() => setShowPricingModal(true)} style={styles.button.info}>
                        <FaDollarSign /> Manage Pricing
                    </button>

                    <button onClick={fetchAllData} style={styles.button.secondary}>
                        <FaSync /> Refresh
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={styles.statsGrid}>
                <SummaryCard
                    title="Total Subscriptions"
                    value={summaryStats.total}
                    icon={<FaUsers />}
                    color="#4299e1"
                />
                <SummaryCard
                    title="Active"
                    value={summaryStats.active}
                    icon={<FaCheckCircle />}
                    color="#48bb78"
                />
                <SummaryCard
                    title="Premium"
                    value={summaryStats.premium}
                    icon={<FaCrown />}
                    color="#ed8936"
                />
                <SummaryCard
                    title="Monthly Revenue"
                    value={`${currencySymbol}${summaryStats.totalRevenue.toFixed(2)}`}
                    icon={<FaDollarSign />}
                    color="#9f7aea"
                />
                <SummaryCard
                    title="Employees"
                    value={summaryStats.employeeSubs}
                    icon={<FaUserTie />}
                    color="#f687b3"
                />
                <SummaryCard
                    title="Psychologists"
                    value={summaryStats.psychologistSubs}
                    icon={<FaUserMd />}
                    color="#fc8181"
                />
            </div>

            {/* Charts Section */}
            <div style={styles.chartsSection}>
                <div style={styles.chartCard}>
                    <h3>Subscription Growth</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={subscriptionTrend}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis yAxisId="left" />
                            <YAxis yAxisId="right" orientation="right" />
                            <Tooltip />
                            <Legend />
                            <Area
                                yAxisId="left"
                                type="monotone"
                                dataKey="newSubscriptions"
                                stroke="#4299e1"
                                fill="#4299e180"
                                name="New Subscriptions"
                            />
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="revenue"
                                stroke="#48bb78"
                                name={`Revenue (${currencyCode})`}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                <div style={styles.chartCard}>
                    <h3>Subscription Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={[
                                    { name: 'Active', value: summaryStats.active },
                                    { name: 'Cancelled', value: summaryStats.cancelled },
                                    { name: 'Expired', value: summaryStats.expired }
                                ]}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {summaryStats.active && (
                                    <Cell fill="#48bb78" />
                                )}
                                {summaryStats.cancelled && (
                                    <Cell fill="#f56565" />
                                )}
                                {summaryStats.expired && (
                                    <Cell fill="#a0aec0" />
                                )}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Pricing Table */}
            <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Country Pricing</h3>
                <div style={styles.pricingGrid}>
                    {pricingData.map((pricing) => (
                        <div key={pricing.country_code} style={styles.pricingCard}>
                            <div style={styles.pricingHeader}>
                                <h4>{pricing.country_name}</h4>
                                <button
                                    onClick={() => {
                                        setEditingPricing(pricing);
                                        setPricingForm({
                                            country_code: pricing.country_code,
                                            country_name: pricing.country_name,
                                            currency_symbol: pricing.currency_symbol,
                                            currency: pricing.currency || pricing.currency_code,
                                            multiplier: pricing.multiplier ?? 1
                                        });
                                        setShowPricingModal(true);
                                    }}
                                    style={styles.editButton}
                                >
                                    <FaEdit />
                                </button>
                            </div>
                            <div style={styles.pricingDetails}>
                                <p>Currency: {pricing.currency_symbol} ({pricing.currency || pricing.currency_code})</p>
                                <p>Multiplier: {pricing.multiplier ?? 'N/A'}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Filters */}
            <div style={styles.filters}>
                <div style={styles.filterGroup}>
                    <FaFilter style={styles.filterIcon} />
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        style={styles.filterSelect}
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="expired">Expired</option>
                    </select>

                    <select
                        value={filterPlan}
                        onChange={(e) => setFilterPlan(e.target.value)}
                        style={styles.filterSelect}
                    >
                        <option value="all">All Plans</option>
                        <option value="free">Free</option>
                        <option value="premium">Premium</option>
                    </select>
                </div>

                <div style={styles.searchGroup}>
                    <FaSearch style={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Search by user..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={styles.searchInput}
                    />
                </div>
            </div>

            {/* Subscriptions Table */}
            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.tableContainer}>
                <table style={styles.table}>
                    <thead>
                    <tr>
                        <th>User</th>
                        <th>Role</th>
                        <th>Plan</th>
                        <th>Price</th>
                        <th>Status</th>
                        <th>Start Date</th>
                        <th>End Date</th>
                        <th>Benefits</th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {filteredSubscriptions.map((sub) => (
                        <tr key={sub.id}>
                            <td>
                                <div style={styles.userInfo}>
                                    <div>{sub.user_name || 'N/A'}</div>
                                    <small>{sub.user_email}</small>
                                </div>
                            </td>
                            <td>
                                    <span style={getRoleBadgeStyle(sub.role)}>
                                        {sub.role}
                                    </span>
                            </td>
                            <td>
                                    <span style={getPlanBadgeStyle(sub.plan_type)}>
                                        {sub.plan_type}
                                    </span>
                            </td>
                            <td>
                                {sub.currency_symbol}{sub.price}
                                <div style={{ fontSize: '12px', color: '#666' }}>
                                    {sub.currency_code}
                                </div>
                            </td>
                            <td>
                                    <span style={getStatusBadgeStyle(sub.status)}>
                                        {sub.status}
                                    </span>
                            </td>
                            <td>{new Date(sub.start_date).toLocaleDateString()}</td>
                            <td>
                                {sub.end_date ? new Date(sub.end_date).toLocaleDateString() : 'N/A'}
                                {sub.auto_renew && <FaSync style={{ marginLeft: '8px', color: '#48bb78' }} />}
                            </td>
                            <td>
                                {sub.role === 'employee' ? (
                                    <div>
                                        <div>📞 {sub.chat_hours_per_day}h/day</div>
                                        <div>📹 {sub.video_calls_per_week}/week</div>
                                        {sub.assigned_psychologist && (
                                            <div>👤 Assigned: {sub.assigned_psychologist}</div>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <div>👥 {sub.leads_per_month}/month</div>
                                        <div>✅ {sub.accepts_assignments ? 'Accepting' : 'Not Accepting'}</div>
                                    </div>
                                )}
                            </td>
                            <td>
                                <div style={styles.actionButtons}>
                                    <button
                                        onClick={() => {
                                            setSelectedSubscription(sub);
                                            setFormData(sub);
                                            setShowEditModal(true);
                                        }}
                                        style={styles.actionButton.edit}
                                        title="Edit"
                                    >
                                        <FaEdit />
                                    </button>
                                    {sub.status === 'active' && (
                                        <button
                                            onClick={() => handleCancelSubscription(sub.id)}
                                            style={styles.actionButton.cancel}
                                            title="Cancel"
                                        >
                                            <FaBan />
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>

                {filteredSubscriptions.length === 0 && (
                    <div style={styles.noData}>
                        No subscriptions found
                    </div>
                )}
            </div>

            {/* Edit Subscription Modal */}
            {showEditModal && (
                <SubscriptionModal
                    subscription={selectedSubscription}
                    formData={formData}
                    setFormData={setFormData}
                    onSave={() => handleUpdateSubscription(selectedSubscription.id, formData)}
                    onClose={() => setShowEditModal(false)}
                />
            )}

            {/* Add Subscription Modal */}
            {showAddModal && (
                <AddSubscriptionModal
                    formData={formData}
                    setFormData={setFormData}
                    onSave={async () => {
                        try {
                            await api.post('/admin/subscriptions', formData);
                            await fetchAllData();
                            setShowAddModal(false);
                        } catch (err) {
                            setError('Failed to create subscription');
                        }
                    }}
                    onClose={() => setShowAddModal(false)}
                />
            )}

            {/* Pricing Modal */}
            {showPricingModal && (
                <PricingModal
                    pricing={editingPricing}
                    formData={pricingForm}
                    setFormData={setPricingForm}
                    onSave={handleSavePricing}
                    onClose={() => {
                        setShowPricingModal(false);
                        setEditingPricing(null);
                    }}
                />
            )}
        </div>
    );
};

// Helper Components
const SummaryCard = ({ title, value, icon, color }) => (
    <div style={{
        ...styles.summaryCard,
        borderLeft: `4px solid ${color}`
    }}>
        <div style={{ ...styles.summaryCardIcon, color }}>
            {icon}
        </div>
        <div style={styles.summaryCardContent}>
            <div style={styles.summaryCardTitle}>{title}</div>
            <div style={styles.summaryCardValue}>{value}</div>
        </div>
    </div>
);

const SubscriptionModal = ({ subscription, formData, setFormData, onSave, onClose }) => (
    <div style={styles.modalOverlay}>
        <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>Edit Subscription</h2>

            <div style={styles.formGroup}>
                <label>Plan Type</label>
                <select
                    value={formData.plan_type}
                    onChange={(e) => setFormData({ ...formData, plan_type: e.target.value })}
                    style={styles.input}
                >
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                </select>
            </div>

            <div style={styles.formGroup}>
                <label>Status</label>
                <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={styles.input}
                >
                    <option value="active">Active</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="expired">Expired</option>
                </select>
            </div>

            <div style={styles.formGroup}>
                <label>Auto Renew</label>
                <input
                    type="checkbox"
                    checked={formData.auto_renew}
                    onChange={(e) => setFormData({ ...formData, auto_renew: e.target.checked })}
                />
            </div>

            {subscription?.role === 'employee' ? (
                <>
                    <div style={styles.formGroup}>
                        <label>Chat Hours Per Day</label>
                        <input
                            type="number"
                            value={formData.chat_hours_per_day}
                            onChange={(e) => setFormData({ ...formData, chat_hours_per_day: parseInt(e.target.value) })}
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.formGroup}>
                        <label>Video Calls Per Week</label>
                        <input
                            type="number"
                            value={formData.video_calls_per_week}
                            onChange={(e) => setFormData({ ...formData, video_calls_per_week: parseInt(e.target.value) })}
                            style={styles.input}
                        />
                    </div>
                </>
            ) : (
                <>
                    <div style={styles.formGroup}>
                        <label>Leads Per Month</label>
                        <input
                            type="number"
                            value={formData.leads_per_month}
                            onChange={(e) => setFormData({ ...formData, leads_per_month: parseInt(e.target.value) })}
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.formGroup}>
                        <label>Accepts Assignments</label>
                        <input
                            type="checkbox"
                            checked={formData.accepts_assignments}
                            onChange={(e) => setFormData({ ...formData, accepts_assignments: e.target.checked })}
                        />
                    </div>
                </>
            )}

            <div style={styles.modalActions}>
                <button onClick={onClose} style={styles.button.secondary}>Cancel</button>
                <button onClick={onSave} style={styles.button.primary}>Save Changes</button>
            </div>
        </div>
    </div>
);

const AddSubscriptionModal = ({ formData, setFormData, onSave, onClose }) => (
    <div style={styles.modalOverlay}>
        <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>Add New Subscription</h2>

            <div style={styles.formGroup}>
                <label>User ID</label>
                <input
                    type="text"
                    value={formData.user_id}
                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                    style={styles.input}
                    placeholder="Enter user ID"
                />
            </div>

            <div style={styles.formGroup}>
                <label>Role</label>
                <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    style={styles.input}
                >
                    <option value="employee">Employee</option>
                    <option value="psychologist">Psychologist</option>
                </select>
            </div>

            <div style={styles.formGroup}>
                <label>Plan Type</label>
                <select
                    value={formData.plan_type}
                    onChange={(e) => setFormData({ ...formData, plan_type: e.target.value })}
                    style={styles.input}
                >
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                </select>
            </div>

            <div style={styles.formGroup}>
                <label>Country Code</label>
                <input
                    type="text"
                    value={formData.country_code}
                    onChange={(e) => setFormData({ ...formData, country_code: e.target.value.toUpperCase() })}
                    style={styles.input}
                    maxLength="2"
                    placeholder="US"
                />
            </div>

            <div style={styles.formGroup}>
                <label>Auto Renew</label>
                <input
                    type="checkbox"
                    checked={formData.auto_renew}
                    onChange={(e) => setFormData({ ...formData, auto_renew: e.target.checked })}
                />
            </div>

            <div style={styles.modalActions}>
                <button onClick={onClose} style={styles.button.secondary}>Cancel</button>
                <button onClick={onSave} style={styles.button.primary}>Create Subscription</button>
            </div>
        </div>
    </div>
);

const PricingModal = ({ pricing, formData, setFormData, onSave, onClose }) => (
    <div style={styles.modalOverlay}>
        <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>
                {pricing ? 'Edit Pricing' : 'Add New Pricing'}
            </h2>

            <div style={styles.formGroup}>
                <label>Country Code</label>
                <input
                    type="text"
                    value={formData.country_code}
                    onChange={(e) => setFormData({ ...formData, country_code: e.target.value.toUpperCase() })}
                    style={styles.input}
                    maxLength="2"
                    placeholder="US"
                    disabled={!!pricing}
                />
            </div>

            <div style={styles.formGroup}>
                <label>Country Name</label>
                <input
                    type="text"
                    value={formData.country_name}
                    onChange={(e) => setFormData({ ...formData, country_name: e.target.value })}
                    style={styles.input}
                    placeholder="United States"
                />
            </div>

            <div style={styles.formGroup}>
                <label>Currency Symbol</label>
                <input
                    type="text"
                    value={formData.currency_symbol}
                    onChange={(e) => setFormData({ ...formData, currency_symbol: e.target.value })}
                    style={styles.input}
                    placeholder="$"
                />
            </div>

            <div style={styles.formGroup}>
                <label>Currency Code</label>
                <input
                    type="text"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                    style={styles.input}
                    placeholder="USD"
                />
            </div>

            <div style={styles.formGroup}>
                <label>Multiplier</label>
                <input
                    type="number"
                    value={formData.multiplier}
                    onChange={(e) => setFormData({ ...formData, multiplier: parseFloat(e.target.value) })}
                    style={styles.input}
                    step="0.001"
                />
            </div>

            <div style={styles.modalActions}>
                <button onClick={onClose} style={styles.button.secondary}>Cancel</button>
                <button onClick={onSave} style={styles.button.primary}>
                    {pricing ? 'Update Pricing' : 'Create Pricing'}
                </button>
            </div>
        </div>
    </div>
);

// Helper functions for badges
const getStatusBadgeStyle = (status) => ({
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
    backgroundColor:
        status === 'active' ? '#48bb7820' :
            status === 'cancelled' ? '#f5656520' :
                '#a0aec020',
    color:
        status === 'active' ? '#48bb78' :
            status === 'cancelled' ? '#f56565' :
                '#a0aec0'
});

const getPlanBadgeStyle = (plan) => ({
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
    backgroundColor: plan === 'premium' ? '#ed893620' : '#a0aec020',
    color: plan === 'premium' ? '#ed8936' : '#a0aec0'
});

const getRoleBadgeStyle = (role) => ({
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
    backgroundColor: role === 'employee' ? '#4299e120' : '#9f7aea20',
    color: role === 'employee' ? '#4299e1' : '#9f7aea'
});

// Styles
const styles = {
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
    },
    title: {
        fontSize: '24px',
        fontWeight: 'bold',
        margin: 0
    },
    subtitle: {
        color: '#666',
        margin: '4px 0 0 0'
    },
    headerActions: {
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap'
    },
    select: {
        padding: '8px 12px',
        borderRadius: '4px',
        border: '1px solid #e2e8f0',
        backgroundColor: 'white'
    },
    button: {
        primary: {
            padding: '8px 16px',
            backgroundColor: '#4299e1',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        },
        secondary: {
            padding: '8px 16px',
            backgroundColor: '#a0aec0',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        },
        success: {
            padding: '8px 16px',
            backgroundColor: '#48bb78',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        },
        info: {
            padding: '8px 16px',
            backgroundColor: '#9f7aea',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        }
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
    },
    summaryCard: {
        padding: '20px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
    },
    summaryCardIcon: {
        width: '48px',
        height: '48px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px'
    },
    summaryCardContent: {
        flex: 1
    },
    summaryCardTitle: {
        fontSize: '14px',
        color: '#666'
    },
    summaryCardValue: {
        fontSize: '24px',
        fontWeight: 'bold'
    },
    chartsSection: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '24px',
        marginBottom: '24px'
    },
    chartCard: {
        padding: '20px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    section: {
        marginBottom: '24px'
    },
    sectionTitle: {
        fontSize: '18px',
        fontWeight: '600',
        marginBottom: '16px'
    },
    pricingGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '16px'
    },
    pricingCard: {
        padding: '16px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    pricingHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px'
    },
    editButton: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: '#4299e1'
    },
    pricingDetails: {
        fontSize: '14px',
        color: '#666'
    },
    filters: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        padding: '16px',
        backgroundColor: '#f7fafc',
        borderRadius: '8px'
    },
    filterGroup: {
        display: 'flex',
        gap: '12px',
        alignItems: 'center'
    },
    filterIcon: {
        color: '#a0aec0'
    },
    filterSelect: {
        padding: '6px 10px',
        borderRadius: '4px',
        border: '1px solid #e2e8f0',
        backgroundColor: 'white'
    },
    searchGroup: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center'
    },
    searchIcon: {
        position: 'absolute',
        left: '10px',
        color: '#a0aec0'
    },
    searchInput: {
        padding: '8px 12px 8px 36px',
        borderRadius: '4px',
        border: '1px solid #e2e8f0',
        width: '250px'
    },
    tableContainer: {
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        overflow: 'auto'
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        minWidth: '1200px'
    },
    userInfo: {
        display: 'flex',
        flexDirection: 'column'
    },
    actionButtons: {
        display: 'flex',
        gap: '8px'
    },
    actionButton: {
        edit: {
            padding: '4px 8px',
            backgroundColor: '#4299e1',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
        },
        cancel: {
            padding: '4px 8px',
            backgroundColor: '#f56565',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
        }
    },
    error: {
        padding: '12px',
        backgroundColor: '#fed7d7',
        color: '#c53030',
        borderRadius: '4px',
        marginBottom: '16px'
    },
    noData: {
        padding: '48px',
        textAlign: 'center',
        color: '#a0aec0'
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
    },
    modalContent: {
        backgroundColor: 'white',
        padding: '24px',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflow: 'auto'
    },
    modalTitle: {
        fontSize: '20px',
        fontWeight: 'bold',
        marginBottom: '20px'
    },
    formGroup: {
        marginBottom: '16px'
    },
    input: {
        width: '100%',
        padding: '8px',
        borderRadius: '4px',
        border: '1px solid #e2e8f0',
        fontSize: '14px',
        marginTop: '4px'
    },
    modalActions: {
        display: 'flex',
        gap: '12px',
        justifyContent: 'flex-end',
        marginTop: '24px'
    }
};

export default SubscriptionManagement;
