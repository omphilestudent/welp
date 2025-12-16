import React from 'react';
import './Hero.css';
import heroImage from '../assets/hero.png';

const Hero = () => {
    return (
        <section
            className="hero"
            style={{
                backgroundImage: `url(${heroImage})`,
                backgroundColor: '#0f172a',
                width: '100%'
            }}
        >
            <div className="hero-content">
                <div className="hero-text">
                    <h1 className="hero-title">
                        Find Your Perfect Employer Match
                    </h1>
                    <p className="hero-subtitle">
                        Discover verified reviews, compare services, and make informed decisions
                        for your next employer.
                    </p>
                    <div className="hero-buttons">
                        <button className="hero-button primary">
                            Start Exploring
                        </button>
                        <button className="hero-button secondary">
                            Learn More
                        </button>
                    </div>
                </div>
                <div className="hero-stats">
                    <div className="stat-item">
                        <h3>10,000+</h3>
                        <p>Businesses Listed</p>
                    </div>
                    <div className="stat-item">
                        <h3>500K+</h3>
                        <p>Verified Reviews</p>
                    </div>
                    <div className="stat-item">
                        <h3>98%</h3>
                        <p>User Satisfaction</p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;