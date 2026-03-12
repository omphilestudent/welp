
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

    const hardcodedCountries = [
        { code: 'US', name: 'United States', currency: 'USD', symbol: '$' },
        { code: 'GB', name: 'United Kingdom', currency: 'GBP', symbol: '£' },
        { code: 'CA', name: 'Canada', currency: 'CAD', symbol: 'C$' },
        { code: 'AU', name: 'Australia', currency: 'AUD', symbol: 'A$' },
        { code: 'DE', name: 'Germany', currency: 'EUR', symbol: '€' },
        { code: 'FR', name: 'France', currency: 'EUR', symbol: '€' },
        { code: 'ZA', name: 'South Africa', currency: 'ZAR', symbol: 'R' },
        { code: 'NG', name: 'Nigeria', currency: 'NGN', symbol: '₦' },
        { code: 'KE', name: 'Kenya', currency: 'KES', symbol: 'KSh' },
        { code: 'IN', name: 'India', currency: 'INR', symbol: '₹' },
        { code: 'JP', name: 'Japan', currency: 'JPY', symbol: '¥' },
        { code: 'CN', name: 'China', currency: 'CNY', symbol: '¥' },
        { code: 'BR', name: 'Brazil', currency: 'BRL', symbol: 'R$' },
        { code: 'AE', name: 'UAE', currency: 'AED', symbol: 'د.إ' }
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
            setCountries(data.length ? data : hardcodedCountries);
        } catch (error) {
            console.error('Failed to fetch countries, using hardcoded:', error);
            setCountries(hardcodedCountries);
        }
    };

    const fetchPricing = async () => {
        setLoading(true);
        try {
            console.log('Fetching pricing for:', selectedRole, selectedCountry);
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
        const planData = pricing?.[plan];
        const amount = planData?.price || 0;
        const currency = planData?.currency || 'ZAR';
        const symbol = planData?.symbol || 'R';

        toast.success(`Selected ${plan} plan for ${selectedRole}s in ${country} - ${symbol} ${amount}/month`);
    };

    if (loading) return <Loading />;

    return (
        <div className="pricing-page">
            <div className="pricing-header">
                <div className="container">
                    <h1>Simple, Transparent Pricing</h1>
                    <p>Choose the plan that fits your needs</p>
                </div>
            </div>

            <div className="container">
                {}
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

                {}
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
                                {country.name} ({country.currency} {country.symbol})
                            </option>
                        ))}
                    </select>
                </div>

                {}
                {pricing && (
                    <div className="pricing-grid">
                        {}
                        <div className="pricing-card free">
                            <div className="pricing-card-header">
                                <h3>{pricing.free?.name || 'Free Plan'}</h3>
                                <div className="price">
                                    <span className="currency">{pricing.free?.symbol || pricing.free?.currency || 'R'}</span>
                                    <span className="amount">{
                                        pricing.free?.price === 0 ? '0' : pricing.free?.price?.toFixed(2) || '0'
                                    }</span>
                                    <span className="period">/month</span>
                                </div>
                            </div>

                            <div className="pricing-card-features">
                                {pricing.free?.features?.map((feature, index) => (
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

                        {}
                        {pricing.premium && (
                            <div className="pricing-card premium">
                                <div className="popular-badge">Most Popular</div>
                                <div className="pricing-card-header">
                                    <h3>{pricing.premium?.name || 'Premium Plan'}</h3>
                                    <div className="price">
                                        <span className="currency">{pricing.premium?.symbol || pricing.premium?.currency || 'R'}</span>
                                        <span className="amount">{pricing.premium?.price?.toFixed(2) || '0.00'}</span>
                                        <span className="period">/month</span>
                                    </div>
                                    {pricing.premium?.originalPriceUSD && (
                                        <div className="price-note">
                                            (was ${pricing.premium.originalPriceUSD} USD)
                                        </div>
                                    )}
                                </div>

                                <div className="pricing-card-features">
                                    {pricing.premium?.features?.map((feature, index) => (
                                        <div key={index} className="feature">
                                            {feature.includes('Everything') ? (
                                                <FaCrown className="crown-icon" />
                                            ) : (
                                                <FaCheckCircle className="check-icon premium" />
                                            )}
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

                {}
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
                                    <td><strong>Monthly Price</strong></td>
                                    <td><strong>Free</strong></td>
                                    <td><strong>{pricing?.premium?.symbol || 'R'} {pricing?.premium?.price?.toFixed(2) || '0.00'}/month</strong></td>
                                </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {}
                <section className="pricing-faq">
                    <h2>Frequently Asked Questions</h2>
                    <div className="faq-grid">
                        <div className="faq-item">
                            <h3>What does Welp offer?</h3>
                            <p>Welp helps employees review workplaces, access wellbeing support, and connect with psychologists, while giving businesses insights to improve culture and support.</p>
                        </div>
                        <div className="faq-item">
                            <h3>Is there a free option?</h3>
                            <p>Yes. The free plan lets employees browse company profiles and reviews, and access limited chat and video sessions. It is designed for individual, personal use.</p>
                        </div>
                        <div className="faq-item">
                            <h3>What is included in Premium?</h3>
                            <p>Premium adds extended chat and video time, priority response, and more consistent support. Plan details may vary by country.</p>
                        </div>
                        <div className="faq-item">
                            <h3>How do psychologists work on Welp?</h3>
                            <p>Psychologists are verified professionals who receive requests, accept sessions, and provide confidential support through chat or video.</p>
                        </div>
                        <div className="faq-item">
                            <h3>How are employee profiles handled?</h3>
                            <p>Employee profiles let users participate in reviews and sessions. Personal data is protected, and reviews can be posted anonymously.</p>
                        </div>
                        <div className="faq-item">
                            <h3>Can a business subscribe?</h3>
                            <p>Yes. Businesses can subscribe to unlock analytics, sentiment insights, and tools to manage and improve their public profile.</p>
                        </div>
                        <div className="faq-item">
                            <h3>How are subscriptions billed?</h3>
                            <p>Subscriptions are billed monthly in your selected currency. You can upgrade or downgrade at any time.</p>
                        </div>
                        <div className="faq-item">
                            <h3>Do free users get access to psychologists?</h3>
                            <p>Free users can access limited support. Premium plans include more time and priority availability.</p>
                        </div>
                    </div>
                </section>

                <div className="pricing-note">
                    <p>✨ Prices are adjusted based on your country's economic factors to ensure fair access worldwide.</p>
                    <p>Selected country: {countries.find(c => c.code === selectedCountry)?.name}
                        ({countries.find(c => c.code === selectedCountry)?.currency} {countries.find(c => c.code === selectedCountry)?.symbol})</p>
                </div>
            </div>

            <style>{`
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
                    flex-wrap: wrap;
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
                    flex-wrap: wrap;
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
                    min-width: 200px;
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

                .price-note {
                    font-size: 0.85rem;
                    color: #718096;
                    font-style: italic;
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

                .crown-icon {
                    color: #fbbf24;
                    font-size: 1.1rem;
                    flex-shrink: 0;
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

                .pricing-note {
                    text-align: center;
                    margin: 2rem 0;
                    padding: 1.5rem;
                    background: #ebf4ff;
                    border-radius: 12px;
                    color: #2d3748;
                }

                @media (max-width: 768px) {
                    .pricing-header h1 {
                        font-size: 2rem;
                    }

                    .pricing-grid {
                        grid-template-columns: 1fr;
                        padding: 0 1rem;
                    }

                    .role-selector {
                        flex-direction: column;
                        padding: 0 1rem;
                    }

                    .role-btn {
                        width: 100%;
                        justify-content: center;
                    }

                    .country-selector {
                        flex-direction: column;
                        border-radius: 20px;
                    }

                    .country-select {
                        width: 100%;
                    }
                }
            `}</style>
        </div>
    );
};

export default Pricing;
