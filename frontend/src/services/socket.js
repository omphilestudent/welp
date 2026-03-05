
import { io } from 'socket.io-client';

class SocketService {
    constructor() {
        this.socket = null;
    }

    connect(token) {
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const baseURL = API_URL.replace('/api', '');

        this.socket = io(baseURL, {
            auth: { token },
            transports: ['websocket'],
            withCredentials: true
        });

        this.socket.on('connect', () => {
            console.log('Socket connected');
        });

        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });

        return this.socket;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    joinConversation(conversationId) {
        if (this.socket) {
            this.socket.emit('join-conversation', conversationId);
        }
    }

    leaveConversation(conversationId) {
        if (this.socket) {
            this.socket.emit('leave-conversation', conversationId);
        }
    }

    sendMessage(conversationId, content) {
        if (this.socket) {
            this.socket.emit('send-message', { conversationId, content });
        }
    }

    onNewMessage(callback) {
        if (this.socket) {
            this.socket.on('new-message', callback);
        }
    }

    offNewMessage() {
        if (this.socket) {
            this.socket.off('new-message');
        }
    }

    onError(callback) {
        if (this.socket) {
            this.socket.on('error', callback);
        }
    }

    offError() {
        if (this.socket) {
            this.socket.off('error');
        }
    }
}

export default new SocketService();