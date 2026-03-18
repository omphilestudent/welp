import React from 'react';

export default function CustomEmailTemplate({ props = {} }) {
    const subject = props.subject || 'Subject';
    const body = props.body_html || '<p>Body</p>';
    const placeholders = Array.isArray(props.placeholders) ? props.placeholders : [];
    const sendTest = props.send_test ? 'Test ready' : 'Test off';
    const draft = props.save_draft ? 'Draft saved' : 'Draft pending';

    return (
        <div className="email-template">
            <header>
                <strong>{subject}</strong>
                <span>{sendTest}</span>
            </header>
            <div className="email-body" dangerouslySetInnerHTML={{ __html: body }} />
            <footer>
                <p>{draft}</p>
                <div className="email-placeholders">
                    {placeholders.map((ph) => (
                        <span key={ph}>{ph}</span>
                    ))}
                </div>
            </footer>
        </div>
    );
}
