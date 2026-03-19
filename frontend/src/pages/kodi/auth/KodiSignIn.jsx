import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { kodiAuthSignIn } from '../../../services/kodiAuthService';

const KodiSignIn = () => {
    const navigate = useNavigate();
    const [form, setForm] = useState({ username: '', password: '', otp: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        try {
            const res = await kodiAuthSignIn(form);
            const payload = res.data || res;
            if (payload.firstLoginRequired) {
                sessionStorage.setItem('kodi_first_login_token', payload.firstLoginToken);
                localStorage.setItem('token', payload.token);
                navigate('/kodi-auth/first-login');
            } else {
                localStorage.setItem('token', payload.token);
                navigate('/kodi/apps');
            }
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to sign in');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="kodi-auth">
            <form className="kodi-auth__card" onSubmit={handleSubmit}>
                <h1>Kodi Access</h1>
                <label>
                    Username
                    <input
                        type="text"
                        value={form.username}
                        onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
                    />
                </label>
                <label>
                    Password
                    <input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    />
                </label>
                <label>
                    One-time password
                    <input
                        type="text"
                        value={form.otp}
                        onChange={(e) => setForm((prev) => ({ ...prev, otp: e.target.value }))}
                    />
                </label>
                <button className="btn-primary" type="submit" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign In'}
                </button>
            </form>
        </div>
    );
};

export default KodiSignIn;
