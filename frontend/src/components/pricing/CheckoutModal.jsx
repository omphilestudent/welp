import React, { useMemo, useState } from 'react';
import { formatPlanPrice } from '../../utils/currency';

const PAYMENT_OPTIONS = [
    { id: 'card', label: 'Card (Visa / Mastercard)' },
    { id: 'wallet', label: 'Wallet (Apple Pay / Google Pay)' },
    { id: 'bank', label: 'Instant EFT / Bank Transfer' }
];

const CheckoutModal = ({ plan, open, onClose, onConfirm, submitting }) => {
    const [method, setMethod] = useState('card');

    const summary = useMemo(() => {
        if (!plan) return null;
        return {
            name: plan.metadata?.displayName || plan.planCode,
            billing: plan.billingPeriod || 'monthly',
            price: formatPlanPrice(plan)
        };
    }, [plan]);

    if (!open || !plan || !summary) return null;

    return (
        <div className="payment-modal" onClick={onClose}>
            <div className="payment-modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Checkout</h2>

                <div className="payment-summary">
                    <h3>Order summary</h3>
                    <div className="summary-item">
                        <span>Plan</span>
                        <span>{summary.name}</span>
                    </div>
                    <div className="summary-item">
                        <span>Billing</span>
                        <span>{summary.billing}</span>
                    </div>
                    <div className="summary-item total">
                        <span>Total</span>
                        <span>{summary.price}</span>
                    </div>
                </div>

                <div className="payment-methods">
                    <h3>Payment method</h3>
                    <div className="payment-options">
                        {PAYMENT_OPTIONS.map((option) => (
                            <label key={option.id} className="payment-option">
                                <input
                                    type="radio"
                                    name="payment-method"
                                    value={option.id}
                                    checked={method === option.id}
                                    onChange={() => setMethod(option.id)}
                                />
                                <span>{option.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="payment-actions">
                    <button className="btn-secondary" type="button" onClick={onClose} disabled={submitting}>
                        Cancel
                    </button>
                    <button
                        className="btn-primary"
                        type="button"
                        onClick={() => onConfirm?.(plan, method)}
                        disabled={submitting}
                    >
                        {submitting ? 'Processing…' : 'Pay & Upgrade'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CheckoutModal;
