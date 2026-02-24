// frontend/src/App.jsx
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
import ClaimBusiness from './pages/ClaimBusiness'; // Make sure this import exists
import KYCRegistration from './pages/KYCRegistration'; // Add this import
import JoinPsychologist from './pages/JoinPsychologist';
import ApplicationSuccess from './pages/ApplicationSuccess';
import PrivateRoute from './components/auth/PrivateRoute';
import './styles/global.css';
import './styles/theme.css';
import './styles/components.css';

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
                                <Route path="/" element={<Home />} />
                                <Route path="/login" element={<Login />} />
                                <Route path="/register" element={<Register />} />
                                <Route path="/search" element={<SearchPage />} />
                                <Route path="/companies/:id" element={<CompanyPage />} />
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
                                <Route path="/psychologist/join" element={<JoinPsychologist />} />
                                <Route path="/application-success" element={<ApplicationSuccess />} />
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