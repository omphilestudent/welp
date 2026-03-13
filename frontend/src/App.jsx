import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import BusinessRegister from './pages/BusinessRegister';
import PsychologistRegister from './pages/PsychologistRegister';
import ApplicationSuccess from './pages/ApplicationSuccess';
import Pricing from './pages/Pricing';
import FAQ from './pages/FAQ';
import Careers from './pages/Careers';
import JobDetails from './pages/JobDetails';
import ApplyJob from './pages/ApplyJob';
import Benefits from './pages/Benefits';
import Internships from './pages/Internships';
import GeneralApplication from './pages/GeneralApplication';
import MentalHealthResources from './pages/MentalHealthResources';
import UserProfile from './pages/UserProfile';
import PrivateRoute from './components/auth/PrivateRoute';
import AdminRoute from './components/auth/AdminRoute';
import AdminLayout from './components/admin/AdminLayout';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import PricingManagement from './pages/admin/PricingManagement';
import UserManagement from './pages/admin/UserManagement';
import CompanyManagement from './pages/admin/CompanyManagement';
import ReviewModeration from './pages/admin/ReviewModeration';
import SubscriptionManagement from './pages/admin/SubscriptionManagement';
import SystemSettings from './pages/admin/SystemSettings';
import MLInteractions from './pages/admin/MLInteractions';
import RegistrationApplications from './pages/admin/RegistrationApplications';
import CalendarTroubleshoot from './pages/admin/CalendarTroubleshoot';
import ClaimRequests from './pages/admin/ClaimRequests';
import MarketingEmails from './pages/admin/MarketingEmails';
import AdApprovals from './pages/admin/AdApprovals';

// HR Pages
import HRDashboard from './pages/hr/HRDashboard';
import JobPostings from './pages/hr/JobPostings';
import JobCreate from './pages/hr/JobCreate'; // Add this import
import JobDetailsHR from './pages/hr/JobDetails'; // Add this import (you might want to rename to avoid conflict with public JobDetails)
import Applications from './pages/hr/Applications';
import Interviews from './pages/hr/Interviews';
import EmployeeRelations from './pages/hr/EmployeeRelations';
import Departments from './pages/hr/Departments';

import './styles/global.css';
import './styles/theme.css';
import './styles/components.css';
import './styles/admin.css';
import './styles/pricing.css';

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
                                {/* Public Routes */}
                                <Route path="/" element={<Home />} />
                                <Route path="/login" element={<Login />} />
                                <Route path="/register" element={<Register />} />
                                <Route path="/search" element={<SearchPage />} />
                                <Route path="/companies/:id" element={<CompanyPage />} />
                                <Route path="/pricing" element={<Pricing />} />
                                <Route path="/faq" element={<FAQ />} />
                                <Route path="/register/psychologist" element={<PsychologistRegister />} />
                                <Route path="/register/business" element={<BusinessRegister />} />
                                <Route path="/application-success" element={<ApplicationSuccess />} />

                                {/* Public Career Routes */}
                                <Route path="/careers" element={<Careers />} />
                                <Route path="/careers/jobs/:id" element={<JobDetails />} />
                                <Route path="/careers/apply/:id" element={<ApplyJob />} />
                                <Route path="/careers/apply" element={<GeneralApplication />} />
                                <Route path="/careers/benefits" element={<Benefits />} />
                                <Route path="/careers/internships" element={<Internships />} />
                                <Route path="/resources" element={<MentalHealthResources />} />
                                <Route
                                    path="/users/:id"
                                    element={
                                        <PrivateRoute>
                                            <UserProfile />
                                        </PrivateRoute>
                                    }
                                />

                                {/* Protected Routes */}
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
                                            <BusinessRegister />
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

                                {/* Admin Routes */}
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
                                    <Route path="UserManagement" element={<Navigate to="/admin/users" replace />} />
                                    <Route path="usermanagement" element={<Navigate to="/admin/users" replace />} />
                                    <Route path="pricing" element={<PricingManagement />} />
                                    <Route path="companies" element={<CompanyManagement />} />
                                    <Route path="reviews" element={<ReviewModeration />} />
                                    <Route path="applications" element={<RegistrationApplications />} />
                                    <Route path="claims" element={<ClaimRequests />} />
                                    <Route path="marketing" element={<MarketingEmails />} />
                                    <Route path="ads" element={<AdApprovals />} />
                                    <Route path="calendar" element={<CalendarTroubleshoot />} />
                                    <Route path="subscriptions" element={<SubscriptionManagement />} />
                                    <Route path="settings" element={<SystemSettings />} />
                                    <Route path="ml-interactions" element={<MLInteractions />} />
                                    <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
                                </Route>

                                {/* HR Routes */}
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
                                    <Route path="UserManagement" element={<Navigate to="/hr/dashboard" replace />} />

                                    {/* Job Management Routes - FIXED: Added all missing routes */}
                                    <Route path="jobs" element={<JobPostings />} />
                                    <Route path="jobs/create" element={<JobCreate />} />
                                    <Route path="jobs/:id" element={<JobDetailsHR />} />
                                    <Route path="jobs/:id/edit" element={<JobCreate />} />
                                    <Route path="jobs/:id/applications" element={<Applications />} />

                                    {/* Other HR Routes */}
                                    <Route path="applications" element={<Applications />} />
                                    <Route path="interviews" element={<Interviews />} />
                                    <Route path="employees" element={<EmployeeRelations />} />
                                    <Route path="departments" element={<Departments />} />
                                    <Route path="Departments" element={<Navigate to="/hr/departments" replace />} />
                                    <Route path="*" element={<Navigate to="/hr/dashboard" replace />} />
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
