// frontend/src/services/socket.js
import { io } from 'socket.io-client';

class SocketService {
    constructor() {
        this.socket = null;
    }

    connect(token) {
        this.socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
            auth: { token },
            transports: ['websocket'],
        });

        this.socket.on('connect', () => {
            console.log('Socket connected');
        });

        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
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
}

export default new SocketService();