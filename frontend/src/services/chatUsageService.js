import api from './api';

export const fetchChatUsage = async () => {
    const { data } = await api.get('/messages/chat-usage');
    return data?.data || data;
};
