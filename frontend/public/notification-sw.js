const resolveTargetUrl = (url) => {
    if (!url) {
        return self.location.origin + '/messages';
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    if (url.startsWith('/')) {
        return self.location.origin + url;
    }
    return new URL(url, self.location.origin).href;
};

const showNotification = ({ title, options }) => {
    if (!title) return Promise.resolve();
    const opts = {
        timestamp: Date.now(),
        ...options
    };
    return self.registration.showNotification(title, opts);
};

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
    const payload = event.data;
    if (!payload || payload.type !== 'SHOW_NOTIFICATION') return;
    event.waitUntil(showNotification(payload.payload || {}));
});

self.addEventListener('push', (event) => {
    let payload;
    try {
        payload = event.data?.json() || {};
    } catch (error) {
        payload = {
            title: 'Welp',
            options: { body: event.data?.text() || 'You have a new notification.' }
        };
    }
    if (!payload.title) {
        payload.title = 'Welp';
    }
    event.waitUntil(showNotification(payload));
});

self.addEventListener('notificationclick', (event) => {
    const targetUrl = resolveTargetUrl(event.notification?.data?.url);
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url === targetUrl) {
                    return client.focus();
                }
            }
            if (targetUrl) {
                return self.clients.openWindow(targetUrl);
            }
            return null;
        })
    );
});
