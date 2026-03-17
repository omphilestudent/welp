import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { kodiPageLogin, setKodiPageToken } from '../../services/kodiPageService';

const KodiLogin = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const pageSlug = useMemo(() => String(slug || '').trim(), [slug]);
    const [form, setForm] = useState({ username: '', password: '' });
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (!pageSlug) return toast.error('Invalid page link');
        setLoading(true);
        try {
            const res = await kodiPageLogin({ pageSlug, username: form.username, password: form.password });
            const token = res?.data?.token;
            if (!token) throw new Error('Missing session token');
            setKodiPageToken(token);
            navigate(`/kodi/page/${pageSlug}`, { replace: true });
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 420, margin: '40px auto', padding: 16 }}>
            <h2>Kodi Page Login</h2>
            <p style={{ opacity: 0.8 }}>Page: <strong>{pageSlug}</strong></p>
            <form onSubmit={submit} style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                <input
                    value={form.username}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                    placeholder="Username"
                    autoComplete="username"
                />
                <input
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Password"
                    type="password"
                    autoComplete="current-password"
                />
                <button disabled={loading} type="submit" className="btn btn-primary">
                    {loading ? 'Signing in…' : 'Sign in'}
                </button>
            </form>
        </div>
    );
};

export default KodiLogin;
