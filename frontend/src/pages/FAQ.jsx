import React from 'react';

const FAQ = () => {
    return (
        <div className="pricing-page">
            <div className="pricing-header">
                <div className="container">
                    <h1>Frequently Asked Questions</h1>
                    <p>Everything you need to know about Welp</p>
                </div>
            </div>

            <div className="container">
                <section className="pricing-faq">
                    <h2>Services and Subscriptions</h2>
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
                            <h3>How are subscriptions billed?</h3>
                            <p>Subscriptions are billed monthly in your selected currency. You can upgrade or downgrade at any time.</p>
                        </div>
                        <div className="faq-item">
                            <h3>Can a business subscribe?</h3>
                            <p>Yes. Businesses can subscribe to unlock analytics, sentiment insights, and tools to manage and improve their public profile.</p>
                        </div>
                    </div>
                </section>

                <section className="pricing-faq">
                    <h2>Psychologists and Employee Profiles</h2>
                    <div className="faq-grid">
                        <div className="faq-item">
                            <h3>How do psychologists work on Welp?</h3>
                            <p>Psychologists are verified professionals who receive requests, accept sessions, and provide confidential support through chat or video.</p>
                        </div>
                        <div className="faq-item">
                            <h3>Do free users get access to psychologists?</h3>
                            <p>Free users can access limited support. Premium plans include more time and priority availability.</p>
                        </div>
                        <div className="faq-item">
                            <h3>How are employee profiles handled?</h3>
                            <p>Employee profiles let users participate in reviews and sessions. Personal data is protected, and reviews can be posted anonymously.</p>
                        </div>
                        <div className="faq-item">
                            <h3>Are profiles public?</h3>
                            <p>Profiles are private by default. Only required details are shown where needed, and employees can choose to post reviews anonymously.</p>
                        </div>
                        <div className="faq-item">
                            <h3>How do businesses see employee feedback?</h3>
                            <p>Businesses see aggregated feedback and analytics to protect individual privacy while still giving actionable insights.</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default FAQ;
