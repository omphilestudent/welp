import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { AdProvider } from './contexts/AdContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import SystemNotificationBootstrapper from './components/system/SystemNotificationBootstrapper';
import InactivityManager from './components/system/InactivityManager';
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
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import PsychologistCode from './pages/PsychologistCode';
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
import FlowManagement from './pages/admin/FlowManagement';
import FlowAdmin from './pages/admin/FlowAdmin';
import FlowBuilder from './pages/admin/FlowBuilder';

// HR Pages
import Employees from './pages/hr/Employees';
import EmployeeProfile from './pages/hr/EmployeeProfile';
import Leaves from './pages/hr/Leaves';
import Documents from './pages/hr/Documents';
import Onboarding from './pages/hr/Onboarding';
import HRSettings from './pages/hr/HRSettings';

import './styles/global.css';
import './styles/theme.css';
import './styles/components.css';
import './styles/admin.css';
import './styles/pricing.css';

function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <AdProvider>
                    <Toaster position="top-right" />
                    <SystemNotificationBootstrapper />
                    <InactivityManager />
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
                                <Route path="/terms" element={<Terms />} />
                                <Route path="/privacy" element={<Privacy />} />
                                <Route path="/psychologist-code" element={<PsychologistCode />} />
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
                                    <Route path="flows" element={<FlowAdmin />} />
                                    <Route path="flows/advanced" element={<FlowManagement />} />
                                    <Route path="flows/:id/builder" element={<FlowBuilder />} />
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
                                        <PrivateRoute>
                                            <AdminLayout />
                                        </PrivateRoute>
                                    }
                                >
                                    <Route index element={<Navigate to="/hr/employees" replace />} />
                                    <Route path="dashboard" element={<Navigate to="/hr/employees" replace />} />
                                    <Route path="employees" element={<Employees />} />
                                    <Route path="employees/:id" element={<EmployeeProfile />} />
                                    <Route path="leaves" element={<Leaves />} />
                                    <Route path="documents" element={<Documents />} />
                                    <Route path="onboarding" element={<Onboarding />} />
                                    <Route path="settings" element={<HRSettings />} />
                                    <Route path="*" element={<Navigate to="/hr/employees" replace />} />
                                </Route>
                                </Routes>
                            </main>
                            <Footer />
                        </div>
                    </Router>
                </AdProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;
