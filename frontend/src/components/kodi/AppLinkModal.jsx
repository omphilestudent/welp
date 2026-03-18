import React from 'react';
import Loading from '../common/Loading';

const AppLinkModal = ({ open, apps = [], loading, selectedId, onSelect, onClose, onSubmit }) => {
    if (!open) return null;
    return (
        <div className="kodi-modal">
            <div className="kodi-modal__content">
                <div className="kodi-modal__header">
                    <h3>Link to App</h3>
                    <button className="btn-text" onClick={onClose}>Close</button>
                </div>
                {loading ? (
                    <Loading />
                ) : (
                    <label className="kodi-modal__field">
                        Select app
                        <select value={selectedId} onChange={(event) => onSelect(event.target.value)}>
                            <option value="">Select an app</option>
                            {apps.map((app) => (
                                <option key={app.id} value={app.id}>
                                    {app.name}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
                <button className="btn-primary" onClick={onSubmit} disabled={!selectedId}>
                    Link App
                </button>
            </div>
        </div>
    );
};

export default AppLinkModal;
