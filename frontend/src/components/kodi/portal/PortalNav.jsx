import React from 'react';
import { NavLink } from 'react-router-dom';

const PortalNav = () => (
    <nav className="kodi-portal-nav">
        <NavLink to="/kodi/portal/apps" className={({ isActive }) => `kodi-portal-nav__link${isActive ? ' active' : ''}`}>
            Apps
        </NavLink>
        <NavLink to="/kodi/portal/objects" className={({ isActive }) => `kodi-portal-nav__link${isActive ? ' active' : ''}`}>
            CRM Objects
        </NavLink>
    </nav>
);

export default PortalNav;
