import React, { useState } from 'react';
import api from '../../../services/api';

export default function FormBuilder({ props = {} }) {
    const fields = Array.isArray(props.fields) ? props.fields : [];
    const [values, setValues] = useState({});
    const [submitting, setSubmitting] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!props.apiEndpoint) return;
        setSubmitting(true);
        try {
            const method = String(props.method || 'post').toLowerCase();
            await api.request({ url: props.apiEndpoint, method, data: values });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form className="kodi-comp kodi-form" onSubmit={submit}>
            <div className="kodi-form__title">{props.title || 'Form'}</div>
            {fields.map((f) => (
                <label key={f.name} className="kodi-form__field">
                    <span>{f.label || f.name}</span>
                    {f.type === 'select' ? (
                        <select
                            className="kodi-input"
                            value={values[f.name] || ''}
                            onChange={(e) => setValues((p) => ({ ...p, [f.name]: e.target.value }))}
                        >
                            <option value="">Select…</option>
                            {(f.options || []).map((o) => (
                                <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            className="kodi-input"
                            type={f.type === 'file' ? 'file' : 'text'}
                            onChange={(e) => {
                                const value = f.type === 'file' ? e.target.files?.[0] : e.target.value;
                                setValues((p) => ({ ...p, [f.name]: value }));
                            }}
                        />
                    )}
                </label>
            ))}
            <div className="kodi-form__actions">
                <button className="btn btn-primary" disabled={submitting} type="submit">
                    {submitting ? 'Submitting…' : (props.submitLabel || 'Submit')}
                </button>
            </div>
        </form>
    );
}

export const config = {
    name: 'FormBuilder',
    props: [
        { name: 'title', type: 'string' },
        { name: 'fields', type: 'array', required: true },
        { name: 'apiEndpoint', type: 'string' },
        { name: 'method', type: 'string' },
        { name: 'submitLabel', type: 'string' }
    ],
    editable: true
};

