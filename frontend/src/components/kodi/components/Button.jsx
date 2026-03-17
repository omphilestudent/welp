import React from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';

export default function Button({ props = {}, events = {} }) {
    const navigate = useNavigate();
    const label = props.label || 'Button';
    const variant = props.variant || 'primary';

    const onClick = async () => {
        if (props.triggerEvent && typeof events?.emit === 'function') {
            events.emit(props.triggerEvent, props.eventPayload || {});
        }

        if (props.navigateTo) {
            navigate(props.navigateTo);
        }

        if (props.apiEndpoint) {
            const method = String(props.method || 'post').toLowerCase();
            const payload = props.payload || {};
            await api.request({ url: props.apiEndpoint, method, data: payload });
        }
    };

    return (
        <button
            type="button"
            className={`btn ${variant === 'secondary' ? 'btn-secondary' : 'btn-primary'}`}
            onClick={onClick}
        >
            {label}
        </button>
    );
}

export const config = {
    name: 'Button',
    props: [
        { name: 'label', type: 'string' },
        { name: 'variant', type: 'string' },
        { name: 'navigateTo', type: 'string' },
        { name: 'apiEndpoint', type: 'string' },
        { name: 'method', type: 'string' },
        { name: 'payload', type: 'object' },
        { name: 'triggerEvent', type: 'string' },
        { name: 'eventPayload', type: 'object' }
    ],
    editable: true
};

