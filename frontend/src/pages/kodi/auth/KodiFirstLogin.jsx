import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { kodiAuthFirstLogin } from '../../../services/kodiAuthService';

const KodiFirstLogin = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (password.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }
        if (password !== confirm) {
            toast.error('Passwords do not match');
            return;
        }
        const firstLoginToken = sessionStorage.getItem('kodi_first_login_token');
        if (!firstLoginToken) {
            toast.error('Missing first login token');
            return;
        }
        setLoading(true);
        try {
            const res = await kodiAuthFirstLogin({ firstLoginToken, password });
            const payload = res.data || res;
            localStorage.setItem('token', payload.token);
            sessionStorage.removeItem('kodi_first_login_token');
            navigate('/kodi/apps');
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to set password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="kodi-auth">
            <form className="kodi-auth__card" onSubmit={handleSubmit}>
                <h1>Create Password</h1>
                <label>
                    New password
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </label>
                <label>
                    Confirm password
                    <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </label>
                <button className="btn-primary" type="submit" disabled={loading}>
                    {loading ? 'Saving...' : 'Set Password'}
                </button>
            </form>
        </div>
    );
};

export default KodiFirstLogin;
