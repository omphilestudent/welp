import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../hooks/useAuth';
import './RemotePin.css';

const RemotePinVerify = () => {
    const navigate = useNavigate();
    const { pinStatus, checkAuth } = useAuth();
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const pinPolicy = useMemo(() => pinStatus?.policy || { minLength: 4, maxLength: 6 }, [pinStatus]);
    useEffect(() => {
        if (pinStatus?.setupRequired) {
            navigate('/remote-pin/setup', { replace: true });
        }
        if (pinStatus?.verified) {
            const redirect = sessionStorage.getItem('welp_pin_redirect') || '/dashboard';
            navigate(redirect, { replace: true });
        }
    }, [pinStatus, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (pin.length < pinPolicy.minLength || pin.length > pinPolicy.maxLength) {
            toast.error(`Remote PIN must be ${pinPolicy.minLength}-${pinPolicy.maxLength} digits`);
            return;
        }

        setLoading(true);
        try {
            const { data } = await api.post('/auth/remote-pin/verify', { pin });
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
            toast.success('Remote PIN verified');
            const redirect = sessionStorage.getItem('welp_pin_redirect') || '/dashboard';
            sessionStorage.removeItem('welp_pin_redirect');
            navigate(redirect, { replace: true });
        } catch (error) {
            const message = error?.response?.data?.error || 'Remote PIN verification failed';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="remote-pin-page">
            <div className="remote-pin-card">
                <h1>Verify Remote PIN</h1>
                <p>Enter your Remote PIN to continue.</p>

                <form onSubmit={handleSubmit} className="remote-pin-form">
                    <label>
                        Remote PIN
                        <input
                            type="password"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={pin}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                            maxLength={pinPolicy.maxLength}
                            required
                        />
                    </label>

                    <button type="submit" disabled={loading}>
                        {loading ? 'Verifying…' : 'Verify PIN'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default RemotePinVerify;
