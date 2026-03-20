import React, { useMemo, useState } from 'react';
import api from '../../services/api';

const UtilityBar = ({ utilities = [], data = {}, pageId, appId }) => {
    const [active, setActive] = useState(null);
    const [noteBody, setNoteBody] = useState('');
    const [linkLabel, setLinkLabel] = useState('');
    const [linkUrl, setLinkUrl] = useState('');

    const enabledUtilities = useMemo(
        () => (utilities || []).filter((utility) => utility.is_enabled !== false),
        [utilities]
    );

    const activeUtility = enabledUtilities.find((util) => util.utility_key === active) || null;

    const handleToggle = (key) => {
        setActive((prev) => (prev === key ? null : key));
    };

    const handleAddNote = async () => {
        if (!noteBody.trim()) return;
        await api.post(`/kodi/platform/runtime/${pageId}/notes`, { body: noteBody.trim() }, { params: { appId } });
        window.location.reload();
    };

    const handleAddLink = async () => {
        if (!linkLabel.trim() || !linkUrl.trim()) return;
        await api.post(`/kodi/platform/runtime/${pageId}/links`, { label: linkLabel.trim(), url: linkUrl.trim() }, { params: { appId } });
        window.location.reload();
    };

    return (
        <>
            {activeUtility && (
                <div className="kodi-utility-panel">
                    <div className="kodi-utility-panel__header">
                        <div>
                            <span>{activeUtility.label}</span>
                        </div>
                        <button type="button" onClick={() => setActive(null)}>—</button>
                    </div>
                    <div className="kodi-utility-panel__body">
                        {activeUtility.utility_key === 'notes' && (
                            <div className="kodi-utility-notes">
                                <textarea
                                    rows={3}
                                    value={noteBody}
                                    placeholder="Add a note..."
                                    onChange={(event) => setNoteBody(event.target.value)}
                                />
                                <button type="button" onClick={handleAddNote}>Save Note</button>
                                <ul>
                                    {(data.notes || []).map((note) => (
                                        <li key={note.id}>
                                            <p>{note.body}</p>
                                            <span>{note.author || 'System'}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {activeUtility.utility_key === 'history' && (
                            <div className="kodi-utility-list">
                                {(data.activity || []).map((item) => (
                                    <div key={item.id} className="kodi-utility-row">
                                        <strong>{item.title}</strong>
                                        <span>{item.meta}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {activeUtility.utility_key === 'recent_items' && (
                            <div className="kodi-utility-list">
                                {(data.recent || []).map((item) => (
                                    <div key={item.id} className="kodi-utility-row">
                                        <strong>{item.label || item.object_name}</strong>
                                        <span>{item.visited_at}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {activeUtility.utility_key === 'captured_links' && (
                            <div className="kodi-utility-links">
                                <div className="kodi-utility-links__form">
                                    <input
                                        type="text"
                                        placeholder="Label"
                                        value={linkLabel}
                                        onChange={(event) => setLinkLabel(event.target.value)}
                                    />
                                    <input
                                        type="text"
                                        placeholder="https://"
                                        value={linkUrl}
                                        onChange={(event) => setLinkUrl(event.target.value)}
                                    />
                                    <button type="button" onClick={handleAddLink}>Save Link</button>
                                </div>
                                <ul>
                                    {(data.links || []).map((link) => (
                                        <li key={link.id}>
                                            <a href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {activeUtility.utility_key === 'chat_bot' && (
                            <div className="kodi-utility-chat">
                                <p>Chat bot coming online…</p>
                                <button type="button">Start conversation</button>
                            </div>
                        )}
                        {activeUtility.utility_key === 'omni_channel' && (
                            <div className="kodi-utility-presence">
                                <p>Status: Offline</p>
                                <button type="button">Go Online</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div className="kodi-utility-bar">
                {enabledUtilities.map((utility) => (
                    <button
                        key={utility.utility_key}
                        type="button"
                        className={active === utility.utility_key ? 'active' : ''}
                        onClick={() => handleToggle(utility.utility_key)}
                    >
                        <span className="kodi-utility-icon">{utility.icon || '•'}</span>
                        {utility.label}
                    </button>
                ))}
            </div>
        </>
    );
};

export default UtilityBar;
