import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppsList from './portal/AppsList';
import AppDetail from './portal/AppDetail';
import AppUsers from './portal/AppUsers';
import AppPages from './portal/AppPages';
import AppSettings from './portal/AppSettings';

const KodiPortalPage = () => (
    <Routes>
        <Route path="/" element={<Navigate to="apps" replace />} />
        <Route path="apps" element={<AppsList />} />
        <Route path="apps/:appId" element={<AppDetail />} />
        <Route path="apps/:appId/users" element={<AppUsers />} />
        <Route path="apps/:appId/pages" element={<AppPages />} />
        <Route path="apps/:appId/settings" element={<AppSettings />} />
    </Routes>
);

export default KodiPortalPage;
