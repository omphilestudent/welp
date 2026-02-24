// frontend/src/pages/Settings.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
    FaUser,
    FaEnvelope,
    FaPhone,
    FaMapMarkerAlt,
    FaGlobe,
    FaLock,
    FaBell,
    FaMoon,
    FaSun,
    FaSave,
    FaTrash,
    FaUserMd,
    FaPlus,
    FaCheckCircle,
    FaExclamationTriangle
} from 'react-icons/fa';

const Settings = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { isDarkMode, toggleTheme } = useTheme();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('profile');
    const [profile, setProfile] = useState({
        displayName: '',
        email: '',
        phoneNumber: '',
        bio: '',
        location: '',
        website: '',
        avatarUrl: ''
    });

    const [settings, setSettings] = useState({
        theme: isDarkMode ? 'dark' : 'light',
        emailNotifications: true,
        messageNotifications: true,
        reviewNotifications: true
    });

    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [psychologistData, setPsychologistData] = useState({
        licenseNumber: '',
        licenseIssuingBody: '',
        yearsOfExperience: '',
        specialization: [],
        qualifications: [],
        biography: '',
        consultationModes: [],
        languages: ['English'],
        acceptedAgeGroups: [],
        hourlyRate: '',
        availability: {}
    });

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        fetchProfile();
        fetchSettings();
    }, []);

    const fetchProfile = async () => {
        try {
            const { data } = await api.get('/users/profile');
            setProfile({
                displayName: data.display_name || '',
                email: data.email || '',
                phoneNumber: data.phone_number || '',
                bio: data.bio || '',
                location: data.location || '',
                website: data.website || '',
                avatarUrl: data.avatar_url || ''
            });
        } catch (error) {
            console.error('Failed to fetch profile:', error);
        }
    };

    const fetchSettings = async () => {
        try {
            const { data } = await api.get('/users/settings');
            setSettings(data);
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        }
    };

    const handleProfileUpdate = async () => {
        setLoading(true);
        try {
            await api.patch('/users/profile', profile);
            toast.success('Profile updated successfully');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handleSettingsUpdate = async () => {
        setLoading(true);
        try {
            await api.patch('/users/settings', settings);

            // Update theme if changed
            if (settings.theme === 'dark' !== isDarkMode) {
                toggleTheme();
            }

            toast.success('Settings updated successfully');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to update settings');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (passwordData.newPassword.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            await api.post('/users/change-password', {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            });
            toast.success('Password changed successfully');
            setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    const handleAddPsychologistProfile = async () => {
        setLoading(true);
        try {
            await api.post('/users/add-psychologist-profile', psychologistData);
            toast.success('Psychologist profile added! It will be verified soon.');
            setActiveTab('profile');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to add psychologist profile');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!passwordData.currentPassword) {
            toast.error('Please enter your password to confirm');
            return;
        }

        setLoading(true);
        try {
            await api.delete('/users/delete-account', {
                data: { password: passwordData.currentPassword }
            });
            toast.success('Account deleted successfully');
            await logout();
            navigate('/');
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to delete account');
        } finally {
            setLoading(false);
            setShowDeleteConfirm(false);
        }
    };

    return (
        <div className="settings-page">
            <div className="container">
                <motion.h1
                    className="settings-title"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    Settings
                </motion.h1>

                <div className="settings-layout">
                    {/* Sidebar */}
                    <motion.div
                        className="settings-sidebar"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <div className="settings-nav">
                            <button
                                className={`settings-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                                onClick={() => setActiveTab('profile')}
                            >
                                <FaUser /> Profile
                            </button>
                            <button
                                className={`settings-nav-item ${activeTab === 'account' ? 'active' : ''}`}
                                onClick={() => setActiveTab('account')}
                            >
                                <FaLock /> Account
                            </button>
                            <button
                                className={`settings-nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
                                onClick={() => setActiveTab('notifications')}
                            >
                                <FaBell /> Notifications
                            </button>
                            <button
                                className={`settings-nav-item ${activeTab === 'appearance' ? 'active' : ''}`}
                                onClick={() => setActiveTab('appearance')}
                            >
                                {isDarkMode ? <FaMoon /> : <FaSun />} Appearance
                            </button>
                            {user?.role !== 'psychologist' && (
                                <button
                                    className={`settings-nav-item ${activeTab === 'become-psychologist' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('become-psychologist')}
                                >
                                    <FaUserMd /> Become Psychologist
                                </button>
                            )}
                        </div>
                    </motion.div>

                    {/* Main Content */}
                    <motion.div
                        className="settings-content"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        {/* Profile Settings */}
                        {activeTab === 'profile' && (
                            <div className="settings-section">
                                <h2>Profile Settings</h2>

                                <div className="form-group">
                                    <label className="form-label">Display Name</label>
                                    <input
                                        type="text"
                                        value={profile.displayName}
                                        onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                                        className="form-input"
                                        placeholder="Your name"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input
                                        type="email"
                                        value={profile.email}
                                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                        className="form-input"
                                        placeholder="your@email.com"
                                        disabled
                                    />
                                    <small className="input-help">Email cannot be changed</small>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={profile.phoneNumber}
                                        onChange={(e) => setProfile({ ...profile, phoneNumber: e.target.value })}
                                        className="form-input"
                                        placeholder="+1 234 567 8900"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Bio</label>
                                    <textarea
                                        value={profile.bio}
                                        onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                                        className="form-textarea"
                                        placeholder="Tell us about yourself"
                                        rows="4"
                                    />
                                </div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Location</label>
                                        <input
                                            type="text"
                                            value={profile.location}
                                            onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                                            className="form-input"
                                            placeholder="City, Country"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Website</label>
                                        <input
                                            type="url"
                                            value={profile.website}
                                            onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                                            className="form-input"
                                            placeholder="https://yourwebsite.com"
                                        />
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button
                                        onClick={handleProfileUpdate}
                                        disabled={loading}
                                        className="btn btn-primary"
                                    >
                                        <FaSave /> {loading ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Account Settings */}
                        {activeTab === 'account' && (
                            <div className="settings-section">
                                <h2>Account Settings</h2>

                                <div className="password-section">
                                    <h3>Change Password</h3>

                                    <div className="form-group">
                                        <label className="form-label">Current Password</label>
                                        <input
                                            type="password"
                                            value={passwordData.currentPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                            className="form-input"
                                            placeholder="Enter current password"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">New Password</label>
                                        <input
                                            type="password"
                                            value={passwordData.newPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                            className="form-input"
                                            placeholder="Enter new password"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Confirm New Password</label>
                                        <input
                                            type="password"
                                            value={passwordData.confirmPassword}
                                            onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                            className="form-input"
                                            placeholder="Confirm new password"
                                        />
                                    </div>

                                    <button
                                        onClick={handlePasswordChange}
                                        disabled={loading}
                                        className="btn btn-primary"
                                    >
                                        <FaLock /> {loading ? 'Updating...' : 'Update Password'}
                                    </button>
                                </div>

                                <div className="danger-zone">
                                    <h3>Danger Zone</h3>
                                    <p>Once you delete your account, there is no going back. Please be certain.</p>

                                    {!showDeleteConfirm ? (
                                        <button
                                            onClick={() => setShowDeleteConfirm(true)}
                                            className="btn btn-danger"
                                        >
                                            <FaTrash /> Delete Account
                                        </button>
                                    ) : (
                                        <div className="delete-confirm">
                                            <p className="warning-text">
                                                <FaExclamationTriangle /> This action cannot be undone.
                                                Please enter your password to confirm.
                                            </p>
                                            <input
                                                type="password"
                                                value={passwordData.currentPassword}
                                                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                                className="form-input"
                                                placeholder="Enter your password"
                                            />
                                            <div className="confirm-actions">
                                                <button
                                                    onClick={handleDeleteAccount}
                                                    disabled={loading}
                                                    className="btn btn-danger"
                                                >
                                                    {loading ? 'Deleting...' : 'Yes, Delete My Account'}
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setShowDeleteConfirm(false);
                                                        setPasswordData({ ...passwordData, currentPassword: '' });
                                                    }}
                                                    className="btn btn-secondary"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Notification Settings */}
                        {activeTab === 'notifications' && (
                            <div className="settings-section">
                                <h2>Notification Settings</h2>

                                <div className="notification-options">
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={settings.emailNotifications}
                                            onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                                        />
                                        <span>Email Notifications</span>
                                    </label>
                                    <p className="checkbox-help">Receive email updates about your account</p>

                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={settings.messageNotifications}
                                            onChange={(e) => setSettings({ ...settings, messageNotifications: e.target.checked })}
                                        />
                                        <span>Message Notifications</span>
                                    </label>
                                    <p className="checkbox-help">Get notified when you receive new messages</p>

                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={settings.reviewNotifications}
                                            onChange={(e) => setSettings({ ...settings, reviewNotifications: e.target.checked })}
                                        />
                                        <span>Review Notifications</span>
                                    </label>
                                    <p className="checkbox-help">Get notified when someone replies to your reviews</p>
                                </div>

                                <div className="form-actions">
                                    <button
                                        onClick={handleSettingsUpdate}
                                        disabled={loading}
                                        className="btn btn-primary"
                                    >
                                        <FaSave /> {loading ? 'Saving...' : 'Save Preferences'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Appearance Settings */}
                        {activeTab === 'appearance' && (
                            <div className="settings-section">
                                <h2>Appearance Settings</h2>

                                <div className="theme-options">
                                    <div
                                        className={`theme-option ${!isDarkMode ? 'active' : ''}`}
                                        onClick={() => {
                                            if (isDarkMode) {
                                                toggleTheme();
                                                setSettings({ ...settings, theme: 'light' });
                                            }
                                        }}
                                    >
                                        <FaSun className="theme-icon" />
                                        <h3>Light Mode</h3>
                                        <p>Bright and clean interface</p>
                                        {!isDarkMode && <FaCheckCircle className="check-icon" />}
                                    </div>

                                    <div
                                        className={`theme-option ${isDarkMode ? 'active' : ''}`}
                                        onClick={() => {
                                            if (!isDarkMode) {
                                                toggleTheme();
                                                setSettings({ ...settings, theme: 'dark' });
                                            }
                                        }}
                                    >
                                        <FaMoon className="theme-icon" />
                                        <h3>Dark Mode</h3>
                                        <p>Easy on the eyes at night</p>
                                        {isDarkMode && <FaCheckCircle className="check-icon" />}
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button
                                        onClick={handleSettingsUpdate}
                                        disabled={loading}
                                        className="btn btn-primary"
                                    >
                                        <FaSave /> {loading ? 'Saving...' : 'Save Preference'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Become Psychologist */}
                        {activeTab === 'become-psychologist' && (
                            <div className="settings-section">
                                <h2>Become a Psychologist</h2>
                                <p className="section-description">
                                    Add a psychologist profile to your account and start helping employees.
                                    Your credentials will be verified by our team.
                                </p>

                                <div className="form-group">
                                    <label className="form-label">License Number *</label>
                                    <input
                                        type="text"
                                        value={psychologistData.licenseNumber}
                                        onChange={(e) => setPsychologistData({ ...psychologistData, licenseNumber: e.target.value })}
                                        className="form-input"
                                        placeholder="e.g., LIC-12345"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">License Issuing Body *</label>
                                    <input
                                        type="text"
                                        value={psychologistData.licenseIssuingBody}
                                        onChange={(e) => setPsychologistData({ ...psychologistData, licenseIssuingBody: e.target.value })}
                                        className="form-input"
                                        placeholder="e.g., State Board of Psychology"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Years of Experience *</label>
                                    <input
                                        type="number"
                                        value={psychologistData.yearsOfExperience}
                                        onChange={(e) => setPsychologistData({ ...psychologistData, yearsOfExperience: e.target.value })}
                                        className="form-input"
                                        placeholder="10"
                                        min="0"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Specializations</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g., Clinical Psychology, CBT (comma separated)"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && e.target.value) {
                                                const values = e.target.value.split(',').map(v => v.trim());
                                                setPsychologistData({
                                                    ...psychologistData,
                                                    specialization: [...psychologistData.specialization, ...values]
                                                });
                                                e.target.value = '';
                                            }
                                        }}
                                    />
                                    <div className="tags-list">
                                        {psychologistData.specialization.map((item, index) => (
                                            <span key={index} className="tag">
                        {item}
                                                <button onClick={() => {
                                                    setPsychologistData({
                                                        ...psychologistData,
                                                        specialization: psychologistData.specialization.filter((_, i) => i !== index)
                                                    });
                                                }}>×</button>
                      </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Professional Biography</label>
                                    <textarea
                                        value={psychologistData.biography}
                                        onChange={(e) => setPsychologistData({ ...psychologistData, biography: e.target.value })}
                                        className="form-textarea"
                                        placeholder="Tell us about your experience and approach..."
                                        rows="5"
                                    />
                                </div>

                                <div className="verification-notice">
                                    <FaShieldAlt className="notice-icon" />
                                    <div className="notice-content">
                                        <h4>Verification Process</h4>
                                        <p>
                                            Your psychologist profile will be reviewed within 3-5 business days.
                                            Once verified, you'll be able to accept chat requests from employees.
                                        </p>
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button
                                        onClick={handleAddPsychologistProfile}
                                        disabled={loading}
                                        className="btn btn-primary"
                                    >
                                        <FaPlus /> {loading ? 'Submitting...' : 'Submit for Verification'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default Settings;