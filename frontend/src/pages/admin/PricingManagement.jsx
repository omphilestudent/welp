// frontend/src/pages/admin/PricingManagement.jsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Loading from '../../components/common/Loading';
import toast from 'react-hot-toast';
import { FaEdit, FaSave, FaTimes, FaPlus, FaTrash } from 'react-icons/fa';

const PricingManagement = () => {
    const [pricing, setPricing] = useState(null);
    const [countries, setCountries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingPlan, setEditingPlan] = useState(null);
    const [editingCountry, setEditingCountry] = useState(null);
    const [showAddCountry, setShowAddCountry] = useState(false);

    useEffect(() => {
        fetchPricing();
        fetchCountries();
    }, []);

    const fetchPricing = async () => {
        try {
            const { data } = await api.get('/admin/pricing');
            setPricing(data);
        } catch (error) {
            toast.error('Failed to load pricing');
        }
    };

    const fetchCountries = async () => {
        try {
            const { data } = await api.get('/admin/pricing/countries');
            setCountries(data);
        } catch (error) {
            toast.error('Failed to load countries');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePricing = async (role, plan, updates) => {
        try {
            await api.put(`/admin/pricing/${role}/${plan}`, updates);
            toast.success('Pricing updated successfully');
            fetchPricing();
            setEditingPlan(null);
        } catch (error) {
            toast.error('Failed to update pricing');
        }
    };

    const handleUpdateCountry = async (countryCode, updates) => {
        try {
            await api.patch(`/admin/pricing/country/${countryCode}`, updates);
            toast.success('Country pricing updated');
            fetchCountries();
            setEditingCountry(null);
        } catch (error) {
            toast.error('Failed to update country');
        }
    };

    const handleAddCountry = async (countryData) => {
        try {
            await api.post('/admin/pricing/country', countryData);
            toast.success('Country added successfully');
            fetchCountries();
            setShowAddCountry(false);
        } catch (error) {
            toast.error('Failed to add country');
        }
    };

    if (loading) return <Loading />;

    return (
        <div className="pricing-management">
            <h1>Pricing Management</h1>

            {/* Plan Pricing Section */}
            <section className="pricing-section">
                <h2>Subscription Plans</h2>
                <div className="plans-grid">
                    {['employee', 'psychologist', 'business'].map(role => (
                        <div key={role} className="role-section">
                            <h3>{role.charAt(0).toUpperCase() + role.slice(1)}</h3>
                            {['free', 'premium'].map(plan => {
                                const planData = pricing?.[role]?.[plan];
                                const isEditing = editingPlan === `${role}-${plan}`;

                                return (
                                    <div key={plan} className="plan-card">
                                        <div className="plan-header">
                                            <h4>{planData?.name || `${plan} Plan`}</h4>
                                            {!isEditing ? (
                                                <button
                                                    className="edit-btn"
                                                    onClick={() => setEditingPlan(`${role}-${plan}`)}
                                                >
                                                    <FaEdit />
                                                </button>
                                            ) : (
                                                <button
                                                    className="cancel-btn"
                                                    onClick={() => setEditingPlan(null)}
                                                >
                                                    <FaTimes />
                                                </button>
                                            )}
                                        </div>

                                        {!isEditing ? (
                                            <>
                                                <div className="price-display">
                                                    <span className="currency">USD</span>
                                                    <span className="amount">${planData?.base_price_usd}</span>
                                                    <span className="period">/month</span>
                                                </div>
                                                <div className="features-list">
                                                    {planData?.features?.map((feature, i) => (
                                                        <div key={i} className="feature-item">✓ {feature}</div>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            <PriceEditor
                                                role={role}
                                                plan={plan}
                                                initialData={planData}
                                                onSave={(updates) => handleUpdatePricing(role, plan, updates)}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </section>

            {/* Country Pricing Section */}
            <section className="country-section">
                <h2>Country Pricing</h2>
                <button
                    className="btn btn-primary"
                    onClick={() => setShowAddCountry(true)}
                >
                    <FaPlus /> Add Country
                </button>

                <div className="countries-table">
                    <table>
                        <thead>
                        <tr>
                            <th>Country</th>
                            <th>Code</th>
                            <th>Multiplier</th>
                            <th>Currency</th>
                            <th>Symbol</th>
                            <th>Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {countries.map(country => (
                            <tr key={country.code}>
                                {editingCountry === country.code ? (
                                    <>
                                        <td>{country.name}</td>
                                        <td>{country.code}</td>
                                        <td>
                                            <input
                                                type="number"
                                                step="0.05"
                                                defaultValue={country.multiplier}
                                                onChange={(e) => country.newMultiplier = e.target.value}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                maxLength="3"
                                                defaultValue={country.currency}
                                                onChange={(e) => country.newCurrency = e.target.value}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                maxLength="2"
                                                defaultValue={country.symbol}
                                                onChange={(e) => country.newSymbol = e.target.value}
                                            />
                                        </td>
                                        <td>
                                            <button
                                                className="btn-icon"
                                                onClick={() => handleUpdateCountry(country.code, {
                                                    multiplier: country.newMultiplier || country.multiplier,
                                                    currency: country.newCurrency || country.currency,
                                                    currency_symbol: country.newSymbol || country.symbol
                                                })}
                                            >
                                                <FaSave />
                                            </button>
                                            <button
                                                className="btn-icon"
                                                onClick={() => setEditingCountry(null)}
                                            >
                                                <FaTimes />
                                            </button>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td>{country.name}</td>
                                        <td>{country.code}</td>
                                        <td>{country.multiplier}x</td>
                                        <td>{country.currency}</td>
                                        <td>{country.symbol}</td>
                                        <td>
                                            <button
                                                className="btn-icon"
                                                onClick={() => setEditingCountry(country.code)}
                                            >
                                                <FaEdit />
                                            </button>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Add Country Modal */}
            {showAddCountry && (
                <AddCountryModal
                    onClose={() => setShowAddCountry(false)}
                    onSave={handleAddCountry}
                />
            )}
        </div>
    );
};

// Price Editor Component
const PriceEditor = ({ role, plan, initialData, onSave }) => {
    const [price, setPrice] = useState(initialData?.base_price_usd || 0);
    const [features, setFeatures] = useState(initialData?.features || []);

    const handleAddFeature = () => {
        setFeatures([...features, '']);
    };

    const handleFeatureChange = (index, value) => {
        const newFeatures = [...features];
        newFeatures[index] = value;
        setFeatures(newFeatures);
    };

    const handleRemoveFeature = (index) => {
        setFeatures(features.filter((_, i) => i !== index));
    };

    return (
        <div className="price-editor">
            <div className="form-group">
                <label>Base Price (USD)</label>
                <input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(parseFloat(e.target.value))}
                />
            </div>

            <div className="form-group">
                <label>Features</label>
                {features.map((feature, index) => (
                    <div key={index} className="feature-input">
                        <input
                            type="text"
                            value={feature}
                            onChange={(e) => handleFeatureChange(index, e.target.value)}
                            placeholder="Enter feature description"
                        />
                        <button onClick={() => handleRemoveFeature(index)}>
                            <FaTrash />
                        </button>
                    </div>
                ))}
                <button onClick={handleAddFeature} className="btn btn-secondary">
                    <FaPlus /> Add Feature
                </button>
            </div>

            <div className="editor-actions">
                <button
                    className="btn btn-primary"
                    onClick={() => onSave({ base_price_usd: price, features })}
                >
                    <FaSave /> Save Changes
                </button>
            </div>
        </div>
    );
};

// Add Country Modal
const AddCountryModal = ({ onClose, onSave }) => {
    const [formData, setFormData] = useState({
        country_code: '',
        country_name: '',
        multiplier: 1.0,
        currency: '',
        currency_symbol: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h2>Add Country Pricing</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Country Code</label>
                        <input
                            type="text"
                            maxLength="2"
                            value={formData.country_code}
                            onChange={(e) => setFormData({...formData, country_code: e.target.value.toUpperCase()})}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Country Name</label>
                        <input
                            type="text"
                            value={formData.country_name}
                            onChange={(e) => setFormData({...formData, country_name: e.target.value})}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Price Multiplier</label>
                        <input
                            type="number"
                            step="0.05"
                            min="0.1"
                            max="2.0"
                            value={formData.multiplier}
                            onChange={(e) => setFormData({...formData, multiplier: parseFloat(e.target.value)})}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Currency Code</label>
                        <input
                            type="text"
                            maxLength="3"
                            value={formData.currency}
                            onChange={(e) => setFormData({...formData, currency: e.target.value.toUpperCase()})}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Currency Symbol</label>
                        <input
                            type="text"
                            maxLength="2"
                            value={formData.currency_symbol}
                            onChange={(e) => setFormData({...formData, currency_symbol: e.target.value})}
                            required
                        />
                    </div>
                    <div className="modal-actions">
                        <button type="submit" className="btn btn-primary">Add Country</button>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PricingManagement;