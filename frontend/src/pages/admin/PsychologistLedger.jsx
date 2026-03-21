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
            const { data } = await api.post('/admin/psychologist-ledger/lookup', { accountNumber });
            setLedger(data);
        } catch (err) {
            setLedger(null);
            setError(err?.response?.data?.error || 'Ledger lookup failed');
        } finally {
            setLoading(false);
        }
    };

    const handleMarkPaid = async (paymentId) => {
        if (!paymentId) return;
        setLoading(true);
        try {
            const { data } = await api.patch(`/admin/psychologist-ledger/payouts/${paymentId}`);
            const nextPayments = (ledger?.payments || []).map((payment) => (
                payment.id === paymentId ? data.payment : payment
            ));
            setLedger({ ...ledger, payments: nextPayments });
        } catch (err) {
            setError(err?.response?.data?.error || 'Failed to update payout status');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-page">
            <div className="admin-page__header">
                <h1>Psychologist Ledger</h1>
                <p>Lookup ledger by payout account number.</p>
            </div>
            <form className="admin-form" onSubmit={handleLookup}>
                <label>Account number</label>
                <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Enter account number" />
                <button className="btn btn-primary" type="submit" disabled={loading}>Lookup</button>
            </form>
            {loading && <Loading text="Loading ledger..." />}
            {error && <p className="error-message">{error}</p>}
            {ledger && (
                <div className="admin-card">
                    <h3>Account</h3>
                    <p><strong>Account:</strong> {ledger.account?.account_number}</p>
                    <p><strong>Holder:</strong> {ledger.account?.account_holder || '—'}</p>
                    <p><strong>Bank:</strong> {ledger.account?.bank_name || '—'}</p>
                    <div className="admin-card__totals">
                        <span>Gross: {formatMoney(ledger.totals?.grossMinor)}</span>
                        <span>Fees: {formatMoney(ledger.totals?.feeMinor)}</span>
                        <span>Net: {formatMoney(ledger.totals?.netMinor)}</span>
                        <span>Unpaid: {formatMoney(ledger.totals?.unpaidMinor)}</span>
                    </div>
                    <div className="admin-table">
                        <table>
                            <thead>
                            <tr>
                                <th>Date</th>
                                <th>Base</th>
                                <th>Fee</th>
                                <th>Total</th>
                                <th>Payout</th>
                                <th>Action</th>
                            </tr>
                            </thead>
                            <tbody>
                            {(ledger.payments || []).map((payment) => (
                                <tr key={payment.id}>
                                    <td>{new Date(payment.paid_at || payment.created_at).toLocaleDateString()}</td>
                                    <td>{formatMoney(payment.base_amount_minor)}</td>
                                    <td>{formatMoney(payment.welp_fee_minor)}</td>
                                    <td>{formatMoney(payment.total_amount_minor)}</td>
                                    <td>{payment.payout_status}</td>
                                    <td>
                                        {payment.payout_status !== 'paid' && (
                                            <button className="btn btn-outline btn-small" onClick={() => handleMarkPaid(payment.id)}>
                                                Mark paid
                                            </button>
                                        )}
                                    </td>
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
