import React, { useState } from 'react';

const AssignPageModal = ({ open, pages, onClose, onSubmit }) => {
    const [pageId, setPageId] = useState('');
    const [isDefault, setIsDefault] = useState(false);

    if (!open) return null;

    return (
        <div className="kodi-portal-modal">
            <div className="kodi-portal-modal__content">
                <div className="kodi-portal-modal__header">
                    <h2>Assign page</h2>
                    <button className="btn-text" onClick={onClose}>Close</button>
                </div>
                <label>
                    Page
                    <select value={pageId} onChange={(e) => setPageId(e.target.value)}>
                        <option value="">Select a page</option>
                        {pages.map((page) => (
                            <option key={page.id} value={page.id}>
                                {page.label} ({page.page_type})
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    <input type="checkbox" checked={isDefault} onChange={() => setIsDefault(!isDefault)} />
                    Set as default page
                </label>
                <button className="btn-primary" onClick={() => onSubmit({ pageId, isDefault })} disabled={!pageId}>
                    Assign page
                </button>
            </div>
        </div>
    );
};

export default AssignPageModal;
