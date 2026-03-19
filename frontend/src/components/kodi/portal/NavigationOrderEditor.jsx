import React from 'react';

const NavigationOrderEditor = ({ description }) => (
    <div className="kodi-portal-nav-editor">
        <p>{description || 'Drag pages to reorder navigation. Order is saved automatically.'}</p>
    </div>
);

export default NavigationOrderEditor;
