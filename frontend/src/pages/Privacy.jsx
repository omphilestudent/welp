import React from 'react';
import './Legal.css';

const Privacy = () => {
    return (
        <div className="legal-page">
            <div className="legal-container">
                <h1 className="legal-title">Privacy Policy</h1>
                <p className="legal-updated">Last updated: March 17, 2026</p>

                <div className="legal-section">
                    <h2>1. What we collect</h2>
                    <ul>
                        <li>Account data (name, email, role, login credentials).</li>
                        <li>Profile data you provide (professional details, business details).</li>
                        <li>Usage data (logs, diagnostics, device/browser metadata).</li>
                        <li>Content you submit (messages, reviews, documents).</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>2. How we use data</h2>
                    <ul>
                        <li>To provide and improve the service.</li>
                        <li>To verify accounts and applications.</li>
                        <li>To maintain security, prevent fraud, and enforce policies.</li>
                        <li>To communicate service updates and support.</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>3. Sensitive data</h2>
                    <p>
                        If you submit sensitive or clinical information, you confirm you have the right to do so and
                        have obtained the required consents. We treat sensitive data with heightened protection and
                        access controls.
                    </p>
                </div>

                <div className="legal-section">
                    <h2>4. Data sharing</h2>
                    <p>
                        We do not sell personal data. We may share data with vetted service providers only as needed
                        to deliver the platform (hosting, analytics, email delivery), or when legally required.
                    </p>
                </div>

                <div className="legal-section">
                    <h2>5. Your rights</h2>
                    <p>
                        Depending on your jurisdiction, you may have rights to access, correct, delete, or export
                        your personal data. Contact support to request these actions.
                    </p>
                </div>

                <div className="legal-section">
                    <h2>6. International compliance</h2>
                    <p>
                        Welp aims to comply with applicable data protection laws. If you are subject to specific
                        regulations (e.g., HIPAA, GDPR, POPIA), you are responsible for using Welp in a way that
                        meets your obligations under those laws.
                    </p>
                </div>

                <div className="legal-section">
                    <h2>7. Data retention</h2>
                    <p>
                        We retain data only as long as needed for the purposes described here or as required by law.
                    </p>
                </div>

                <div className="legal-section">
                    <h2>8. Security</h2>
                    <p>
                        We implement technical and organizational measures to protect data. No system is 100% secure,
                        so please use strong passwords and keep your credentials private.
                    </p>
                </div>

                <div className="legal-section">
                    <h2>9. Contact</h2>
                    <p>For privacy inquiries, contact support via the Welp help center.</p>
                </div>
            </div>
        </div>
    );
};

export default Privacy;
