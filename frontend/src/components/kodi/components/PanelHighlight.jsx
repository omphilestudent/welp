import React from 'react';
import './PanelHighlight.css';

const PanelHighlight = ({ props = {} }) => {
    const {
        title = 'Highlights',
        description = 'Track the most important calls and tasks.',
        badge = 'Live',
        actions = ['Add Call', 'New Task', 'Send Update'],
        stats = ['Leads: 8', 'Calls: 12', 'Open Tasks: 3'],
        accentColor = '#0f62fe',
        textColor = '#ffffff'
    } = props;

    return (
        <div
            className="kodi-panel-highlight"
            style={{ backgroundColor: accentColor, color: textColor }}
        >
            <div className="kodi-panel-highlight__body">
                <div className="kodi-panel-highlight__header">
                    <span className="kodi-panel-highlight__badge">{badge}</span>
                    <h3>{title}</h3>
                    <p>{description}</p>
                </div>
                <div className="kodi-panel-highlight__actions">
                    {actions.map((action) => (
                        <button key={action} type="button">{action}</button>
                    ))}
                </div>
            </div>
            <div className="kodi-panel-highlight__stats">
                {stats.map((stat) => (
                    <div key={stat} className="kodi-panel-highlight__stat">{stat}</div>
                ))}
            </div>
        </div>
    );
};

export default PanelHighlight;
