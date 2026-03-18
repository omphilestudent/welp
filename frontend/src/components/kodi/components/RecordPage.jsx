import React from 'react';
import './RecordPage.css';

const RecordPage = ({ props = {} }) => {
    const {
        client = {
            name: 'Jordan Smith',
            account: 'AC-124',
            phone: '+1 (555) 010-1010',
            email: 'jordan@example.com',
            status: 'VIP'
        },
        timeline = [
            'Last contact: Email - 8 mins ago',
            'Next follow-up: Demo Friday',
            'Notes: Referral from Anna'
        ],
        filters = ['Open', 'Prospect', 'VIP'],
        highlight = 'Priority client',
        quickMessage = 'Search across clients, cases, and documents.'
    } = props;

    return (
        <div className="kodi-record-page">
            <div className="kodi-record-page__sidebar">
                <div className="kodi-record-page__badge">{highlight}</div>
                <div className="kodi-record-page__details">
                    <h3>{client.name}</h3>
                    <p>{client.account}</p>
                    <p>{client.email}</p>
                    <p>Phone: {client.phone}</p>
                    <p>Status: {client.status}</p>
                </div>
                <div className="kodi-record-page__filters">
                    {filters.map((filter) => (
                        <span key={filter}>{filter}</span>
                    ))}
                </div>
            </div>
            <div className="kodi-record-page__main">
                <div className="kodi-record-page__search">
                    <input type="text" placeholder="Search client records..." readOnly value="" />
                    <button type="button">Search</button>
                </div>
                <p className="kodi-record-page__hint">{quickMessage}</p>
                <div className="kodi-record-page__timeline">
                    {timeline.map((item) => (
                        <div key={item} className="kodi-record-page__timeline-item">
                            {item}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default RecordPage;
