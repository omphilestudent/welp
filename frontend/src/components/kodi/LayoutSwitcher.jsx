import React from 'react';

const LayoutSwitcher = ({ layoutType, orientation, onChange }) => (
    <div className="kodi-builder__layout-switcher">
        <div>
            <label>
                Layout
                <select value={layoutType} onChange={(event) => onChange({ type: event.target.value })}>
                    <option value="1-column">1 column</option>
                    <option value="2-column">2 column</option>
                    <option value="3-column">3 column</option>
                </select>
            </label>
        </div>
        <div>
            <label>
                Orientation
                <select value={orientation} onChange={(event) => onChange({ orientation: event.target.value })}>
                    <option value="horizontal">Horizontal</option>
                    <option value="vertical">Vertical</option>
                    <option value="mixed">Mixed</option>
                </select>
            </label>
        </div>
    </div>
);

export default LayoutSwitcher;
