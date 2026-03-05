
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import CompanyPage from './pages/CompanyPage';
import SearchPage from './pages/SearchPage';
import Dashboard from './pages/Dashboard';
import Messages from './pages/Messages';
import Settings from './pages/Settings';
import ClaimBusiness from './pages/ClaimBusiness';
import KYCRegistration from './pages/KYCRegistration';
import JoinPsychologist from './pages/JoinPsychologist';
import ApplicationSuccess from './pages/ApplicationSuccess';
import Pricing from './pages/Pricing';
import Careers from './pages/Careers';
import JobDetails from './pages/JobDetails';
import ApplyJob from './pages/ApplyJob';
import Benefits from './pages/Benefits';
import Internships from './pages/Internships';
import GeneralApplication from './pages/GeneralApplication';
import PrivateRoute from './components/auth/PrivateRoute';
import AdminRoute from './components/auth/AdminRoute';
import AdminLayout from './components/admin/AdminLayout';


import AdminDashboard from './pages/admin/AdminDashboard';
import PricingManagement from './pages/admin/PricingManagement';
import UserManagement from './pages/admin/UserManagement';
import CompanyManagement from './pages/admin/CompanyManagement';
import ReviewModeration from './pages/admin/ReviewModeration';
import SubscriptionManagement from './pages/admin/SubscriptionManagement';
import SystemSettings from './pages/admin/SystemSettings';


import HRDashboard from './pages/hr/HRDashboard';
import JobPostings from './pages/hr/JobPostings';
import Applications from './pages/hr/Applications';
import Interviews from './pages/hr/Interviews';
import EmployeeRelations from './pages/hr/EmployeeRelations';
import Departments from './pages/hr/Departments';

import './styles/global.css';
import './styles/theme.css';
import './styles/components.css';
import './styles/admin.css';

function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <Router
                    future={{
                        v7_startTransition: true,
                        v7_relativeSplatPath: true
                    }}
                >
                    <div className="app">
                        <Navbar />
                        <main className="main-content">
                            <Routes>
                                {}
                                <Route path="/" element={<Home />} />
                                <Route path="/login" element={<Login />} />
                                <Route path="/register" element={<Register />} />
                                <Route path="/search" element={<SearchPage />} />
                                <Route path="/companies/:id" element={<CompanyPage />} />
                                <Route path="/pricing" element={<Pricing />} />
                                <Route path="/psychologist/join" element={<JoinPsychologist />} />
                                <Route path="/application-success" element={<ApplicationSuccess />} />

                                {}
                                <Route path="/careers" element={<Careers />} />
                                <Route path="/careers/jobs/:id" element={<JobDetails />} />
                                <Route path="/careers/apply/:id" element={<ApplyJob />} />
                                <Route path="/careers/benefits" element={<Benefits />} />
                                <Route path="/careers/internships" element={<Internships />} />
                                <Route path="/careers/apply/general" element={<GeneralApplication />} />

                                {}
                                <Route
                                    path="/claim/:id"
                                    element={
                                        <PrivateRoute>
                                            <ClaimBusiness />
                                        </PrivateRoute>
                                    }
                                />
                                <Route
                                    path="/kyc/:id"
                                    element={
                                        <PrivateRoute>
                                            <KYCRegistration />
                                        </PrivateRoute>
                                    }
                                />
                                <Route
                                    path="/dashboard"
                                    element={
                                        <PrivateRoute>
                                            <Dashboard />
                                        </PrivateRoute>
                                    }
                                />
                                <Route
                                    path="/messages"
                                    element={
                                        <PrivateRoute>
                                            <Messages />
                                        </PrivateRoute>
                                    }
                                />
                                <Route
                                    path="/settings"
                                    element={
                                        <PrivateRoute>
                                            <Settings />
                                        </PrivateRoute>
                                    }
                                />

                                {}
                                <Route
                                    path="/admin"
                                    element={
                                        <AdminRoute requiredRole="admin">
                                            <AdminLayout />
                                        </AdminRoute>
                                    }
                                >
                                    <Route index element={<AdminDashboard />} />
                                    <Route path="dashboard" element={<AdminDashboard />} />
                                    <Route path="users" element={<UserManagement />} />
                                    <Route path="pricing" element={<PricingManagement />} />
                                    <Route path="companies" element={<CompanyManagement />} />
                                    <Route path="reviews" element={<ReviewModeration />} />
                                    <Route path="subscriptions" element={<SubscriptionManagement />} />
                                    <Route path="settings" element={<SystemSettings />} />
                                </Route>

                                {}
                                <Route
                                    path="/hr"
                                    element={
                                        <AdminRoute requiredRole="hr">
                                            <AdminLayout />
                                        </AdminRoute>
                                    }
                                >
                                    <Route index element={<HRDashboard />} />
                                    <Route path="dashboard" element={<HRDashboard />} />
                                    <Route path="jobs" element={<JobPostings />} />
                                    <Route path="applications" element={<Applications />} />
                                    <Route path="interviews" element={<Interviews />} />
                                    <Route path="employees" element={<EmployeeRelations />} />
                                    <Route path="departments" element={<Departments />} />
                                </Route>
                            </Routes>
                        </main>
                        <Footer />
                    </div>
                </Router>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;