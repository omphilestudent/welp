import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Loading from '../../components/common/Loading';
import { acceptPortalInvite } from '../../services/kodiPortalService';

const KodiInviteAccept = () => {
    const [params] = useSearchParams();
    const [status, setStatus] = useState('loading');
    const token = params.get('token');

    useEffect(() => {
        const run = async () => {
            if (!token) {
                setStatus('missing');
                return;
            }
            try {
                await acceptPortalInvite({ token });
                setStatus('accepted');
            } catch (error) {
                toast.error(error?.response?.data?.error || 'Failed to accept invite');
                setStatus('error');
            }
        };
        run();
    }, [token]);

    if (status === 'loading') return <Loading />;

    return (
        <div className="kodi-runtime">
            {status === 'accepted' && (
                <>
                    <p>Invitation accepted. You can now access your app.</p>
                    <a className="btn-primary" href="/kodi-auth/sign-in">Go to Kodi sign-in</a>
                </>
            )}
            {status === 'missing' && <p>Missing invitation token.</p>}
            {status === 'error' && <p>Unable to accept invitation.</p>}
        </div>
    );
};

export default KodiInviteAccept;
