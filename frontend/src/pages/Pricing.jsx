// frontend/src/pages/Pricing.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import Loading from '../components/common/Loading';
import toast from 'react-hot-toast';
import {
    FaCheckCircle,
    FaTimesCircle,
    FaGlobe,
    FaStar,
    FaInfinity,
    FaVideo,
    FaComment,
    FaUserMd,
    FaBuilding,
    FaCrown
} from 'react-icons/fa';

const Pricing = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [selectedRole, setSelectedRole] = useState('employee');
    const [selectedCountry, setSelectedCountry] = useState('ZA');
    const [pricing, setPricing] = useState(null);
    const [countries, setCountries] = useState([]);
    const [loading, setLoading] = useState(true);

    // Hardcoded countries
    const hardcodedCountries = [
        { code: 'US', name: 'United States', currency: 'USD' },
        { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
        { code: 'CA', name: 'Canada', currency: 'CAD' },
        { code: 'AU', name: 'Australia', currency: 'AUD' },
        { code: 'DE', name: 'Germany', currency: 'EUR' },
        { code: 'FR', name: 'France', currency: 'EUR' },
        { code: 'IT', name: 'Italy', currency: 'EUR' },
        { code: 'ES', name: 'Spain', currency: 'EUR' },
        { code: 'JP', name: 'Japan', currency: 'JPY' },
        { code: 'SG', name: 'Singapore', currency: 'SGD' },
        { code: 'ZA', name: 'South Africa', currency: 'ZAR' },
        { code: 'NG', name: 'Nigeria', currency: 'NGN' },
        { code: 'KE', name: 'Kenya', currency: 'KES' },
        { code: 'BR', name: 'Brazil', currency: 'BRL' },
        { code: 'IN', name: 'India', currency: 'INR' },
        { code: 'CN', name: 'China', currency: 'CNY' },
        { code: 'AE', name: 'UAE', currency: 'AED' }
    ];

    useEffect(() => {
        fetchCountries();
    }, []);

    useEffect(() => {
        fetchPricing();
    }, [selectedRole, selectedCountry]);

    const fetchCountries = async () => {
        try {
            const { data } = await api.get('/pricing/countries');
            setCountries(data);
        } catch (error) {
            console.error('Failed to fetch countries, using hardcoded:', error);
            setCountries(hardcookedCountries);
        }
    };

    const fetchPricing = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/pricing/plans', {
                params: { role: selectedRole, country: selectedCountry }
            });
            console.log('Pricing data received:', data);
            setPricing(data);
        } catch (error) {
            console.error('Failed to fetch pricing:', error);
            toast.error('Failed to load pricing');
        } finally {
            setLoading(false);
        }
    };

    const handleSubscribe = (plan) => {
        if (!user) {
            toast.error('Please login to subscribe');
            navigate('/login');
            return;
        }

        const country = countries.find(c => c.code === selectedCountry)?.name || selectedCountry;
        const amount = pricing?.[plan]?.price;
        const currency = pricing?.[plan]?.currency;

        toast.success(`Selected ${plan} plan for ${selectedRole}s in ${country} - ${currency} ${amount}/month`);
    };

    if (loading) return <Loading />;

    return (
        <div className="pricing-page">
            {/* Header */}
            <div className="pricing-header">
                <div className="container">
                    <h1>Simple, Transparent Pricing</h1>
                    <p>Choose the plan that fits your needs</p>
                </div>
            </div>

            <div className="container">
                {/* Role Selector */}
                <div className="role-selector">
                    {['employee', 'psychologist', 'business'].map(role => (
                        <button
                            key={role}
                            className={`role-btn ${selectedRole === role ? 'active' : ''}`}
                            onClick={() => setSelectedRole(role)}
                        >
                            {role === 'employee' && <FaStar />}
                            {role === 'psychologist' && <FaUserMd />}
                            {role === 'business' && <FaBuilding />}
                            <span>{role.charAt(0).toUpperCase() + role.slice(1)}</span>
                        </button>
                    ))}
                </div>

                {/* Country Selector */}
                <div className="country-selector">
                    <FaGlobe />
                    <label>Select your country:</label>
                    <select
                        value={selectedCountry}
                        onChange={(e) => setSelectedCountry(e.target.value)}
                        className="country-select"
                    >
                        {countries.map(country => (
                            <option key={country.code} value={country.code}>
                                {country.name} ({country.currency})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Pricing Cards */}
                {pricing && (
                    <div className="pricing-grid">
                        {/* Free Plan */}
                        <div className="pricing-card free">
                            <div className="pricing-card-header">
                                <h3>{pricing[selectedRole]?.free?.name || 'Free Plan'}</h3>
                                <div className="price">
                                    <span className="currency">{pricing[selectedRole]?.free?.currency || 'ZAR'}</span>
                                    <span className="amount">{
                                        pricing[selectedRole]?.free?.price === 0
                                            ? '0'
                                            : pricing[selectedRole]?.free?.price?.toFixed(2) || '0'
                                    }</span>
                                    <span className="period">/month</span>
                                </div>
                            </div>

                            <div className="pricing-card-features">
                                {pricing[selectedRole]?.free?.features?.map((feature, index) => (
                                    <div key={index} className="feature">
                                        <FaCheckCircle className="check-icon" />
                                        <span>{feature}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="pricing-card-footer">
                                <button
                                    onClick={() => handleSubscribe('free')}
                                    className="btn btn-secondary btn-block"
                                >
                                    {user ? 'Current Plan' : 'Get Started'}
                                </button>
                            </div>
                        </div>

                        {/* Premium Plan */}
                        {pricing[selectedRole]?.premium && (
                            <div className="pricing-card premium">
                                <div className="popular-badge">Most Popular</div>
                                <div className="pricing-card-header">
                                    <h3>{pricing[selectedRole]?.premium?.name || 'Premium Plan'}</h3>
                                    <div className="price">
                                        <span className="currency">{pricing[selectedRole]?.premium?.currency || 'ZAR'}</span>
                                        <span className="amount">{
                                            pricing[selectedRole]?.premium?.price?.toFixed(2) || '499.00'
                                        }</span>
                                        <span className="period">/month</span>
                                    </div>
                                </div>

                                <div className="pricing-card-features">
                                    {pricing[selectedRole]?.premium?.features?.map((feature, index) => (
                                        <div key={index} className="feature">
                                            <FaCheckCircle className="check-icon premium" />
                                            <span>{feature}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="pricing-card-footer">
                                    <button
                                        onClick={() => handleSubscribe('premium')}
                                        className="btn btn-primary btn-block"
                                    >
                                        {user ? 'Upgrade to Premium' : 'Get Started'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Feature Comparison Table */}
                {selectedRole === 'employee' && (
                    <div className="comparison-section">
                        <h2>Compare Plans</h2>
                        <div className="comparison-table">
                            <table>
                                <thead>
                                <tr>
                                    <th>Feature</th>
                                    <th>Free</th>
                                    <th>Premium</th>
                                </tr>
                                </thead>
                                <tbody>
                                <tr>
                                    <td>Company Reviews</td>
                                    <td><FaCheckCircle className="check-icon" /></td>
                                    <td><FaCheckCircle className="check-icon premium" /></td>
                                </tr>
                                <tr>
                                    <td>Daily Chat Hours</td>
                                    <td>2 hours/day</td>
                                    <td><FaInfinity className="infinity-icon" /> Unlimited</td>
                                </tr>
                                <tr>
                                    <td>Video Calls per Week</td>
                                    <td>1 (30 mins)</td>
                                    <td>3 (60 mins each)</td>
                                </tr>
                                <tr>
                                    <td>Assigned Psychologist</td>
                                    <td><FaTimesCircle className="times-icon" /></td>
                                    <td><FaCheckCircle className="check-icon premium" /> Yes</td>
                                </tr>
                                <tr>
                                    <td>Priority Response</td>
                                    <td><FaTimesCircle className="times-icon" /></td>
                                    <td><FaCheckCircle className="check-icon premium" /></td>
                                </tr>
                                <tr>
                                    <td>Wellness Check-ins</td>
                                    <td><FaTimesCircle className="times-icon" /></td>
                                    <td>Weekly</td>
                                </tr>
                                <tr>
                                    <td>Crisis Support Line</td>
                                    <td>Basic</td>
                                    <td>24/7 Priority</td>
                                </tr>
                                <tr>
                                    <td><strong>Monthly Price</strong></td>
                                    <td><strong>Free</strong></td>
                                    <td><strong>{pricing?.employee?.premium?.currency} {pricing?.employee?.premium?.price?.toFixed(2)}/month</strong></td>
                                </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {selectedRole === 'psychologist' && (
                    <div className="comparison-section">
                        <h2>Compare Plans</h2>
                        <div className="comparison-table">
                            <table>
                                <thead>
                                <tr>
                                    <th>Feature</th>
                                    <th>Free</th>
                                    <th>Premium</th>
                                </tr>
                                </thead>
                                <tbody>
                                <tr>
                                    <td>Profile Listing</td>
                                    <td>Basic</td>
                                    <td>Featured + Verified</td>
                                </tr>
                                <tr>
                                    <td>Monthly Messages</td>
                                    <td>5/month</td>
                                    <td><FaInfinity className="infinity-icon" /> Unlimited</td>
                                </tr>
                                <tr>
                                    <td>Lead Generation</td>
                                    <td><FaTimesCircle className="times-icon" /></td>
                                    <td><FaCheckCircle className="check-icon premium" /> Priority</td>
                                </tr>
                                <tr>
                                    <td>Client Assignments</td>
                                    <td><FaTimesCircle className="times-icon" /></td>
                                    <td><FaCheckCircle className="check-icon premium" /> Regular</td>
                                </tr>
                                <tr>
                                    <td>Analytics Dashboard</td>
                                    <td><FaTimesCircle className="times-icon" /></td>
                                    <td><FaCheckCircle className="check-icon premium" /> Advanced</td>
                                </tr>
                                <tr>
                                    <td>Schedule Management</td>
                                    <td>Basic</td>
                                    <td>Advanced Tools</td>
                                </tr>
                                <tr>
                                    <td>Payment Processing</td>
                                    <td><FaTimesCircle className="times-icon" /></td>
                                    <td><FaCheckCircle className="check-icon premium" /> Included</td>
                                </tr>
                                <tr>
                                    <td><strong>Monthly Price</strong></td>
                                    <td><strong>Free</strong></td>
                                    <td><strong>{pricing?.psychologist?.premium?.currency} {pricing?.psychologist?.premium?.price?.toFixed(2)}/month</strong></td>
                                </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {selectedRole === 'business' && (
                    <div className="comparison-section">
                        <h2>Compare Plans</h2>
                        <div className="comparison-table">
                            <table>
                                <thead>
                                <tr>
                                    <th>Feature</th>
                                    <th>Free</th>
                                    <th>Premium</th>
                                </tr>
                                </thead>
                                <tbody>
                                <tr>
                                    <td>Company Profile</td>
                                    <td>Basic</td>
                                    <td>Enhanced + Branding</td>
                                </tr>
                                <tr>
                                    <td>Team Members</td>
                                    <td>Up to 3</td>
                                    <td><FaInfinity className="infinity-icon" /> Unlimited</td>
                                </tr>
                                <tr>
                                    <td>Analytics Dashboard</td>
                                    <td>Basic</td>
                                    <td>Advanced</td>
                                </tr>
                                <tr>
                                    <td>Employee Sentiment Tracking</td>
                                    <td><FaTimesCircle className="times-icon" /></td>
                                    <td><FaCheckCircle className="check-icon premium" /></td>
                                </tr>
                                <tr>
                                    <td>Wellness Program Integration</td>
                                    <td><FaTimesCircle className="times-icon" /></td>
                                    <td><FaCheckCircle className="check-icon premium" /></td>
                                </tr>
                                <tr>
                                    <td>API Access</td>
                                    <td><FaTimesCircle className="times-icon" /></td>
                                    <td><FaCheckCircle className="check-icon premium" /></td>
                                </tr>
                                <tr>
                                    <td>Account Manager</td>
                                    <td><FaTimesCircle className="times-icon" /></td>
                                    <td><FaCheckCircle className="check-icon premium" /> Dedicated</td>
                                </tr>
                                <tr>
                                    <td><strong>Monthly Price</strong></td>
                                    <td><strong>Free</strong></td>
                                    <td><strong>{pricing?.business?.premium?.currency} {pricing?.business?.premium?.price?.toFixed(2)}/month</strong></td>
                                </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Country Pricing Note */}
                <div className="pricing-note">
                    <p>✨ Prices are adjusted based on your country's economic factors to ensure fair access worldwide.</p>
                    <p>Selected country: {countries.find(c => c.code === selectedCountry)?.name} ({countries.find(c => c.code === selectedCountry)?.currency})</p>
                </div>

                {/* FAQ Section */}
                <div className="pricing-faq">
                    <h2>Frequently Asked Questions</h2>
                    <div className="faq-grid">
                        <div className="faq-item">
                            <h3>Can I switch plans anytime?</h3>
                            <p>Yes, you can upgrade or downgrade at any time. Changes reflect in next billing cycle.</p>
                        </div>
                        <div className="faq-item">
                            <h3>Is there a contract?</h3>
                            <p>No, all plans are month-to-month. Cancel anytime with no penalties.</p>
                        </div>
                        <div className="faq-item">
                            <h3>How does country pricing work?</h3>
                            <p>We adjust prices based on local economic factors to make our service accessible globally.</p>
                        </div>
                        <div className="faq-item">
                            <h3>What payment methods?</h3>
                            <p>We accept all major credit cards, PayPal, and bank transfers in select countries.</p>
                        </div>
                        <div className="faq-item">
                            <h3>Is my data secure?</h3>
                            <p>Yes, we use enterprise-grade encryption and comply with GDPR and HIPAA regulations.</p>
                        </div>
                        <div className="faq-item">
                            <h3>Can I get a refund?</h3>
                            <p>We offer a 14-day money-back guarantee for all premium plans.</p>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .pricing-page {
                    min-height: 100vh;
                    background: #f8fafc;
                    padding-bottom: 4rem;
                }

                .pricing-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 4rem 0;
                    text-align: center;
                    margin-bottom: 2rem;
                }

                .pricing-header h1 {
                    font-size: 2.5rem;
                    margin-bottom: 1rem;
                }

                .pricing-header p {
                    font-size: 1.2rem;
                    opacity: 0.95;
                }

                .role-selector {
                    display: flex;
                    justify-content: center;
                    gap: 1rem;
                    margin: 2rem 0;
                }

                .role-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 1rem 2rem;
                    border: 2px solid #e2e8f0;
                    border-radius: 50px;
                    background: white;
                    color: #4a5568;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                }

                .role-btn:hover {
                    border-color: #667eea;
                    color: #667eea;
                }

                .role-btn.active {
                    background: #667eea;
                    border-color: #667eea;
                    color: white;
                }

                .role-btn svg {
                    font-size: 1.2rem;
                }

                .country-selector {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 1rem;
                    margin: 2rem auto;
                    padding: 1rem 2rem;
                    background: white;
                    border-radius: 50px;
                    max-width: 500px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                .country-selector svg {
                    color: #667eea;
                    font-size: 1.2rem;
                }

                .country-selector label {
                    color: #4a5568;
                    font-weight: 500;
                }

                .country-select {
                    padding: 0.5rem 1rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 30px;
                    background: white;
                    font-size: 0.95rem;
                    cursor: pointer;
                    flex: 1;
                }

                .pricing-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 2rem;
                    max-width: 1000px;
                    margin: 3rem auto;
                }

                .pricing-card {
                    background: white;
                    border-radius: 20px;
                    padding: 2rem;
                    position: relative;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                    transition: transform 0.3s;
                }

                .pricing-card:hover {
                    transform: translateY(-5px);
                }

                .pricing-card.premium {
                    border: 2px solid #667eea;
                    transform: scale(1.05);
                }

                .pricing-card.premium:hover {
                    transform: scale(1.05) translateY(-5px);
                }

                .popular-badge {
                    position: absolute;
                    top: -12px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #667eea;
                    color: white;
                    padding: 0.25rem 1rem;
                    border-radius: 30px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    white-space: nowrap;
                }

                .pricing-card-header {
                    text-align: center;
                    margin-bottom: 2rem;
                }

                .pricing-card-header h3 {
                    font-size: 1.5rem;
                    color: #2d3748;
                    margin-bottom: 1rem;
                }

                .price {
                    margin-bottom: 0.5rem;
                }

                .currency {
                    font-size: 1.5rem;
                    vertical-align: top;
                    color: #718096;
                }

                .amount {
                    font-size: 3rem;
                    font-weight: 800;
                    color: #2d3748;
                    line-height: 1;
                }

                .period {
                    font-size: 1rem;
                    color: #718096;
                }

                .pricing-card-features {
                    margin-bottom: 2rem;
                    min-height: 250px;
                }

                .feature {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 1rem;
                    color: #4a5568;
                }

                .check-icon {
                    color: #48bb78;
                    font-size: 1.1rem;
                    flex-shrink: 0;
                }

                .check-icon.premium {
                    color: #667eea;
                }

                .times-icon {
                    color: #f56565;
                    font-size: 1.1rem;
                    flex-shrink: 0;
                }

                .infinity-icon {
                    color: #667eea;
                    font-size: 1.1rem;
                    flex-shrink: 0;
                }

                .btn-block {
                    width: 100%;
                    padding: 0.75rem;
                    font-size: 1rem;
                }

                .comparison-section {
                    margin: 4rem 0;
                }

                .comparison-section h2 {
                    text-align: center;
                    font-size: 2rem;
                    color: #2d3748;
                    margin-bottom: 2rem;
                }

                .comparison-table {
                    overflow-x: auto;
                    background: white;
                    border-radius: 16px;
                    padding: 1rem;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                }

                .comparison-table table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .comparison-table th {
                    padding: 1rem;
                    text-align: left;
                    color: #2d3748;
                    font-weight: 600;
                    border-bottom: 2px solid #e2e8f0;
                }

                .comparison-table td {
                    padding: 1rem;
                    border-bottom: 1px solid #e2e8f0;
                    color: #4a5568;
                }

                .comparison-table tr:last-child td {
                    border-bottom: none;
                }

                .pricing-note {
                    text-align: center;
                    margin: 2rem 0;
                    padding: 1.5rem;
                    background: #ebf4ff;
                    border-radius: 12px;
                    color: #2d3748;
                }

                .pricing-faq {
                    margin: 4rem 0;
                }

                .pricing-faq h2 {
                    text-align: center;
                    font-size: 2rem;
                    color: #2d3748;
                    margin-bottom: 2rem;
                }

                .faq-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 2rem;
                }

                .faq-item {
                    background: white;
                    padding: 1.5rem;
                    border-radius: 12px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                .faq-item h3 {
                    color: #2d3748;
                    margin-bottom: 0.5rem;
                    font-size: 1.1rem;
                }

                .faq-item p {
                    color: #718096;
                    line-height: 1.6;
                }

                @media (max-width: 768px) {
                    .pricing-header h1 {
                        font-size: 2rem;
                    }

                    .role-selector {
                        flex-direction: column;
                        padding: 0 1rem;
                    }

                    .country-selector {
                        flex-direction: column;
                        border-radius: 20px;
                        padding: 1.5rem;
                    }

                    .pricing-grid {
                        grid-template-columns: 1fr;
                        padding: 0 1rem;
                    }

                    .pricing-card.premium {
                        transform: scale(1);
                    }

                    .pricing-card.premium:hover {
                        transform: translateY(-5px);
                    }

                    .faq-grid {
                        grid-template-columns: 1fr;
                        padding: 0 1rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default Pricing;