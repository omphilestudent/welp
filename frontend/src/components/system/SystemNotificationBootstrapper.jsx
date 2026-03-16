import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import {
    registerNotificationWorker,
    ensureNotificationPermission
} from '../../utils/systemNotifications';
import { updateNotificationPreference } from '../../services/notificationService';

const SystemNotificationBootstrapper = () => {
    const { isAuthenticated } = useAuth();
    const syncedStateRef = useRef(null);

    useEffect(() => {
        registerNotificationWorker();
    }, []);

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }
        let cancelled = false;
        const syncPermission = async () => {
            const permission = await ensureNotificationPermission({ request: true });
            if (cancelled || permission === 'unsupported') {
                return;
            }
            if (syncedStateRef.current === permission) {
                return;
            }
            syncedStateRef.current = permission;
            await updateNotificationPreference(permission);
            if (permission === 'denied') {
                toast.error('Enable notifications to receive alerts for messages and calls.');
            }
        };
        syncPermission();
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated]);

    return null;
};

export default SystemNotificationBootstrapper;
