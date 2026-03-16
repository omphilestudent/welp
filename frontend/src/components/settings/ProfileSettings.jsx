
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FaCamera, FaUpload, FaBriefcase, FaBuilding, FaUser, FaEnvelope, FaPhone, FaMapMarkerAlt, FaGlobe } from 'react-icons/fa';
import { resolveMediaUrl } from '../../utils/media';

const ProfileSettings = ({ onUpdate }) => {
    const { user, updateUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [profile, setProfile] = useState({
        displayName: '',
        email: '',
        occupation: '',
        workplaceId: '',
        workplace: null,
        phoneNumber: '',
        bio: '',
        location: '',
        website: '',
        avatarUrl: ''
    });

    const fileInputRef = useRef(null);
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [workplaceSearch, setWorkplaceSearch] = useState('');

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const { data } = await api.get('/users/profile');
            setProfile({
                displayName: data.display_name || '',
                email: data.email || '',
                occupation: data.occupation || '',
                workplaceId: data.workplace_id || '',
                workplace: data.workplace || null,
                phoneNumber: data.phone_number || '',
                bio: data.bio || '',
                location: data.location || '',
                website: data.website || '',
                avatarUrl: data.avatar_url || ''
            });
            setWorkplaceSearch(data.workplace?.name || '');
        } catch (error) {
            console.error('Failed to fetch profile:', error);
            toast.error('Failed to load profile');
        }
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;


        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }


        if (file.size > 2 * 1024 * 1024) {
            toast.error('File size must be less than 2MB');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('avatar', file);

        try {
            const { data } = await api.post('/users/upload-avatar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });


            setProfile(prev => ({ ...prev, avatarUrl: data.avatarUrl }));


            if (updateUser) {
                updateUser({ ...user, avatar_url: data.avatarUrl });
            }

            toast.success('Profile picture updated!');
            onUpdate?.();
        } catch (error) {
            console.error('Upload error:', error);
            toast.error(error.response?.data?.error || 'Failed to upload image');
        } finally {
            setUploading(false);
        }
    };

    const searchWorkplace = async (query) => {
        if (!query || query.length < 2) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const { data } = await api.get('/companies/search', {
                params: { q: query, limit: 5 }
            });
            setSearchResults(data.companies || []);
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setSearching(false);
        }
    };

    const handleWorkplaceSelect = (company) => {
        setProfile({
            ...profile,
            workplaceId: company.id,
            workplace: company
        });
        setWorkplaceSearch(company.name);
        setSearchResults([]);
    };

    const handleWorkplaceSearch = (e) => {
        const value = e.target.value;
        setWorkplaceSearch(value);
        searchWorkplace(value);


        if (profile.workplaceId && value !== profile.workplace?.name) {
            setProfile({
                ...profile,
                workplaceId: '',
                workplace: null
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data } = await api.patch('/users/profile', {
                displayName: profile.displayName,
                occupation: profile.occupation,
                workplaceId: profile.workplaceId || null,
                phoneNumber: profile.phoneNumber,
                bio: profile.bio,
                location: profile.location,
                website: profile.website
            });


            if (updateUser) {
                updateUser({
                    ...user,
                    display_name: profile.displayName,
                    occupation: profile.occupation
                });
            }

            toast.success('Profile updated successfully!');
            onUpdate?.();
        } catch (error) {
            console.error('Update error:', error);
            toast.error(error.response?.data?.error || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="profile-settings">
            {}
            <div className="profile-picture-section">
                <h3>Profile Picture</h3>
                <div className="avatar-upload-container">
                    <div className="current-avatar">
                        {profile.avatarUrl ? (
                            <img src={resolveMediaUrl(profile.avatarUrl)} alt={profile.displayName} />
                        ) : (
                            <div className="avatar-placeholder-large">
                                {profile.displayName?.charAt(0) || user?.display_name?.charAt(0) || 'U'}
                            </div>
                        )}

                        <button
                            className="avatar-upload-btn"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                        >
                            {uploading ? <FaUpload className="spinning" /> : <FaCamera />}
                        </button>

                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            accept="image/*"
                            style={{ display: 'none' }}
                        />
                    </div>
                    <div className="avatar-help-text">
                        <p>Click the camera icon to upload a new photo</p>
                        <p className="small">Supported: JPG, PNG, GIF (Max 2MB)</p>
                    </div>
                </div>
            </div>

            {}
            <form onSubmit={handleSubmit} className="profile-form">
                <h3>Personal Information</h3>

                <div className="form-group">
                    <label className="form-label">
                        <FaUser /> Display Name
                    </label>
                    <input
                        type="text"
                        value={profile.displayName}
                        onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                        className="form-input"
                        placeholder="Your name"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">
                        <FaEnvelope /> Email
                    </label>
                    <input
                        type="email"
                        value={profile.email}
                        className="form-input"
                        disabled
                        readOnly
                    />
                    <small className="input-help">Email cannot be changed</small>
                </div>

                <h3>Professional Information</h3>

                <div className="form-group">
                    <label className="form-label">
                        <FaBriefcase /> Occupation
                    </label>
                    <input
                        type="text"
                        value={profile.occupation}
                        onChange={(e) => setProfile({ ...profile, occupation: e.target.value })}
                        className="form-input"
                        placeholder="e.g., Software Engineer, Manager"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">
                        <FaBuilding /> Workplace
                    </label>
                    <input
                        type="text"
                        value={workplaceSearch}
                        onChange={handleWorkplaceSearch}
                        className="form-input"
                        placeholder="Search for your company"
                    />

                    {searching && <div className="searching">Searching...</div>}

                    {searchResults.length > 0 && (
                        <div className="search-results">
                            {searchResults.map(company => (
                                <div
                                    key={company.id}
                                    className="search-result-item"
                                    onClick={() => handleWorkplaceSelect(company)}
                                >
                                    <strong>{company.name}</strong>
                                    <span>{company.industry}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {profile.workplace && (
                        <div className="selected-workplace">
                            <FaBuilding /> {profile.workplace.name}
                            <button
                                type="button"
                                className="clear-btn"
                                onClick={() => {
                                    setProfile({ ...profile, workplaceId: '', workplace: null });
                                    setWorkplaceSearch('');
                                }}
                            >
                                ×
                            </button>
                        </div>
                    )}
                </div>

                <h3>Contact Information</h3>

                <div className="form-group">
                    <label className="form-label">
                        <FaPhone /> Phone Number
                    </label>
                    <input
                        type="tel"
                        value={profile.phoneNumber}
                        onChange={(e) => setProfile({ ...profile, phoneNumber: e.target.value })}
                        className="form-input"
                        placeholder="+1 234 567 8900"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">
                        <FaMapMarkerAlt /> Location
                    </label>
                    <input
                        type="text"
                        value={profile.location}
                        onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                        className="form-input"
                        placeholder="City, Country"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">
                        <FaGlobe /> Website
                    </label>
                    <input
                        type="url"
                        value={profile.website}
                        onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                        className="form-input"
                        placeholder="https://yourwebsite.com"
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

                <div className="form-actions">
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary"
                    >
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ProfileSettings;
