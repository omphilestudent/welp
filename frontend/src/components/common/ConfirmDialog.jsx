import React from 'react';
import Modal from './Modal';

const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'danger' }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="medium" className="app-confirm-modal">
            <p>{message}</p>
            <div className="form-actions" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={onClose}>{cancelText}</button>
                <button type="button" className={`btn ${type === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmText}</button>
            </div>
        </Modal>
    );
};

export default ConfirmDialog;
