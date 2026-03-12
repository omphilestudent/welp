
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CompanyCard from '../components/companies/CompanyCard';
import api from '../services/api';

const Home = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        const fetchCompanies = async () => {
            setLoading(true);
            try {
                const { data } = await api.get('/companies/search', { params: { limit: 12 } });
                setCompanies(data.companies || []);
            } catch (error) {
                console.error('Failed to load companies', error);
                setCompanies([]);
            } finally {
                setLoading(false);
            }
        };

        fetchCompanies();
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
        }
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading companies...</p>
            </div>
        );
    }

    return (
        <div className="home-page">
            {}
            <section className="hero-section">
                <div className="container">
                    <h1 className="hero-title">
                        Discover What It's Really Like to Work at
                        <span className="hero-subtitle"> Global Companies</span>
                    </h1>

                    <p className="hero-description">
                        Join millions of employees sharing honest reviews about the world's leading companies.
                    </p>

                    {}
                    <form onSubmit={handleSearch} className="hero-search">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search Google, Meta, Amazon, or any company..."
                            className="search-input"
                        />
                        <button type="submit" className="btn btn-primary">
                            Search
                        </button>
                    </form>

                    {}
                    <div className="popular-searches">
                        <span>Popular:</span>
                        {['Google', 'Meta', 'Amazon', 'Tesla'].map(company => (
                            <button
                                key={company}
                                onClick={() => {
                                    setSearchQuery(company);
                                    navigate(`/search?q=${company}`);
                                }}
                                className="popular-tag"
                            >
                                {company}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {}
            <section className="companies-section">
                <div className="container">
                    <h2 className="section-title">Featured Companies</h2>

                    <div className="companies-grid">
                        {companies.map(company => (
                            <CompanyCard
                                key={company.id}
                                company={company}
                            />
                        ))}
                    </div>

                    <div className="view-all-container">
                        <button
                            onClick={() => navigate('/search')}
                            className="btn btn-primary"
                        >
                            View All Companies
                        </button>
                    </div>
                </div>
            </section>

            {}
            <section className="cta-section">
                <div className="container">
                    <h2>Ready to Share Your Experience?</h2>
                    <p>Join thousands of employees making workplaces better.</p>
                    <div className="cta-buttons">
                        <button
                            onClick={() => navigate('/register')}
                            className="btn btn-primary"
                        >
                            Sign Up Free
                        </button>
                        <button
                            onClick={() => navigate('/login')}
                            className="btn btn-secondary"
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
