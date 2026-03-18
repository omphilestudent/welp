import React, { useState } from 'react';

const PAGE_TYPES = [
    { value: 'record', label: 'Record Page' },
    { value: 'app', label: 'App Page' },
    { value: 'home', label: 'Home Page' }
];

const CreatePageModal = ({ open, onClose, onSubmit }) => {
    const [form, setForm] = useState({ label: '', pageType: 'record' });

    if (!open) return null;

    const handleSubmit = (event) => {
        event.preventDefault();
        onSubmit(form);
    };

    return (
        <div className="kodi-modal">
            <div className="kodi-modal__content">
                <div className="kodi-modal__header">
                    <h3>Create Page</h3>
                    <button className="btn-text" onClick={onClose}>Close</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <label className="kodi-modal__field">
                        Label
                        <input
                            value={form.label}
                            onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
                        />
                    </label>
                    <label className="kodi-modal__field">
                        Page Type
                        <select
                            value={form.pageType}
                            onChange={(event) => setForm((prev) => ({ ...prev, pageType: event.target.value }))}
                        >
                            {PAGE_TYPES.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <button className="btn-primary" type="submit">
                        Create Page
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreatePageModal;
