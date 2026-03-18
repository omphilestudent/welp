import React from 'react';

export default function KYCStatusWidget({ props = {} }) {
    const userId = props.user_id || 'user-000';
    const status = props.kyc_status || 'pending';
    const document = props.document_submitted ? 'Submitted' : 'Missing';
    const alert = props.action_required || 'Review documents';
    const alertLevel = props.alert_level || 'info';

    return (
        <div className={`kyc-widget kyc-${alertLevel}`}>
            <div className="kyc-row">
                <strong>User</strong>
                <span>{userId}</span>
            </div>
            <div className="kyc-row">
                <strong>Status</strong>
                <span>{status}</span>
            </div>
            <div className="kyc-row">
                <strong>Document</strong>
                <span>{document}</span>
            </div>
            <div className="kyc-row">
                <strong>Action</strong>
                <span>{alert}</span>
            </div>
        </div>
    );
}
