
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { FaTimes, FaUserMd, FaCheckCircle, FaComment } from 'react-icons/fa';
import { resolveMediaUrl } from '../../utils/media';

const ChatRequestModal = ({ isOpen, onClose, onSuccess }) => {
    const [psychologists, setPsychologists] = useState([]);
    const [selectedPsychologist, setSelectedPsychologist] = useState(null);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchPsychologists();
        }
    }, [isOpen]);

    const fetchPsychologists = async () => {
        setFetching(true);
        try {
            const { data } = await api.get('/messages/available-psychologists');
            setPsychologists(data || []);
        } catch (error) {
            console.error('Failed to load psychologists:', error);
            toast.error('Failed to load psychologists');
        } finally {
            setFetching(false);
        }
    };

    const handleSubmit = async () => {
        if (!selectedPsychologist) {
            toast.error('Please select a psychologist');
            return;
        }

        setLoading(true);
        try {
            await api.post('/messages/request-chat', {
                psychologistId: selectedPsychologist.id,
                initialMessage: message
            });
            toast.success('Chat request sent successfully!');
            onSuccess?.();
            onClose();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to send request');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <motion.div
                className="modal-content chat-request-modal"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
            >
                <div className="modal-header">
                    <h2>Request Chat with Psychologist</h2>
                    <button className="close-btn" onClick={onClose}>
                        <FaTimes />
                    </button>
                </div>

                <div className="modal-body">
                    {fetching ? (
                        <div className="loading-inline">
                            <span className="spinner" aria-hidden="true"></span>
                            <span>Loading psychologists...</span>
                        </div>
                    ) : (
                        <>
                            <div className="psychologists-list">
                                <h3>Available Psychologists</h3>
                                {psychologists.length === 0 ? (
                                    <p className="no-psychologists">No psychologists available at the moment</p>
                                ) : (
                                    psychologists.map(psych => (
                                        <div
                                            key={psych.id}
                                            className={`psychologist-card ${selectedPsychologist?.id === psych.id ? 'selected' : ''}`}
                                            onClick={() => setSelectedPsychologist(psych)}
                                        >
                                            <div className="psychologist-avatar">
                                                {psych.avatar_url ? (
                                                    <img src={resolveMediaUrl(psych.avatar_url)} alt={psych.display_name} />
                                                ) : (
                                                    <div className="avatar-placeholder">
                                                        {psych.display_name?.charAt(0) || 'P'}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="psychologist-info">
                                                <h4>
                                                    {psych.display_name || 'Unknown'}
                                                    {psych.is_verified && (
                                                        <FaCheckCircle className="verified-badge" title="Verified" />
                                                    )}
                                                </h4>
                                                <p className="specialization">
                                                    {psych.specialization?.slice(0, 3).join(' • ') || 'General Psychology'}
                                                </p>
                                                <p className="experience">{psych.years_of_experience || 0} years experience</p>
                                            </div>
                                            {selectedPsychologist?.id === psych.id && (
                                                <FaCheckCircle className="selected-icon" />
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            {selectedPsychologist && (
                                <div className="message-section">
                                    <h3>Send a Message (Optional)</h3>
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Introduce yourself and explain why you'd like to chat..."
                                        className="form-textarea"
                                        rows="4"
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="modal-footer">
                    <button onClick={onClose} className="btn btn-secondary">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!selectedPsychologist || loading}
                        className="btn btn-primary"
                    >
                        <FaComment /> {loading ? 'Sending...' : 'Send Request'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default ChatRequestModal;
