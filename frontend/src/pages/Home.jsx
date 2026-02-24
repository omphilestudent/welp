// frontend/src/pages/Home.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import CompanyCard from '../components/companies/CompanyCard';
import Loading from '../components/common/Loading';

const Home = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [trendingCompanies, setTrendingCompanies] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTrendingCompanies();
    }, []);

    const fetchTrendingCompanies = async () => {
        try {
            const { data } = await api.get('/companies/search', {
                params: { limit: 6, sort: 'rating' }
            });
            setTrendingCompanies(data.companies);
        } catch (error) {
            console.error('Failed to fetch trending companies:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
        }
    };

    if (loading) return <Loading />;

    return (
        <div className="home-page">
            {/* Hero Section */}
            <section className="hero-section">
                <div className="container">
                    <h1 className="hero-title">
                        Share Your Experience.
                        <span className="hero-subtitle">Improve Workplaces.</span>
                    </h1>
                    <p className="hero-description">
                        Welp is where employees safely review companies, businesses respond,
                        and psychologists help when needed. Your voice matters.
                    </p>

                    {/* Search Form */}
                    <form onSubmit={handleSearch} className="hero-search">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search for companies by name, industry, or location..."
                            className="search-input"
                        />
                        <button type="submit" className="btn btn-primary btn-large">
                            Search
                        </button>
                    </form>
                </div>
            </section>

            {/* Features Section */}
            <section className="features-section">
                <div className="container">
                    <h2 className="section-title">How Welp Works</h2>
                    <div className="features-grid">
                        <div className="feature-card">
                            <div className="feature-icon">📝</div>
                            <h3>Review Companies</h3>
                            <p>
                                Share your work experience anonymously or publicly.
                                Your honest feedback helps others.
                            </p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">💬</div>
                            <h3>Business Response</h3>
                            <p>
                                Companies can reply to reviews and improve their
                                workplace based on feedback.
                            </p>
                        </div>
                        <div className="feature-card">
                            <div className="feature-icon">🤝</div>
                            <h3>Wellbeing Support</h3>
                            <p>
                                Licensed psychologists can offer support when reviews
                                signal distress.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Trending Companies */}
            <section className="trending-section">
                <div className="container">
                    <h2 className="section-title">Trending Companies</h2>
                    <div className="companies-grid">
                        {trendingCompanies.map(company => (
                            <CompanyCard key={company.id} company={company} />
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section">
                <div className="container">
                    <h2>Ready to Share Your Experience?</h2>
                    <p>
                        Join thousands of employees making workplaces better,
                        one review at a time.
                    </p>
                    <div className="cta-buttons">
                        <button
                            onClick={() => navigate('/register')}
                            className="btn btn-primary btn-large"
                        >
                            Sign Up Free
                        </button>
                        <button
                            onClick={() => navigate('/login')}
                            className="btn btn-secondary btn-large"
                        >
                            Log In
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;