import React from 'react';

export default function ModalPopup({ props = {} }) {
    const title = props.title || 'Modal title';
    const contentComponent = props.content_component || 'Component';
    const size = props.size || 'medium';
    const closable = props.closable !== false;
    const trigger = props.trigger || 'button';

    return (
        <div className={`modal-popup modal-${size}`}>
            <div className="modal-title">
                <strong>{title}</strong>
                {closable && <span className="modal-close">×</span>}
            </div>
            <p className="modal-subtitle">Trigger: {trigger}</p>
            <div className="modal-content">
                <p>{`Rendering ${contentComponent}`}</p>
            </div>
        </div>
    );
}
