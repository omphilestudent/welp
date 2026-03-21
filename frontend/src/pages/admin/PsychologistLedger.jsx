import React, { useState } from 'react';
import api from '../../services/api';
import Loading from '../../components/common/Loading';

const formatMoney = (minor) => (Number(minor || 0) / 100).toFixed(2);

const PsychologistLedger = () => {
    const [accountNumber, setAccountNumber] = useState('');
    const [ledger, setLedger] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLookup = async (event) => {
        event.preventDefault();
        if (!accountNumber) return;
        setLoading(true);
        setError('');
        try {
            const { data } = await api.get(`/admin/ledger/lookup/${accountNumber}`);
            setLedger(data);
        } catch (err) {
            setLedger(null);
            setError(err?.response?.data?.error || 'Ledger lookup failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-page ledger-page">
            <div className="admin-page__header ledger-page__header">
                <div>
                    <h1>Account Ledger</h1>
                    <p>Lookup any user or business account by its 10-digit account number.</p>
                </div>
            </div>
            <form className="admin-form ledger-lookup" onSubmit={handleLookup}>
                <label>Account number</label>
                <div className="ledger-lookup__row">
                    <input
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="100xxxxxxx / 200xxxxxxx / 300xxxxxxx"
                    />
                    <button className="btn btn-primary" type="submit" disabled={loading}>Lookup</button>
                </div>
            </form>
            {loading && <Loading text="Loading ledger..." />}
            {error && <p className="error-message">{error}</p>}
            {ledger && (
                <div className="admin-card ledger-card">
                    <div className="ledger-card__header">
                        <div>
                            <h3>Account Details</h3>
                            <p>Account: {ledger.account?.account_number}</p>
                        </div>
                        <span className="ledger-card__badge">{ledger.account?.owner_type || 'account'}</span>
                    </div>
                    <div className="ledger-card__meta">
                        <div>
                            <strong>Name</strong>
                            <span>{ledger.owner?.display_name || ledger.owner?.name || '—'}</span>
                        </div>
                        <div>
                            <strong>Email</strong>
                            <span>{ledger.owner?.email || '—'}</span>
                        </div>
                        <div>
                            <strong>Role</strong>
                            <span>{ledger.owner?.role || ledger.account?.owner_type || '—'}</span>
                        </div>
                    </div>
                    <div className="admin-table ledger-table">
                        <table>
                            <thead>
                            <tr>
                                <th>Date</th>
                                <th>Amount</th>
                                <th>Currency</th>
                                <th>Status</th>
                            </tr>
                            </thead>
                            <tbody>
                            {(ledger.payments || []).length === 0 && (
                                <tr>
                                    <td colSpan="4">No payment records yet.</td>
                                </tr>
                            )}
                            {(ledger.payments || []).map((payment) => (
                                <tr key={payment.id}>
                                    <td>{new Date(payment.created_at).toLocaleDateString()}</td>
                                    <td>{formatMoney(payment.amount_minor)}</td>
                                    <td>{payment.currency_code}</td>
                                    <td>{payment.status}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PsychologistLedger;
