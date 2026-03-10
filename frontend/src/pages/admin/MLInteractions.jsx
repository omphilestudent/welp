// src/pages/admin/MLInteractions.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import {
    FaBrain, FaChartLine, FaRobot, FaExclamationTriangle,
    FaCheckCircle, FaClock, FaRedo, FaDownload, FaFilter,
    FaCalendarAlt, FaSync, FaPlus, FaTrash, FaEdit,
    FaToggleOn, FaToggleOff, FaCog, FaDatabase
} from 'react-icons/fa';

const MLInteractions = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [interactions, setInteractions] = useState([]);
    const [mlModels, setMlModels] = useState([]);
    const [mlMetrics, setMlMetrics] = useState({});
    const [selectedModel, setSelectedModel] = useState(null);
    const [dateRange, setDateRange] = useState('7d'); // 24h, 7d, 30d, all
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const [showTrainingModal, setShowTrainingModal] = useState(false);
    const [trainingConfig, setTrainingConfig] = useState({
        modelType: 'classification',
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2,
        learningRate: 0.001
    });
    const [predictions, setPredictions] = useState([]);
    const [modelPerformance, setModelPerformance] = useState({});

    const COLORS = ['#4299e1', '#48bb78', '#ed8936', '#9f7aea', '#f687b3', '#fc8181'];

    useEffect(() => {
        fetchAllData();
    }, [dateRange]);

    const fetchAllData = async () => {
        try {
            setLoading(true);
            setError('');

            // Fetch all ML-related data in parallel
            const [interactionsRes, modelsRes, metricsRes, predictionsRes, performanceRes] = await Promise.all([
                api.get('/admin/ml/interactions', { params: { range: dateRange } }),
                api.get('/admin/ml/models'),
                api.get('/admin/ml/metrics', { params: { range: dateRange } }),
                api.get('/admin/ml/predictions', { params: { limit: 50 } }),
                api.get('/admin/ml/performance')
            ]);

            setInteractions(normalizeInteractions(interactionsRes.data));
            setMlModels(modelsRes.data.models || []);
            setMlMetrics(metricsRes.data || {});
            setPredictions(predictionsRes.data.predictions || []);
            setModelPerformance(performanceRes.data || {});

        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to load ML data.');
        } finally {
            setLoading(false);
        }
    };

    const normalizeInteractions = (payload) => {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.interactions)) return payload.interactions;
        if (Array.isArray(payload?.data)) return payload.data;
        return [];
    };

    const userRole = String(user?.role || '').toLowerCase().trim();
    const isSuperAdmin = ['super_admin', 'superadmin', 'system_admin'].includes(userRole);

    // Filter interactions based on selected filters
    const filteredInteractions = useMemo(() => {
        return interactions.filter(item => {
            const statusMatch = filterStatus === 'all' ||
                String(item?.status || '').toLowerCase() === filterStatus;
            const typeMatch = filterType === 'all' ||
                (item?.type || item?.interaction_type || '').toLowerCase().includes(filterType);
            return statusMatch && typeMatch;
        });
    }, [interactions, filterStatus, filterType]);

    // Summary statistics
    const summary = useMemo(() => {
        const total = interactions.length;
        const pending = interactions.filter(i =>
            String(i?.status || '').toLowerCase() === 'pending').length;
        const edited = interactions.filter(i =>
            String(i?.status || '').toLowerCase() === 'edited').length;
        const approved = interactions.filter(i =>
            String(i?.status || '').toLowerCase() === 'approved').length;

        // Model accuracy metrics
        const avgConfidence = interactions.reduce((acc, i) =>
            acc + (i?.confidence || 0), 0) / (total || 1);

        const humanInterventions = interactions.filter(i =>
            i?.human_intervened).length;

        return {
            total, pending, edited, approved,
            avgConfidence: (avgConfidence * 100).toFixed(1),
            humanInterventions,
            automationRate: total ? ((total - humanInterventions) / total * 100).toFixed(1) : 0
        };
    }, [interactions]);

    // Chart data preparation
    const chartData = useMemo(() => {
        const last7Days = [...Array(7)].map((_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - i);
            return date.toISOString().split('T')[0];
        }).reverse();

        return last7Days.map(date => {
            const dayInteractions = interactions.filter(i =>
                i?.created_at?.startsWith(date)
            );
            return {
                date,
                interactions: dayInteractions.length,
                pending: dayInteractions.filter(i =>
                    String(i?.status || '').toLowerCase() === 'pending').length,
                edited: dayInteractions.filter(i =>
                    String(i?.status || '').toLowerCase() === 'edited').length,
                avgConfidence: dayInteractions.reduce((acc, i) =>
                    acc + (i?.confidence || 0), 0) / (dayInteractions.length || 1)
            };
        });
    }, [interactions]);

    // Type distribution for pie chart
    const typeDistribution = useMemo(() => {
        const types = {};
        interactions.forEach(i => {
            const type = i?.type || i?.interaction_type || 'unknown';
            types[type] = (types[type] || 0) + 1;
        });
        return Object.entries(types).map(([name, value]) => ({ name, value }));
    }, [interactions]);

    // Status update handler
    const updateStatus = async (item, newStatus) => {
        const id = item?.id || item?._id;
        if (!id) return;

        try {
            await api.patch(`/admin/ml/interactions/${id}`, { status: newStatus });
            setInteractions(prev => prev.map(row =>
                (row.id || row._id) === id ? { ...row, status: newStatus } : row
            ));
        } catch (err) {
            setError(err?.response?.data?.message || 'Unable to update status.');
        }
    };

    // Train new model
    const trainModel = async () => {
        try {
            setLoading(true);
            const response = await api.post('/admin/ml/train', trainingConfig);
            setMlModels(prev => [...prev, response.data.model]);
            setShowTrainingModal(false);
        } catch (err) {
            setError(err?.response?.data?.message || 'Training failed.');
        } finally {
            setLoading(false);
        }
    };

    // Export interactions
    const exportData = async () => {
        try {
            const response = await api.get('/admin/ml/export', {
                params: { range: dateRange, format: 'csv' },
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `ml-interactions-${new Date().toISOString()}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            setError('Export failed');
        }
    };

    // Run prediction
    const runPrediction = async (modelId, inputData) => {
        try {
            const response = await api.post('/admin/ml/predict', {
                modelId,
                input: inputData
            });
            return response.data.prediction;
        } catch (err) {
            setError('Prediction failed');
            return null;
        }
    };

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

    return (
        <div className="admin-page-container" style={{ padding: '24px' }}>
            {/* Header with Controls */}
            <div className="page-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                flexWrap: 'wrap',
                gap: '16px'
            }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>ML Interactions Dashboard</h1>
                    <p style={{ color: '#666' }}>Monitor and manage machine learning interactions</p>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {/* Date Range Selector */}
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="filter-select"
                        style={selectStyle}
                    >
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="all">All Time</option>
                    </select>

                    {/* Export Button */}
                    <button onClick={exportData} style={buttonStyle.primary}>
                        <FaDownload /> Export
                    </button>

                    {/* Train New Model Button */}
                    <button onClick={() => setShowTrainingModal(true)} style={buttonStyle.success}>
                        <FaBrain /> Train Model
                    </button>

                    {/* Refresh Button */}
                    <button onClick={fetchAllData} style={buttonStyle.secondary}>
                        <FaSync /> Refresh
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '24px'
            }}>
                <SummaryCard
                    title="Total Interactions"
                    value={summary.total}
                    icon={<FaDatabase />}
                    color="#4299e1"
                />
                <SummaryCard
                    title="Pending Review"
                    value={summary.pending}
                    icon={<FaClock />}
                    color="#ed8936"
                />
                <SummaryCard
                    title="Human Interventions"
                    value={summary.humanInterventions}
                    icon={<FaExclamationTriangle />}
                    color="#f56565"
                />
                <SummaryCard
                    title="Automation Rate"
                    value={`${summary.automationRate}%`}
                    icon={<FaRobot />}
                    color="#48bb78"
                />
                <SummaryCard
                    title="Avg Confidence"
                    value={`${summary.avgConfidence}%`}
                    icon={<FaChartLine />}
                    color="#9f7aea"
                />
            </div>

            {/* Charts Section */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
                gap: '24px',
                marginBottom: '24px'
            }}>
                {/* Interactions Trend Chart */}
                <div className="chart-card" style={chartCardStyle}>
                    <h3>Interactions Trend</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Area
                                type="monotone"
                                dataKey="interactions"
                                stroke="#4299e1"
                                fill="#4299e180"
                                name="Total"
                            />
                            <Area
                                type="monotone"
                                dataKey="pending"
                                stroke="#ed8936"
                                fill="#ed893680"
                                name="Pending"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Confidence Trend */}
                <div className="chart-card" style={chartCardStyle}>
                    <h3>Confidence Score Trend</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis domain={[0, 1]} />
                            <Tooltip />
                            <Line
                                type="monotone"
                                dataKey="avgConfidence"
                                stroke="#48bb78"
                                name="Avg Confidence"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Type Distribution */}
                <div className="chart-card" style={chartCardStyle}>
                    <h3>Interaction Types</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={typeDistribution}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {typeDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Model Performance */}
                <div className="chart-card" style={chartCardStyle}>
                    <h3>Model Performance</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={mlModels.slice(0, 5)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis domain={[0, 100]} />
                            <Tooltip />
                            <Bar dataKey="accuracy" fill="#9f7aea" name="Accuracy %" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Models Section */}
            <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
                    Active ML Models
                </h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '16px'
                }}>
                    {mlModels.map(model => (
                        <ModelCard
                            key={model.id}
                            model={model}
                            onSelect={() => setSelectedModel(model)}
                            onToggle={async () => {
                                await api.patch(`/admin/ml/models/${model.id}/toggle`);
                                fetchAllData();
                            }}
                        />
                    ))}
                </div>
            </div>

            {/* Filters */}
            <div style={{
                display: 'flex',
                gap: '16px',
                marginBottom: '16px',
                padding: '16px',
                backgroundColor: '#f7fafc',
                borderRadius: '8px'
            }}>
                <div>
                    <label style={{ marginRight: '8px' }}>Status:</label>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        style={filterSelectStyle}
                    >
                        <option value="all">All</option>
                        <option value="pending">Pending</option>
                        <option value="edited">Edited</option>
                        <option value="approved">Approved</option>
                    </select>
                </div>

                <div>
                    <label style={{ marginRight: '8px' }}>Type:</label>
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        style={filterSelectStyle}
                    >
                        <option value="all">All</option>
                        <option value="classification">Classification</option>
                        <option value="regression">Regression</option>
                        <option value="recommendation">Recommendation</option>
                    </select>
                </div>

                <div style={{ marginLeft: 'auto' }}>
                    <span>Showing: {filteredInteractions.length} interactions</span>
                </div>
            </div>

            {/* Interactions Table */}
            {loading && <p>Loading ML interactions...</p>}
            {!loading && error && <p style={{ color: '#e53e3e' }}>{error}</p>}

            {!loading && !error && filteredInteractions.length === 0 && (
                <p>No ML interactions found.</p>
            )}

            {!loading && filteredInteractions.length > 0 && (
                <div className="table-container" style={{ overflowX: 'auto' }}>
                    <table className="admin-table" style={{ width: '100%', minWidth: '1200px' }}>
                        <thead>
                        <tr>
                            <th>ID</th>
                            <th>Type</th>
                            <th>User</th>
                            <th>Input</th>
                            <th>Prediction</th>
                            <th>Confidence</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {filteredInteractions.map((item) => {
                            const id = item?.id || item?._id || '-';
                            const status = String(item?.status || 'pending').toLowerCase();
                            const confidence = item?.confidence || 0;

                            return (
                                <tr key={id}>
                                    <td>{id.substring(0, 8)}...</td>
                                    <td>{item?.type || item?.interaction_type || 'N/A'}</td>
                                    <td>{item?.user_email || item?.userId || 'N/A'}</td>
                                    <td>
                                        {item?.input ?
                                            JSON.stringify(item.input).substring(0, 30) + '...' :
                                            'N/A'
                                        }
                                    </td>
                                    <td>
                                        {item?.prediction ?
                                            JSON.stringify(item.prediction).substring(0, 30) + '...' :
                                            'N/A'
                                        }
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <div style={{
                                                width: '60px',
                                                height: '6px',
                                                backgroundColor: '#e2e8f0',
                                                borderRadius: '3px',
                                                marginRight: '8px'
                                            }}>
                                                <div style={{
                                                    width: `${confidence * 100}%`,
                                                    height: '100%',
                                                    backgroundColor: confidence > 0.7 ? '#48bb78' :
                                                        confidence > 0.4 ? '#ed8936' : '#f56565',
                                                    borderRadius: '3px'
                                                }} />
                                            </div>
                                            {(confidence * 100).toFixed(1)}%
                                        </div>
                                    </td>
                                    <td>
                                            <span className={`status-badge status-${status}`}>
                                                {status}
                                            </span>
                                    </td>
                                    <td>{item?.created_at ?
                                        new Date(item.created_at).toLocaleString() : 'N/A'}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {status !== 'approved' && (
                                                <button
                                                    className="btn btn-sm btn-success"
                                                    onClick={() => updateStatus(item, 'approved')}
                                                    style={smallButtonStyle.success}
                                                    title="Approve"
                                                >
                                                    <FaCheckCircle />
                                                </button>
                                            )}
                                            {status !== 'edited' && (
                                                <button
                                                    className="btn btn-sm btn-warning"
                                                    onClick={() => updateStatus(item, 'edited')}
                                                    style={smallButtonStyle.warning}
                                                    title="Mark as Edited"
                                                >
                                                    <FaEdit />
                                                </button>
                                            )}
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => updateStatus(item, 'rejected')}
                                                style={smallButtonStyle.danger}
                                                title="Reject"
                                            >
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Training Modal */}
            {showTrainingModal && (
                <TrainingModal
                    config={trainingConfig}
                    setConfig={setTrainingConfig}
                    onTrain={trainModel}
                    onClose={() => setShowTrainingModal(false)}
                />
            )}
        </div>
    );
};

// Helper Components
const SummaryCard = ({ title, value, icon, color }) => (
    <div style={{
        padding: '20px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
    }}>
        <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '8px',
            backgroundColor: `${color}20`,
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px'
        }}>
            {icon}
        </div>
        <div>
            <div style={{ fontSize: '14px', color: '#666' }}>{title}</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{value}</div>
        </div>
    </div>
);

const ModelCard = ({ model, onSelect, onToggle }) => (
    <div style={{
        padding: '16px',
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        cursor: 'pointer'
    }} onClick={onSelect}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: '600' }}>{model.name}</h4>
            <button
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '20px',
                    color: model.active ? '#48bb78' : '#a0aec0'
                }}
            >
                {model.active ? <FaToggleOn /> : <FaToggleOff />}
            </button>
        </div>
        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
            Type: {model.type}
        </div>
        <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
            Version: {model.version}
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
            <div>
                <span style={{ fontSize: '12px', color: '#999' }}>Accuracy</span>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{(model.accuracy * 100).toFixed(1)}%</div>
            </div>
            <div>
                <span style={{ fontSize: '12px', color: '#999' }}>Predictions</span>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{model.predictions || 0}</div>
            </div>
        </div>
    </div>
);

const TrainingModal = ({ config, setConfig, onTrain, onClose }) => (
    <div style={modalOverlayStyle}>
        <div style={modalContentStyle}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>
                Train New Model
            </h2>

            <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Model Type</label>
                <select
                    value={config.modelType}
                    onChange={(e) => setConfig({ ...config, modelType: e.target.value })}
                    style={inputStyle}
                >
                    <option value="classification">Classification</option>
                    <option value="regression">Regression</option>
                    <option value="clustering">Clustering</option>
                </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Epochs</label>
                <input
                    type="number"
                    value={config.epochs}
                    onChange={(e) => setConfig({ ...config, epochs: parseInt(e.target.value) })}
                    style={inputStyle}
                    min="1"
                    max="1000"
                />
            </div>

            <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Batch Size</label>
                <input
                    type="number"
                    value={config.batchSize}
                    onChange={(e) => setConfig({ ...config, batchSize: parseInt(e.target.value) })}
                    style={inputStyle}
                    min="1"
                    max="256"
                />
            </div>

            <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Validation Split</label>
                <input
                    type="number"
                    value={config.validationSplit}
                    onChange={(e) => setConfig({ ...config, validationSplit: parseFloat(e.target.value) })}
                    style={inputStyle}
                    min="0.1"
                    max="0.5"
                    step="0.05"
                />
            </div>

            <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>Learning Rate</label>
                <input
                    type="number"
                    value={config.learningRate}
                    onChange={(e) => setConfig({ ...config, learningRate: parseFloat(e.target.value) })}
                    style={inputStyle}
                    min="0.0001"
                    max="0.1"
                    step="0.0001"
                />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={buttonStyle.secondary}>
                    Cancel
                </button>
                <button onClick={onTrain} style={buttonStyle.success}>
                    Start Training
                </button>
            </div>
        </div>
    </div>
);

// Styles
const selectStyle = {
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #e2e8f0',
    backgroundColor: 'white',
    cursor: 'pointer'
};

const filterSelectStyle = {
    padding: '6px 10px',
    borderRadius: '4px',
    border: '1px solid #e2e8f0',
    backgroundColor: 'white',
    marginLeft: '8px'
};

const buttonStyle = {
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
    }
};

const smallButtonStyle = {
    success: {
        padding: '4px 8px',
        backgroundColor: '#48bb78',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
    },
    warning: {
        padding: '4px 8px',
        backgroundColor: '#ed8936',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
    },
    danger: {
        padding: '4px 8px',
        backgroundColor: '#f56565',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
    }
};

const chartCardStyle = {
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
};

const modalOverlayStyle = {
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
};

const modalContentStyle = {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '8px',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflow: 'auto'
};

const labelStyle = {
    display: 'block',
    marginBottom: '4px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#4a5568'
};

const inputStyle = {
    width: '100%',
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #e2e8f0',
    fontSize: '14px'
};

export default MLInteractions;