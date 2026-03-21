import React from 'react';

export default function ModalPopup({ props = {} }) {
    const title = props.title || 'Modal title';
    const contentComponent = props.content_component || 'Component';
    const size = props.size || 'medium';
    const closable = props.closable !== false;
    const trigger = props.trigger || 'button';

    return (
        <div className={`kodi-modal-popup kodi-modal-popup--${size}`}>
            <div className="kodi-modal-popup__title">
                <strong>{title}</strong>
                {closable && <span className="kodi-modal-popup__close">×</span>}
            </div>
            <p className="kodi-modal-popup__subtitle">Trigger: {trigger}</p>
            <div className="kodi-modal-popup__content">
                <p>{`Rendering ${contentComponent}`}</p>
            </div>
        </div>
    );
}
