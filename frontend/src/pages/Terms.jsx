import React from 'react';
import './Legal.css';

const Terms = () => {
    return (
        <div className="legal-page">
            <div className="legal-container">
                <h1 className="legal-title">Terms of Service</h1>
                <p className="legal-updated">Last updated: March 17, 2026</p>

                <div className="legal-section">
                    <h2>1. Overview</h2>
                    <p>
                        These Terms govern your access to and use of Welp’s platforms, services, and content.
                        By using Welp, you agree to these Terms and to any additional policies linked here.
                    </p>
                    <p className="legal-callout">
                        This document is written in clear language for readability. If any part is unclear, contact us
                        before using the service.
                    </p>
                </div>

                <div className="legal-section">
                    <h2>2. Who can use Welp</h2>
                    <p>You must be at least 18 years old and able to form a legal contract.</p>
                    <p>
                        If you are using Welp on behalf of an organization, you confirm you have the authority to bind
                        that organization to these Terms.
                    </p>
                </div>

                <div className="legal-section">
                    <h2>3. Professional services disclaimer</h2>
                    <p>
                        Welp provides a platform for communication and workflow. It does not provide clinical,
                        medical, legal, or financial advice. Psychologists and professionals are solely responsible
                        for their services, decisions, and compliance obligations.
                    </p>
                </div>

                <div className="legal-section">
                    <h2>4. Accounts and security</h2>
                    <ul>
                        <li>You are responsible for safeguarding your credentials and any activity on your account.</li>
                        <li>Do not share your password or impersonate others.</li>
                        <li>Notify us immediately if you suspect unauthorized access.</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>5. Acceptable use</h2>
                    <ul>
                        <li>Do not use Welp for illegal, harmful, or fraudulent activity.</li>
                        <li>Do not upload malicious code or attempt to bypass security controls.</li>
                        <li>Do not harass or threaten other users or staff.</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>6. Content and data</h2>
                    <p>
                        You retain ownership of the content you submit. You grant Welp a limited license to host,
                        process, and display your content to operate the service.
                    </p>
                    <p>
                        You are responsible for ensuring you have the rights to submit any content, including
                        confidential or sensitive information.
                    </p>
                </div>

                <div className="legal-section">
                    <h2>7. Compliance with laws</h2>
                    <p>
                        You agree to comply with all applicable local, national, and international laws and
                        professional standards relevant to your use of Welp. This includes data protection laws
                        and professional licensing requirements where applicable.
                    </p>
                </div>

                <div className="legal-section">
                    <h2>8. Suspension and termination</h2>
                    <p>
                        We may suspend or terminate access if you violate these Terms, misuse the service, or pose
                        a risk to other users or the platform.
                    </p>
                </div>

                <div className="legal-section">
                    <h2>9. Changes to the service</h2>
                    <p>
                        We may update the service and these Terms from time to time. We will post changes with an
                        updated date. Continued use indicates acceptance.
                    </p>
                </div>

                <div className="legal-section">
                    <h2>10. Contact</h2>
                    <p>If you have questions about these Terms, contact support via the Welp help center.</p>
                </div>
            </div>
        </div>
    );
};

export default Terms;
