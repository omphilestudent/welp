import React from 'react';
import './Modal.css';

const Modal = ({ isOpen, onClose, title, children, size = 'medium', className = '' }) => {
    if (!isOpen) return null;

    return (
        <div className="app-modal-overlay" onClick={onClose} role="presentation">
            <div className={`app-modal app-modal--${size} ${className}`.trim()} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="app-modal__header">
                    <h3>{title}</h3>
                    <button type="button" className="app-modal__close" onClick={onClose} aria-label="Close modal">×</button>
                </div>
                <div className="app-modal__body">{children}</div>
            </div>
        </div>
    );
};

export default Modal;
