
import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '../../hooks/useAuth';
import { resolveMediaUrl } from '../../utils/media';

const ConversationList = ({ conversations, activeId, onSelect }) => {
    const { user } = useAuth();

    if (!conversations || conversations.length === 0) {
        return (
            <div className="empty-state">
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
        <div className="conversation-list">
            {conversations.map(conv => {
                const other = getOtherParticipant(conv);
                const lastMessage = conv.last_message;

                return (
                    <div
                        key={conv.id}
                        className={`conversation-item ${conv.id === activeId ? 'active' : ''}`}
                        onClick={() => onSelect(conv)}
                    >
                        <div className="conversation-avatar">
                            {other?.avatar_url ? (
                                <img src={resolveMediaUrl(other.avatar_url)} alt={other.display_name} />
                            ) : (
                                <div className="avatar-placeholder">
                                    {other?.display_name?.charAt(0) || '?'}
                                </div>
                            )}
                        </div>

                        <div className="conversation-info">
                            <h4 className="conversation-name">
                                {other?.display_name || 'Unknown'}
                                {conv.psychologist?.is_verified && (
                                    <span className="verified-badge" title="Verified Psychologist">✓</span>
                                )}
                            </h4>

                            {lastMessage && (
                                <p className="conversation-last-message">
                                    {lastMessage.content?.length > 50
                                        ? `${lastMessage.content.substring(0, 50)}...`
                                        : lastMessage.content}
                                </p>
                            )}

                            <span className="conversation-time">
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
