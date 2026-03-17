import React from 'react';
import './Legal.css';

const PsychologistCode = () => {
    return (
        <div className="legal-page">
            <div className="legal-container">
                <h1 className="legal-title">Psychologist Code of Conduct</h1>
                <p className="legal-updated">Last updated: March 17, 2026</p>

                <div className="legal-section">
                    <h2>1. Professional licensure and scope</h2>
                    <p>
                        You must hold valid, current licensure or certification in the jurisdictions where you
                        practice. You agree to practice only within your scope of competence and training.
                    </p>
                </div>

                <div className="legal-section">
                    <h2>2. Legal and regulatory compliance</h2>
                    <p>
                        You must comply with all applicable national and international laws, professional regulations,
                        and ethical standards that govern mental health practice and telehealth in your jurisdiction.
                    </p>
                    <ul>
                        <li>Follow licensing board requirements, reporting duties, and record‑keeping rules.</li>
                        <li>Comply with data protection and confidentiality laws that apply to your practice.</li>
                        <li>Respect client consent requirements and emergency protocols.</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>3. Client safety and wellbeing</h2>
                    <ul>
                        <li>Prioritize client safety and wellbeing above all platform considerations.</li>
                        <li>Provide clear informed consent, including limitations of services and confidentiality.</li>
                        <li>Maintain crisis and escalation procedures where required.</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>4. Confidentiality and data handling</h2>
                    <p>
                        You must keep client information confidential except where disclosure is required by law or
                        by a client’s explicit consent. Access only the data you need to provide services.
                    </p>
                </div>

                <div className="legal-section">
                    <h2>5. Professional conduct</h2>
                    <ul>
                        <li>Be respectful, non‑discriminatory, and culturally competent.</li>
                        <li>Avoid conflicts of interest and dual relationships.</li>
                        <li>Do not misrepresent credentials, outcomes, or services.</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>6. Quality and documentation</h2>
                    <ul>
                        <li>Maintain accurate records as required by applicable laws.</li>
                        <li>Engage in continuing professional development.</li>
                        <li>Use evidence‑based practices where appropriate.</li>
                    </ul>
                </div>

                <div className="legal-section">
                    <h2>7. Enforcement</h2>
                    <p>
                        Violations may result in suspension or termination of platform access and may be reported to
                        relevant regulatory bodies where required.
                    </p>
                </div>

                <div className="legal-section">
                    <h2>8. Questions</h2>
                    <p>If you are unsure about your obligations, contact support before providing services.</p>
                </div>
            </div>
        </div>
    );
};

export default PsychologistCode;
