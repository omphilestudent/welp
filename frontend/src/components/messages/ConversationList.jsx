
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import AvatarImage from '../common/AvatarImage';

const ConversationList = ({ conversations, activeId, onSelect }) => {
    const { user } = useAuth();

    if (!conversations || conversations.length === 0) {
        return (
            <div className="msg-empty-state">
                <p>No conversations yet</p>
            </div>
        );
    }

    const getOtherParticipant = (conversation) => {
        if (conversation.employee?.id === user?.id) {
            return conversation.psychologist;
        }
        return conversation.employee;
    };

    return (
        <div className="msg-conv-list">
            {conversations.map(conv => {
                const other = getOtherParticipant(conv);
                const lastMessage = conv.last_message;

                return (
                    <div
                        key={conv.id}
                        className={`msg-conv-item ${conv.id === activeId ? 'active' : ''}`}
                        onClick={() => onSelect(conv)}
                    >
                        <div className="msg-conv-avatar">
                            {other?.avatar_url ? (
                                <AvatarImage src={other.avatar_url} alt={other?.display_name || 'Conversation participant'} />
                            ) : (
                                <div className="msg-avatar-placeholder">
                                    {other?.display_name?.charAt(0) || '?'}
                                </div>
                            )}
                        </div>

                        <div className="msg-conv-info">
                            <h4 className="msg-conv-name">
                                {other?.display_name || 'Unknown'}
                                {conv.psychologist?.is_verified && (
                                    <span className="msg-verified-badge" title="Verified Psychologist">✓</span>
                                )}
                            </h4>

                            {lastMessage && (
                                <p className="msg-conv-last-message">
                                    {lastMessage.content?.length > 50
                                        ? `${lastMessage.content.substring(0, 50)}...`
                                        : lastMessage.content}
                                </p>
                            )}

                            <span className="msg-conv-time">
                {lastMessage && formatDistanceToNow(new Date(lastMessage.createdAt))} ago
              </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ConversationList;

