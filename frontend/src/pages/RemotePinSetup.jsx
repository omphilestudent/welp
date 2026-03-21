import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import './RemotePin.css';

const RemotePinSetup = () => {
    const navigate = useNavigate();
    const { pinStatus, checkAuth } = useAuth();
    const [form, setForm] = useState({ pin: '', confirmPin: '' });
    const [loading, setLoading] = useState(false);

    const pinPolicy = useMemo(() => pinStatus?.policy || { minLength: 4, maxLength: 6 }, [pinStatus]);

    useEffect(() => {
        if (pinStatus?.required && !pinStatus?.setupRequired && !pinStatus?.verified) {
            navigate('/remote-pin/verify', { replace: true });
        }
        if (pinStatus?.verified) {
            const redirect = sessionStorage.getItem('welp_pin_redirect') || '/dashboard';
            navigate(redirect, { replace: true });
        }
    }, [pinStatus, navigate]);

    const handleChange = (field) => (e) => {
        const value = e.target.value.replace(/\D/g, '');
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.pin !== form.confirmPin) {
            toast.error('Remote PINs do not match');
            return;
        }
        if (form.pin.length < pinPolicy.minLength || form.pin.length > pinPolicy.maxLength) {
            toast.error(`Remote PIN must be ${pinPolicy.minLength}-${pinPolicy.maxLength} digits`);
            return;
        }

        setLoading(true);
        try {
            const { data } = await api.post('/auth/remote-pin/setup', {
                pin: form.pin,
                confirmPin: form.confirmPin
            });

            if (data?.token) {
                const existingLocal = localStorage.getItem('token');
                if (existingLocal) {
                    localStorage.setItem('token', data.token);
                } else {
                    sessionStorage.setItem('token', data.token);
                }
                api.defaults.headers.common.Authorization = `Bearer ${data.token}`;
            }

            await checkAuth?.();
            toast.success('Remote PIN created');

            const redirect = sessionStorage.getItem('welp_pin_redirect') || '/dashboard';
            sessionStorage.removeItem('welp_pin_redirect');
            navigate(redirect, { replace: true });
        } catch (error) {
            const message = error?.response?.data?.error || 'Failed to set Remote PIN';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="remote-pin-page">
            <div className="remote-pin-card">
                <h1>Set your Remote PIN</h1>
                <p>Enter a {pinPolicy.minLength}-{pinPolicy.maxLength} digit PIN to secure your account.</p>

                <form onSubmit={handleSubmit} className="remote-pin-form">
                    <label>
                        Create PIN
                        <input
                            type="password"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={form.pin}
                            onChange={handleChange('pin')}
                            maxLength={pinPolicy.maxLength}
                            required
                        />
                    </label>

                    <label>
                        Confirm PIN
                        <input
                            type="password"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={form.confirmPin}
                            onChange={handleChange('confirmPin')}
                            maxLength={pinPolicy.maxLength}
                            required
                        />
                    </label>

                    <button type="submit" disabled={loading}>
                        {loading ? 'Saving…' : 'Save PIN'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default RemotePinSetup;
