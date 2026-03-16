import React from 'react';
import { FaTimes, FaShieldAlt } from 'react-icons/fa';
import { formatPlanPrice } from '../../utils/currency';

const UpgradeModal = ({ plan, open, onClose, onConfirm, submitting }) => {
    if (!open || !plan) return null;

    return (
        <div className="upgrade-modal__backdrop" onClick={onClose}>
            <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
                <header className="upgrade-modal__header">
                    <div>
                        <p>Confirm upgrade</p>
                        <h3>{plan.metadata?.displayName || plan.planCode}</h3>
                    </div>
                    <button type="button" onClick={onClose}>
                        <FaTimes />
                    </button>
                </header>

                <section className="upgrade-modal__body">
                    <div className="upgrade-modal__price">
                        <span>{formatPlanPrice(plan)}</span>
                        <small>/ {plan.billingPeriod || 'monthly'}</small>
                    </div>
                    <ul>
                        {plan.features?.map((feature) => (
                            <li key={feature}>
                                <FaShieldAlt /> {feature}
                            </li>
                        ))}
                    </ul>
                </section>

                <footer className="upgrade-modal__footer">
                    <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-primary"
                        disabled={submitting}
                        onClick={() => onConfirm?.(plan)}
                    >
                        {submitting ? 'Upgrading…' : 'Confirm upgrade'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default UpgradeModal;
