
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CompanyCard from '../components/companies/CompanyCard';

const Home = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);


    const globalCompanies = [
        {
            id: '1',
            name: 'Google',
            industry: 'Technology',
            location: 'Mountain View, CA, USA',
            description: 'Leading technology company specializing in internet services and products.',
            rating: 4.5,
            reviewCount: 15234,
            logo_url: 'https://logo.clearbit.com/google.com',
            is_claimed: true
        },
        {
            id: '2',
            name: 'DeepSeek AI',
            industry: 'Artificial Intelligence',
            location: 'Beijing, China',
            description: 'Cutting-edge AI research and development company.',
            rating: 4.8,
            reviewCount: 3456,
            logo_url: 'https://logo.clearbit.com/deepseek.com',
            is_claimed: true
        },
        {
            id: '3',
            name: 'Meta',
            industry: 'Social Media',
            location: 'Menlo Park, CA, USA',
            description: 'Building the metaverse and connecting people through technology.',
            rating: 4.2,
            reviewCount: 12456,
            logo_url: 'https://logo.clearbit.com/meta.com',
            is_claimed: true
        },
        {
            id: '4',
            name: 'Capitec Bank',
            industry: 'Banking & Finance',
            location: 'Stellenbosch, South Africa',
            description: 'South Africas leading digital bank.',
            rating: 4.3,
            reviewCount: 5678,
            logo_url: 'https://logo.clearbit.com/capitecbank.co.za',
            is_claimed: false
        },
        {
            id: '5',
            name: 'Standard Bank',
            industry: 'Banking & Finance',
            location: 'Johannesburg, South Africa',
            description: 'Africas largest bank by assets.',
            rating: 4.1,
            reviewCount: 7890,
            logo_url: 'https://logo.clearbit.com/standardbank.co.za',
            is_claimed: false
        },
        {
            id: '6',
            name: 'Apple Inc.',
            industry: 'Technology',
            location: 'Cupertino, CA, USA',
            description: 'Designing the worlds best consumer electronics.',
            rating: 4.7,
            reviewCount: 21345,
            logo_url: 'https://logo.clearbit.com/apple.com',
            is_claimed: true
        },
        {
            id: '7',
            name: 'Amazon',
            industry: 'E-commerce',
            location: 'Seattle, WA, USA',
            description: 'Earths most customer-centric company.',
            rating: 4.0,
            reviewCount: 32456,
            logo_url: 'https://logo.clearbit.com/amazon.com',
            is_claimed: true
        },
        {
            id: '8',
            name: 'Microsoft',
            industry: 'Technology',
            location: 'Redmond, WA, USA',
            description: 'Empowering every person and organization.',
            rating: 4.4,
            reviewCount: 18765,
            logo_url: 'https://logo.clearbit.com/microsoft.com',
            is_claimed: true
        },
        {
            id: '9',
            name: 'Tesla',
            industry: 'Automotive',
            location: 'Austin, TX, USA',
            description: 'Accelerating worlds transition to sustainable energy.',
            rating: 4.3,
            reviewCount: 15432,
            logo_url: 'https://logo.clearbit.com/tesla.com',
            is_claimed: true
        },
        {
            id: '10',
            name: 'Netflix',
            industry: 'Entertainment',
            location: 'Los Gatos, CA, USA',
            description: 'Leading streaming entertainment service.',
            rating: 4.2,
            reviewCount: 12345,
            logo_url: 'https://logo.clearbit.com/netflix.com',
            is_claimed: true
        },
        {
            id: '11',
            name: 'Spotify',
            industry: 'Music Streaming',
            location: 'Stockholm, Sweden',
            description: 'Worlds most popular audio streaming service.',
            rating: 4.3,
            reviewCount: 9876,
            logo_url: 'https://logo.clearbit.com/spotify.com',
            is_claimed: true
        },
        {
            id: '12',
            name: 'Airbnb',
            industry: 'Hospitality',
            location: 'San Francisco, CA, USA',
            description: 'Connecting travelers with unique accommodations.',
            rating: 4.1,
            reviewCount: 23456,
            logo_url: 'https://logo.clearbit.com/airbnb.com',
            is_claimed: true
        },
        {
            id: '13',
            name: 'Uber',
            industry: 'Transportation',
            location: 'San Francisco, CA, USA',
            description: 'Rethinking mobility through technology.',
            rating: 3.9,
            reviewCount: 34567,
            logo_url: 'https://logo.clearbit.com/uber.com',
            is_claimed: true
        },
        {
            id: '14',
            name: 'LinkedIn',
            industry: 'Professional Network',
            location: 'Sunnyvale, CA, USA',
            description: 'Worlds largest professional network.',
            rating: 4.2,
            reviewCount: 15678,
            logo_url: 'https://logo.clearbit.com/linkedin.com',
            is_claimed: true
        },
        {
            id: '15',
            name: 'Salesforce',
            industry: 'Cloud Computing',
            location: 'San Francisco, CA, USA',
            description: 'Customer relationship management platform.',
            rating: 4.3,
            reviewCount: 14567,
            logo_url: 'https://logo.clearbit.com/salesforce.com',
            is_claimed: true
        },
        {
            id: '16',
            name: 'Oracle',
            industry: 'Database Technology',
            location: 'Austin, TX, USA',
            description: 'Integrated cloud applications and services.',
            rating: 4.0,
            reviewCount: 11234,
            logo_url: 'https://logo.clearbit.com/oracle.com',
            is_claimed: true
        },
        {
            id: '17',
            name: 'IBM',
            industry: 'Technology',
            location: 'Armonk, NY, USA',
            description: 'Leading hybrid cloud and AI services.',
            rating: 4.1,
            reviewCount: 22345,
            logo_url: 'https://logo.clearbit.com/ibm.com',
            is_claimed: true
        },
        {
            id: '18',
            name: 'Intel',
            industry: 'Semiconductors',
            location: 'Santa Clara, CA, USA',
            description: 'Creating world-changing technology.',
            rating: 4.2,
            reviewCount: 13456,
            logo_url: 'https://logo.clearbit.com/intel.com',
            is_claimed: true
        },
        {
            id: '19',
            name: 'NVIDIA',
            industry: 'Semiconductors',
            location: 'Santa Clara, CA, USA',
            description: 'Pioneering accelerated computing and AI.',
            rating: 4.8,
            reviewCount: 17890,
            logo_url: 'https://logo.clearbit.com/nvidia.com',
            is_claimed: true
        },
        {
            id: '20',
            name: 'Adobe',
            industry: 'Software',
            location: 'San Jose, CA, USA',
            description: 'Changing the world through digital experiences.',
            rating: 4.4,
            reviewCount: 12345,
            logo_url: 'https://logo.clearbit.com/adobe.com',
            is_claimed: true
        }
    ];

    useEffect(() => {

        setTimeout(() => {
            setCompanies(globalCompanies);
            setLoading(false);
        }, 500);
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
