const WORKER_PATH = '/notification-sw.js';
const DEFAULT_ICON = '/logo-2.png';
const DEFAULT_BADGE = '/logo-1.png';

let registrationPromise = null;

const hasWindow = () => typeof window !== 'undefined';
const hasNavigator = () => typeof navigator !== 'undefined';

export const isNotificationSupported = () => hasWindow() && 'Notification' in window;

export const registerNotificationWorker = async () => {
    if (!hasNavigator() || !('serviceWorker' in navigator)) {
        return null;
    }
    if (registrationPromise) {
        return registrationPromise;
    }
    registrationPromise = navigator.serviceWorker
        .register(WORKER_PATH)
        .catch((error) => {
            console.warn('Notification worker registration failed:', error);
            return null;
        });
    return registrationPromise;
};

export const ensureNotificationPermission = async ({ request = false } = {}) => {
    if (!isNotificationSupported()) {
        return 'unsupported';
    }
    let state = Notification.permission;
    if (state === 'default' && request) {
        try {
            state = await Notification.requestPermission();
        } catch {
            state = Notification.permission;
        }
    }
    return state;
};

const sendMessageToWorker = (payload) => {
    if (!hasNavigator() || !navigator.serviceWorker?.controller) {
        return false;
    }
    navigator.serviceWorker.controller.postMessage(payload);
    return true;
};

const normalizeMetadata = (metadata) => {
    if (!metadata) {
        return {};
    }
    if (typeof metadata === 'string') {
        try {
            return JSON.parse(metadata);
        } catch {
            return {};
        }
    }
    if (typeof metadata === 'object') {
        return metadata;
    }
    return {};
};

const buildNotificationPayload = (notification) => {
    if (!notification) return null;
    const type = (notification.type || '').toLowerCase();
    const metadata = normalizeMetadata(notification.metadata || notification.meta);
    const defaultTitle = notification.title || 'Welp';
    const base = {
        title: defaultTitle,
        body: notification.message || metadata.preview || 'You have a new notification.',
        data: {
            url: metadata.url || '/messages',
            conversationId: metadata.conversationId || notification.entity_id,
            ...metadata,
            notificationId: notification.id
        },
        tag: `welp-${type || 'notification'}-${notification.id || Date.now()}`
    };

    if (type === 'message') {
        base.title = metadata.senderName ? `${metadata.senderName} sent you a message` : 'New message';
        base.body = metadata.preview || notification.message || 'Open your inbox to view the message.';
    } else if (type === 'message_request') {
        base.title = 'New chat request';
        base.body = notification.message || 'Someone invited you to chat.';
    } else if (type === 'call_incoming') {
        const mediaLabel = metadata.mediaType || 'video';
        base.title = 'Incoming call';
        base.body = metadata.callerName
            ? `You have an incoming ${mediaLabel} call from ${metadata.callerName}.`
            : `You have an incoming ${mediaLabel} call.`;
        base.data.focus = 'call';
    } else if (type === 'call_missed') {
        base.title = 'Missed call';
        base.body = metadata.callerName
            ? `You missed a call from ${metadata.callerName}.`
            : 'You missed a call.';
    }

    return base;
};

export const displaySystemNotification = async ({
    title,
    body,
    data,
    tag,
    icon,
    badge,
    silent = false
}) => {
    if (!isNotificationSupported()) {
        return false;
    }
    if (Notification.permission !== 'granted') {
        return false;
    }
    const registration = await registerNotificationWorker();
    const nextTitle = title || 'Welp';
    const options = {
        body,
        data,
        tag,
        icon: icon || DEFAULT_ICON,
        badge: badge || DEFAULT_BADGE,
        renotify: true,
        silent,
        timestamp: Date.now()
    };
    if (registration?.showNotification) {
        await registration.showNotification(nextTitle, options);
        return true;
    }
    if (sendMessageToWorker({
        type: 'SHOW_NOTIFICATION',
        payload: {
            title: nextTitle,
            options
        }
    })) {
        return true;
    }
    new Notification(nextTitle, options); // eslint-disable-line no-new
    return true;
};

export const presentNotificationFromPayload = async (notification) => {
    const payload = buildNotificationPayload(notification);
    if (!payload) {
        return false;
    }
    return displaySystemNotification({
        title: payload.title,
        body: payload.body,
        data: payload.data,
        tag: payload.tag
    });
};
