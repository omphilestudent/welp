import React from 'react';
import { FaHandshake, FaExclamationTriangle, FaClipboardCheck } from 'react-icons/fa';

const EmployeeRelations = () => {
    return (
        <div className="hr-page-content">
            <h1><FaHandshake /> Employee Relations</h1>
            <p>Log workplace concerns, manage follow-ups, and maintain fair, documented resolution workflows.</p>

            <div className="hr-page-cards">
                <article>
                    <h3><FaExclamationTriangle /> Case tracking</h3>
                    <p>
                        Capture issue type, priority, and status updates to keep every employee relations case auditable.
                    </p>
                </article>
                <article>
                    <h3><FaClipboardCheck /> Resolution quality</h3>
                    <p>
                        Track response timelines and outcomes so HR leaders can spot trends and improve policies.
                    </p>
                </article>
            </div>
        </div>
    );
};

export default EmployeeRelations;
