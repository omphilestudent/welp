import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import './PricingManagement.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://welp-4ipy.onrender.com/api';

const numberOr = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeCountryEntry = (entry = {}) => ({
    ...entry,
    multiplier: entry.multiplier == null ? 1 : numberOr(entry.multiplier, 1),
    client_paid_monthly_zar: numberOr(entry.client_paid_monthly_zar),
    psychologist_monthly_zar: numberOr(entry.psychologist_monthly_zar),
    business_base_monthly_zar: numberOr(entry.business_base_monthly_zar),
    business_enhanced_monthly_zar: numberOr(entry.business_enhanced_monthly_zar),
    business_premium_monthly_zar: numberOr(entry.business_premium_monthly_zar),
    updated_at: entry.updated_at || entry.updatedAt || null
});

const formatPriceDisplay = (value, currencyCode = 'ZAR') => {
    const symbol = currencyCode === 'ZAR' ? 'R ' : `${currencyCode} `;
    return `${symbol}${numberOr(value).toFixed(2)}`;
};

const formatMultiplier = (value) => numberOr(value, 1).toFixed(2);

const PricingManagement = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [activeTab, setActiveTab] = useState('plans');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRegion, setSelectedRegion] = useState('all');

    // Base pricing in ZAR
    const [basePrices, setBasePrices] = useState({
        client: 150,
        psychologist: 500,
        business_base: 1000,
        business_enhanced: 2000,
        business_premium: 3000
    });

    // Country-specific pricing
    const [countryPricing, setCountryPricing] = useState([]);
    const [filteredCountries, setFilteredCountries] = useState([]);

    // Editing state
    const [editingCountry, setEditingCountry] = useState(null);
    const [editingPlan, setEditingPlan] = useState(null);
    const [editForm, setEditForm] = useState({
        multiplier: 1,
        clientPrice: 0,
        psychologistPrice: 0,
        businessBasePrice: 0,
        businessEnhancedPrice: 0,
        businessPremiumPrice: 0,
        currencyCode: 'ZAR'
    });

    // Bulk update state
    const [showBulkUpdate, setShowBulkUpdate] = useState(false);
    const [bulkMultiplier, setBulkMultiplier] = useState(1);
    const [selectedCountries, setSelectedCountries] = useState([]);

    // New country form
    const [showAddCountry, setShowAddCountry] = useState(false);
    const [newCountry, setNewCountry] = useState({
        countryCode: '',
        countryName: '',
        multiplier: 1,
        currencyCode: 'ZAR'
    });

    // Regions for filtering
    const regions = {
        'all': 'All Countries',
        'NA': 'North America',
        'EU': 'Europe',
        'AS': 'Asia',
        'SA': 'South America',
        'AF': 'Africa',
        'OC': 'Oceania'
    };

    // Country to region mapping (simplified)
    const countryRegions = {
        'US': 'NA', 'CA': 'NA', 'MX': 'NA',
        'GB': 'EU', 'DE': 'EU', 'FR': 'EU', 'IT': 'EU', 'ES': 'EU', 'PT': 'EU', 'NL': 'EU', 'BE': 'EU', 'CH': 'EU', 'AT': 'EU', 'SE': 'EU', 'NO': 'EU', 'DK': 'EU', 'FI': 'EU', 'IE': 'EU', 'PL': 'EU', 'CZ': 'EU', 'SK': 'EU', 'HU': 'EU', 'RO': 'EU', 'BG': 'EU', 'GR': 'EU', 'HR': 'EU', 'SI': 'EU', 'SK': 'EU', 'EE': 'EU', 'LV': 'EU', 'LT': 'EU', 'CY': 'EU', 'MT': 'EU', 'IS': 'EU',
        'JP': 'AS', 'KR': 'AS', 'CN': 'AS', 'IN': 'AS', 'PK': 'AS', 'BD': 'AS', 'LK': 'AS', 'NP': 'AS', 'BT': 'AS', 'MV': 'AS', 'ID': 'AS', 'PH': 'AS', 'VN': 'AS', 'TH': 'AS', 'MY': 'AS', 'SG': 'AS', 'BN': 'AS', 'KH': 'AS', 'LA': 'AS', 'MM': 'AS', 'MN': 'AS', 'KZ': 'AS', 'UZ': 'AS', 'TM': 'AS', 'KG': 'AS', 'TJ': 'AS', 'RU': 'AS', 'UA': 'AS', 'BY': 'AS', 'MD': 'AS', 'GE': 'AS', 'AM': 'AS', 'AZ': 'AS', 'TR': 'AS', 'IL': 'AS', 'AE': 'AS', 'SA': 'AS', 'QA': 'AS', 'KW': 'AS', 'BH': 'AS', 'OM': 'AS', 'JO': 'AS', 'LB': 'AS', 'SY': 'AS', 'IQ': 'AS', 'IR': 'AS', 'YE': 'AS', 'AF': 'AS',
        'AU': 'OC', 'NZ': 'OC',
        'ZA': 'AF', 'NG': 'AF', 'KE': 'AF', 'EG': 'AF', 'MA': 'AF', 'TN': 'AF', 'DZ': 'AF', 'GH': 'AF', 'CM': 'AF', 'CI': 'AF', 'SN': 'AF', 'ML': 'AF', 'NE': 'AF', 'BF': 'AF', 'TG': 'AF', 'BJ': 'AF', 'SL': 'AF', 'LR': 'AF', 'GN': 'AF', 'GW': 'AF', 'GM': 'AF', 'CV': 'AF', 'GQ': 'AF', 'GA': 'AF', 'CG': 'AF', 'CD': 'AF', 'CF': 'AF', 'TD': 'AF', 'ET': 'AF', 'ER': 'AF', 'DJ': 'AF', 'SO': 'AF', 'SD': 'AF', 'SS': 'AF', 'UG': 'AF', 'TZ': 'AF', 'RW': 'AF', 'BI': 'AF', 'MW': 'AF', 'ZM': 'AF', 'ZW': 'AF', 'BW': 'AF', 'NA': 'AF', 'MZ': 'AF', 'AO': 'AF', 'MG': 'AF', 'MU': 'AF', 'SC': 'AF',
        'AR': 'SA', 'BR': 'SA', 'CL': 'SA', 'CO': 'SA', 'PE': 'SA', 'VE': 'SA', 'EC': 'SA', 'BO': 'SA', 'PY': 'SA', 'UY': 'SA', 'GY': 'SA', 'SR': 'SA', 'GF': 'SA'
    };

    useEffect(() => {
        fetchCountryPricing();
    }, []);

    useEffect(() => {
        filterCountries();
    }, [countryPricing, searchTerm, selectedRegion]);

    const pricingStats = useMemo(() => {
        const total = countryPricing.length;
        const avg = total
            ? (countryPricing.reduce((sum, country) => sum + numberOr(country.multiplier, 1), 0) / total).toFixed(2)
            : '0.00';
        const max = total
            ? Math.max(...countryPricing.map((country) => numberOr(country.multiplier, 1))).toFixed(2)
            : '0.00';
        const latestTimestamp = countryPricing.reduce((latest, country) => {
            const timestamp = country.updated_at ? new Date(country.updated_at).getTime() : 0;
            return timestamp > latest ? timestamp : latest;
        }, 0);

        return {
            total,
            filtered: filteredCountries.length,
            avgMultiplier: avg,
            maxMultiplier: max,
            lastUpdated: latestTimestamp ? new Date(latestTimestamp).toLocaleString() : '—'
        };
    }, [countryPricing, filteredCountries]);

    const fetchCountryPricing = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/admin/pricing/countries`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch pricing');

            const data = await response.json();
            const normalized = Array.isArray(data) ? data.map(normalizeCountryEntry) : [];
            setCountryPricing(normalized);
            filterCountries(normalized);
        } catch (err) {
            setError(err.message);
            toast.error('Failed to load pricing data');
        } finally {
            setLoading(false);
        }
    };

    const filterCountries = (data = countryPricing) => {
        let filtered = [...data];

        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(c =>
                c.country_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.country_code?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Apply region filter
        if (selectedRegion !== 'all') {
            filtered = filtered.filter(c =>
                countryRegions[c.country_code] === selectedRegion
            );
        }

        setFilteredCountries(filtered);
    };

    const handleBasePriceChange = (plan, value) => {
        setBasePrices(prev => ({
            ...prev,
            [plan]: parseFloat(value) || 0
        }));
    };

    const handleSaveBasePrices = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/admin/pricing/base`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(basePrices)
            });

            if (!response.ok) throw new Error('Failed to update base prices');

            toast.success('Base prices updated successfully');

            // Recalculate all country prices
            await recalculateAllPrices();
        } catch (err) {
            setError(err.message);
            toast.error('Failed to update base prices');
        } finally {
            setLoading(false);
        }
    };

    const recalculateAllPrices = async () => {
        try {
            const response = await fetch(`${API_URL}/admin/pricing/recalculate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to recalculate prices');

            await fetchCountryPricing();
            toast.success('All prices recalculated');
        } catch (err) {
            setError(err.message);
            toast.error('Failed to recalculate prices');
        }
    };

    const handleEditCountry = (country) => {
        setEditingCountry(country);
        setEditForm({
            multiplier: numberOr(country.multiplier, 1),
            clientPrice: numberOr(country.client_paid_monthly_zar),
            psychologistPrice: numberOr(country.psychologist_monthly_zar),
            businessBasePrice: numberOr(country.business_base_monthly_zar),
            businessEnhancedPrice: numberOr(country.business_enhanced_monthly_zar),
            businessPremiumPrice: numberOr(country.business_premium_monthly_zar),
            currencyCode: country.currency_code || 'ZAR'
        });
    };

    const handleSaveCountry = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/admin/pricing/countries/${editingCountry.country_code}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    multiplier: numberOr(editForm.multiplier, 1),
                    clientPrice: numberOr(editForm.clientPrice),
                    psychologistPrice: numberOr(editForm.psychologistPrice),
                    businessBasePrice: numberOr(editForm.businessBasePrice),
                    businessEnhancedPrice: numberOr(editForm.businessEnhancedPrice),
                    businessPremiumPrice: numberOr(editForm.businessPremiumPrice),
                    currencyCode: editForm.currencyCode || 'ZAR'
                })
            });

            if (!response.ok) throw new Error('Failed to update country pricing');

            toast.success('Country pricing updated successfully');
            setEditingCountry(null);
            await fetchCountryPricing();
        } catch (err) {
            setError(err.message);
            toast.error('Failed to update country pricing');
        } finally {
            setLoading(false);
        }
    };

    const handleBulkUpdate = async () => {
        if (selectedCountries.length === 0) {
            toast.error('Please select at least one country');
            return;
        }

        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/admin/pricing/bulk-update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    countryCodes: selectedCountries,
                    multiplier: bulkMultiplier
                })
            });

            if (!response.ok) throw new Error('Failed to bulk update pricing');

            toast.success(`${selectedCountries.length} countries updated successfully`);
            setShowBulkUpdate(false);
            setSelectedCountries([]);
            setBulkMultiplier(1);
            await fetchCountryPricing();
        } catch (err) {
            setError(err.message);
            toast.error('Failed to bulk update pricing');
        } finally {
            setLoading(false);
        }
    };

    const handleAddCountry = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/admin/pricing/countries`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    ...newCountry,
                    multiplier: numberOr(newCountry.multiplier, 1)
                })
            });

            if (!response.ok) throw new Error('Failed to add country');

            toast.success('Country added successfully');
            setShowAddCountry(false);
            setNewCountry({
                countryCode: '',
                countryName: '',
                multiplier: 1,
                currencyCode: 'ZAR'
            });
            await fetchCountryPricing();
        } catch (err) {
            setError(err.message);
            toast.error('Failed to add country');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCountry = async (countryCode) => {
        if (!window.confirm('Are you sure you want to delete this country pricing?')) return;

        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/admin/pricing/countries/${countryCode}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!response.ok) throw new Error('Failed to delete country');

            toast.success('Country deleted successfully');
            await fetchCountryPricing();
        } catch (err) {
            setError(err.message);
            toast.error('Failed to delete country');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAll = () => {
        if (selectedCountries.length === filteredCountries.length) {
            setSelectedCountries([]);
        } else {
            setSelectedCountries(filteredCountries.map(c => c.country_code));
        }
    };

    const handleSelectCountry = (countryCode) => {
        setSelectedCountries(prev =>
            prev.includes(countryCode)
                ? prev.filter(c => c !== countryCode)
                : [...prev, countryCode]
        );
    };

    const exportPricing = () => {
        const csv = [
            ['Country Code', 'Country Name', 'Multiplier', 'Client Price', 'Psychologist Price', 'Business Base', 'Business Enhanced', 'Business Premium', 'Currency'],
            ...filteredCountries.map(c => [
                c.country_code,
                c.country_name,
                c.multiplier,
                c.client_paid_monthly_zar,
                c.psychologist_monthly_zar,
                c.business_base_monthly_zar,
                c.business_enhanced_monthly_zar,
                c.business_premium_monthly_zar,
                c.currency_code
            ])
        ].map(row => row.join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pricing_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="pricing-management">
            <header className="pricing-header">
                <h1>Pricing Management</h1>
                <p>Configure subscription prices and country-specific multipliers</p>
            </header>

            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* Tabs */}
            <div className="pricing-tabs">
                <button
                    className={activeTab === 'plans' ? 'active' : ''}
                    onClick={() => setActiveTab('plans')}
                >
                    Plan Pricing
                </button>
                <button
                    className={activeTab === 'countries' ? 'active' : ''}
                    onClick={() => setActiveTab('countries')}
                >
                    Country Pricing
                </button>
                <button
                    className={activeTab === 'bulk' ? 'active' : ''}
                    onClick={() => setActiveTab('bulk')}
                >
                    Bulk Operations
                </button>
            </div>

            {/* Plan Pricing Tab */}
            {activeTab === 'plans' && (
                <div className="plans-pricing">
                    <div className="section-header">
                        <h2>Base Plan Prices (ZAR)</h2>
                        <p>These are the base prices before country multipliers are applied</p>
                    </div>

                    <div className="pricing-grid">
                        <div className="pricing-card">
                            <h3>Client Plan</h3>
                            <div className="price-display">
                                <span className="currency">R</span>
                                <input
                                    type="number"
                                    value={basePrices.client}
                                    onChange={(e) => handleBasePriceChange('client', e.target.value)}
                                    min="0"
                                    step="10"
                                />
                            </div>
                            <p className="price-note">Monthly subscription for clients</p>
                        </div>

                        <div className="pricing-card">
                            <h3>Psychologist Plan</h3>
                            <div className="price-display">
                                <span className="currency">R</span>
                                <input
                                    type="number"
                                    value={basePrices.psychologist}
                                    onChange={(e) => handleBasePriceChange('psychologist', e.target.value)}
                                    min="0"
                                    step="10"
                                />
                            </div>
                            <p className="price-note">Monthly subscription for psychologists</p>
                        </div>

                        <div className="pricing-card">
                            <h3>Business Base</h3>
                            <div className="price-display">
                                <span className="currency">R</span>
                                <input
                                    type="number"
                                    value={basePrices.business_base}
                                    onChange={(e) => handleBasePriceChange('business_base', e.target.value)}
                                    min="0"
                                    step="50"
                                />
                            </div>
                            <p className="price-note">Basic business plan</p>
                        </div>

                        <div className="pricing-card">
                            <h3>Business Enhanced</h3>
                            <div className="price-display">
                                <span className="currency">R</span>
                                <input
                                    type="number"
                                    value={basePrices.business_enhanced}
                                    onChange={(e) => handleBasePriceChange('business_enhanced', e.target.value)}
                                    min="0"
                                    step="50"
                                />
                            </div>
                            <p className="price-note">Enhanced business plan</p>
                        </div>

                        <div className="pricing-card">
                            <h3>Business Premium</h3>
                            <div className="price-display">
                                <span className="currency">R</span>
                                <input
                                    type="number"
                                    value={basePrices.business_premium}
                                    onChange={(e) => handleBasePriceChange('business_premium', e.target.value)}
                                    min="0"
                                    step="50"
                                />
                            </div>
                            <p className="price-note">Premium business plan</p>
                        </div>
                    </div>

                    <div className="action-buttons">
                        <button
                            className="btn-primary"
                            onClick={handleSaveBasePrices}
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : 'Save Base Prices'}
                        </button>
                        <button
                            className="btn-secondary"
                            onClick={recalculateAllPrices}
                            disabled={loading}
                        >
                            Recalculate All Prices
                        </button>
                    </div>
                </div>
            )}

            {/* Country Pricing Tab */}
            {activeTab === 'countries' && (
                <div className="countries-pricing">
                    <div className="section-header">
                        <h2>Country-Specific Pricing</h2>
                        <div className="header-actions">
                            <button
                                className="btn-secondary"
                                onClick={() => setShowAddCountry(true)}
                            >
                                + Add Country
                            </button>
                            <button
                                className="btn-secondary"
                                onClick={exportPricing}
                            >
                                Export CSV
                            </button>
                        </div>
                    </div>

                    <div className="stats-grid">
                        <div className="stats-card">
                            <p className="stats-label">Countries Configured</p>
                            <p className="stats-value">{pricingStats.total}</p>
                            <span className="stats-subtext">{pricingStats.filtered} shown</span>
                        </div>
                        <div className="stats-card">
                            <p className="stats-label">Average Multiplier</p>
                            <p className="stats-value">{pricingStats.avgMultiplier}x</p>
                            <span className="stats-subtext">Peak {pricingStats.maxMultiplier}x</span>
                        </div>
                        <div className="stats-card">
                            <p className="stats-label">Last Updated</p>
                            <p className="stats-value stats-value--sm">{pricingStats.lastUpdated}</p>
                            <span className="stats-subtext">Auto-adjusted after each edit</span>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="filters-card">
                        <div className="filters-bar">
                            <input
                                type="text"
                                placeholder="Search by country or code..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                            />
                            <select
                                value={selectedRegion}
                                onChange={(e) => setSelectedRegion(e.target.value)}
                                className="region-select"
                            >
                                {Object.entries(regions).map(([code, name]) => (
                                    <option key={code} value={code}>{name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Countries Table */}
                    <div className="table-wrapper">
                        <table className="pricing-table">
                            <thead>
                            <tr>
                                <th>Country</th>
                                <th>Code</th>
                                <th>Multiplier</th>
                                <th>Client</th>
                                <th>Psychologist</th>
                                <th>Business Base</th>
                                <th>Business Enhanced</th>
                                <th>Business Premium</th>
                                <th>Currency</th>
                                <th>Actions</th>
                            </tr>
                            </thead>
                            <tbody>
                            {filteredCountries.map(country => (
                                <tr key={country.country_code}>
                                    <td>{country.country_name}</td>
                                    <td><code>{country.country_code}</code></td>
                                    <td>
                                        {editingCountry?.country_code === country.country_code ? (
                                            <input
                                                type="number"
                                                step="0.1"
                                                min="0.1"
                                                value={editForm.multiplier ?? 1}
                                                onChange={(e) => setEditForm({
                                                    ...editForm,
                                                    multiplier: parseFloat(e.target.value)
                                                })}
                                                className="edit-input"
                                            />
                                        ) : (
                                                <span className="multiplier-badge">
                                                    {formatMultiplier(country.multiplier)}x
                                                </span>
                                        )}
                                    </td>
                                    <td>
                                        {editingCountry?.country_code === country.country_code ? (
                                            <input
                                                type="number"
                                                value={editForm.clientPrice ?? 0}
                                                onChange={(e) => setEditForm({
                                                    ...editForm,
                                                    clientPrice: parseFloat(e.target.value)
                                                })}
                                                className="edit-input"
                                            />
                                        ) : (
                                            formatPriceDisplay(country.client_paid_monthly_zar, country.currency_code)
                                        )}
                                    </td>
                                    <td>
                                        {editingCountry?.country_code === country.country_code ? (
                                            <input
                                                type="number"
                                                value={editForm.psychologistPrice ?? 0}
                                                onChange={(e) => setEditForm({
                                                    ...editForm,
                                                    psychologistPrice: parseFloat(e.target.value)
                                                })}
                                                className="edit-input"
                                            />
                                        ) : (
                                            formatPriceDisplay(country.psychologist_monthly_zar, country.currency_code)
                                        )}
                                    </td>
                                    <td>
                                        {editingCountry?.country_code === country.country_code ? (
                                            <input
                                                type="number"
                                                value={editForm.businessBasePrice ?? 0}
                                                onChange={(e) => setEditForm({
                                                    ...editForm,
                                                    businessBasePrice: parseFloat(e.target.value)
                                                })}
                                                className="edit-input"
                                            />
                                        ) : (
                                            formatPriceDisplay(country.business_base_monthly_zar, country.currency_code)
                                        )}
                                    </td>
                                    <td>
                                        {editingCountry?.country_code === country.country_code ? (
                                            <input
                                                type="number"
                                                value={editForm.businessEnhancedPrice ?? 0}
                                                onChange={(e) => setEditForm({
                                                    ...editForm,
                                                    businessEnhancedPrice: parseFloat(e.target.value)
                                                })}
                                                className="edit-input"
                                            />
                                        ) : (
                                            formatPriceDisplay(country.business_enhanced_monthly_zar, country.currency_code)
                                        )}
                                    </td>
                                    <td>
                                        {editingCountry?.country_code === country.country_code ? (
                                            <input
                                                type="number"
                                                value={editForm.businessPremiumPrice ?? 0}
                                                onChange={(e) => setEditForm({
                                                    ...editForm,
                                                    businessPremiumPrice: parseFloat(e.target.value)
                                                })}
                                                className="edit-input"
                                            />
                                        ) : (
                                            formatPriceDisplay(country.business_premium_monthly_zar, country.currency_code)
                                        )}
                                    </td>
                                    <td>{country.currency_code || 'ZAR'}</td>
                                    <td className="actions">
                                        {editingCountry?.country_code === country.country_code ? (
                                            <>
                                                <button
                                                    className="btn-save"
                                                    onClick={handleSaveCountry}
                                                    disabled={loading}
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    className="btn-cancel"
                                                    onClick={() => setEditingCountry(null)}
                                                >
                                                    Cancel
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    className="btn-edit"
                                                    onClick={() => handleEditCountry(country)}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    className="btn-delete"
                                                    onClick={() => handleDeleteCountry(country.country_code)}
                                                >
                                                    Delete
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Bulk Operations Tab */}
            {activeTab === 'bulk' && (
                <div className="bulk-operations">
                    <div className="section-header">
                        <h2>Bulk Update Pricing</h2>
                        <button
                            className="btn-secondary"
                            onClick={() => setShowBulkUpdate(true)}
                        >
                            New Bulk Update
                        </button>
                    </div>

                    {showBulkUpdate && (
                        <div className="bulk-form">
                            <h3>Update Multiple Countries</h3>

                            <div className="form-group">
                                <label>Select Countries:</label>
                                <div className="country-selection">
                                    <div className="selection-controls">
                                        <button onClick={handleSelectAll} className="btn-small">
                                            {selectedCountries.length === filteredCountries.length ? 'Deselect All' : 'Select All'}
                                        </button>
                                        <span>{selectedCountries.length} countries selected</span>
                                    </div>
                                    <div className="country-checkboxes">
                                        {filteredCountries.map(country => (
                                            <label key={country.country_code} className="checkbox-label">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCountries.includes(country.country_code)}
                                                    onChange={() => handleSelectCountry(country.country_code)}
                                                />
                                                {country.country_name} ({country.country_code})
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>New Multiplier:</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    value={bulkMultiplier}
                                    onChange={(e) => setBulkMultiplier(parseFloat(e.target.value))}
                                    className="bulk-input"
                                />
                                <p className="help-text">
                                    This will multiply all prices by the new multiplier
                                </p>
                            </div>

                            <div className="preview">
                                <h4>Preview Changes:</h4>
                                <p>Client: R {(basePrices.client * bulkMultiplier).toFixed(2)}</p>
                                <p>Psychologist: R {(basePrices.psychologist * bulkMultiplier).toFixed(2)}</p>
                                <p>Business Base: R {(basePrices.business_base * bulkMultiplier).toFixed(2)}</p>
                                <p>Business Enhanced: R {(basePrices.business_enhanced * bulkMultiplier).toFixed(2)}</p>
                                <p>Business Premium: R {(basePrices.business_premium * bulkMultiplier).toFixed(2)}</p>
                            </div>

                            <div className="form-actions">
                                <button
                                    className="btn-primary"
                                    onClick={handleBulkUpdate}
                                    disabled={loading || selectedCountries.length === 0}
                                >
                                    {loading ? 'Updating...' : 'Apply Bulk Update'}
                                </button>
                                <button
                                    className="btn-secondary"
                                    onClick={() => {
                                        setShowBulkUpdate(false);
                                        setSelectedCountries([]);
                                        setBulkMultiplier(1);
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="quick-actions">
                        <h3>Quick Actions</h3>
                        <div className="action-grid">
                            <button
                                className="action-card"
                                onClick={() => {
                                    setSelectedRegion('EU');
                                    setShowBulkUpdate(true);
                                }}
                            >
                                <span className="action-icon">🇪🇺</span>
                                <span className="action-title">Update Europe</span>
                                <span className="action-desc">Bulk update all European countries</span>
                            </button>
                            <button
                                className="action-card"
                                onClick={() => {
                                    setSelectedRegion('AS');
                                    setShowBulkUpdate(true);
                                }}
                            >
                                <span className="action-icon">🌏</span>
                                <span className="action-title">Update Asia</span>
                                <span className="action-desc">Bulk update all Asian countries</span>
                            </button>
                            <button
                                className="action-card"
                                onClick={() => {
                                    setSelectedRegion('AF');
                                    setShowBulkUpdate(true);
                                }}
                            >
                                <span className="action-icon">🌍</span>
                                <span className="action-title">Update Africa</span>
                                <span className="action-desc">Bulk update all African countries</span>
                            </button>
                            <button
                                className="action-card"
                                onClick={() => {
                                    setSelectedRegion('SA');
                                    setShowBulkUpdate(true);
                                }}
                            >
                                <span className="action-icon">🌎</span>
                                <span className="action-title">Update South America</span>
                                <span className="action-desc">Bulk update all South American countries</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Country Modal */}
            {showAddCountry && (
                <div className="modal" onClick={() => setShowAddCountry(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h2>Add New Country</h2>

                        <div className="form-group">
                            <label>Country Code (2 letters):</label>
                            <input
                                type="text"
                                maxLength="2"
                                value={newCountry.countryCode}
                                onChange={(e) => setNewCountry({
                                    ...newCountry,
                                    countryCode: e.target.value.toUpperCase()
                                })}
                                placeholder="US"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Country Name:</label>
                            <input
                                type="text"
                                value={newCountry.countryName}
                                onChange={(e) => setNewCountry({
                                    ...newCountry,
                                    countryName: e.target.value
                                })}
                                placeholder="United States"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Multiplier:</label>
                            <input
                                type="number"
                                step="0.1"
                                min="0.1"
                                value={newCountry.multiplier}
                                onChange={(e) => setNewCountry({
                                    ...newCountry,
                                    multiplier: parseFloat(e.target.value)
                                })}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Currency Code:</label>
                            <input
                                type="text"
                                maxLength="3"
                                value={newCountry.currencyCode}
                                onChange={(e) => setNewCountry({
                                    ...newCountry,
                                    currencyCode: e.target.value.toUpperCase()
                                })}
                                placeholder="ZAR"
                                required
                            />
                        </div>

                        <div className="modal-actions">
                            <button
                                className="btn-primary"
                                onClick={handleAddCountry}
                                disabled={loading}
                            >
                                Add Country
                            </button>
                            <button
                                className="btn-secondary"
                                onClick={() => setShowAddCountry(false)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PricingManagement;
