// src/messages/routes.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../auth/middleware');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const prisma = new PrismaClient();

// Psychologist: Send message request to employee
router.post('/conversations/request',
    authenticate,
    authorize('PSYCHOLOGIST'),
    [
        body('employeeId').isString().notEmpty(),
        body('initialMessage').isString().trim().isLength({ min: 1, max: 500 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { employeeId, initialMessage } = req.body;

            // Check if employee exists and is an employee
            const employee = await prisma.user.findUnique({
                where: {
                    id: employeeId,
                    role: 'EMPLOYEE'
                }
            });

            if (!employee) {
                return res.status(404).json({ error: 'Employee not found' });
            }

            // Check if conversation already exists
            const existingConversation = await prisma.conversation.findFirst({
                where: {
                    employeeId,
                    psychologistId: req.user.id
                }
            });

            if (existingConversation) {
                return res.status(400).json({ error: 'Conversation already exists' });
            }

            // Create conversation with initial message
            const conversation = await prisma.conversation.create({
                data: {
                    employeeId,
                    psychologistId: req.user.id,
                    status: 'PENDING',
                    messages: {
                        create: {
                            content: initialMessage,
                            senderId: req.user.id
                        }
                    }
                },
                include: {
                    messages: {
                        orderBy: {
                            createdAt: 'asc'
                        },
                        include: {
                            sender: {
                                select: {
                                    id: true,
                                    displayName: true,
                                    role: true
                                }
                            }
                        }
                    }
                }
            });

            res.status(201).json(conversation);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to send message request' });
        }
    }
);

// Employee: Get pending conversation requests
router.get('/conversations/pending',
    authenticate,
    authorize('EMPLOYEE'),
    async (req, res) => {
        try {
            const conversations = await prisma.conversation.findMany({
                where: {
                    employeeId: req.user.id,
                    status: 'PENDING'
                },
                include: {
                    psychologist: {
                        select: {
                            id: true,
                            displayName: true,
                            avatarUrl: true
                        }
                    },
                    messages: {
                        take: 1,
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            res.json(conversations);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch conversations' });
        }
    }
);

// Employee: Accept or reject conversation
router.patch('/conversations/:conversationId/status',
    authenticate,
    authorize('EMPLOYEE'),
    [
        body('status').isIn(['ACCEPTED', 'REJECTED', 'BLOCKED'])
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { conversationId } = req.params;
            const { status } = req.body;

            const conversation = await prisma.conversation.findUnique({
                where: { id: conversationId }
            });

            if (!conversation) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            // Check ownership
            if (conversation.employeeId !== req.user.id) {
                return res.status(403).json({ error: 'Not authorized' });
            }

            const updatedConversation = await prisma.conversation.update({
                where: { id: conversationId },
                data: { status }
            });

            res.json(updatedConversation);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to update conversation status' });
        }
    }
);

// Get messages for a conversation
router.get('/conversations/:conversationId/messages',
    authenticate,
    async (req, res) => {
        try {
            const { conversationId } = req.params;

            const conversation = await prisma.conversation.findUnique({
                where: { id: conversationId },
                include: {
                    employee: {
                        select: {
                            id: true,
                            displayName: true
                        }
                    },
                    psychologist: {
                        select: {
                            id: true,
                            displayName: true
                        }
                    }
                }
            });

            if (!conversation) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            // Check authorization
            const isParticipant = conversation.employeeId === req.user.id ||
                conversation.psychologistId === req.user.id;

            if (!isParticipant) {
                return res.status(403).json({ error: 'Not authorized' });
            }

            const messages = await prisma.message.findMany({
                where: { conversationId },
                include: {
                    sender: {
                        select: {
                            id: true,
                            displayName: true,
                            role: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'asc'
                }
            });

            res.json({
                conversation,
                messages
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch messages' });
        }
    }
);

// Send message in a conversation
router.post('/conversations/:conversationId/messages',
    authenticate,
    [
        body('content').isString().trim().isLength({ min: 1, max: 2000 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { conversationId } = req.params;
            const { content } = req.body;

            const conversation = await prisma.conversation.findUnique({
                where: { id: conversationId }
            });

            if (!conversation) {
                return res.status(404).json({ error: 'Conversation not found' });
            }

            // Check authorization and conversation status
            const isParticipant = conversation.employeeId === req.user.id ||
                conversation.psychologistId === req.user.id;

            if (!isParticipant) {
                return res.status(403).json({ error: 'Not authorized' });
            }

            if (conversation.status !== 'ACCEPTED') {
                return res.status(400).json({ error: 'Conversation not accepted yet' });
            }

            const message = await prisma.message.create({
                data: {
                    content,
                    conversationId,
                    senderId: req.user.id
                },
                include: {
                    sender: {
                        select: {
                            id: true,
                            displayName: true,
                            role: true
                        }
                    }
                }
            });

            res.status(201).json(message);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to send message' });
        }
    }
);

// Get user's conversations
router.get('/conversations',
    authenticate,
    async (req, res) => {
        try {
            let whereClause;

            if (req.user.role === 'EMPLOYEE') {
                whereClause = {
                    employeeId: req.user.id,
                    status: 'ACCEPTED'
                };
            } else if (req.user.role === 'PSYCHOLOGIST') {
                whereClause = {
                    psychologistId: req.user.id,
                    status: 'ACCEPTED'
                };
            } else {
                return res.status(403).json({ error: 'Not authorized' });
            }

            const conversations = await prisma.conversation.findMany({
                where: whereClause,
                include: {
                    employee: {
                        select: {
                            id: true,
                            displayName: true,
                            avatarUrl: true
                        }
                    },
                    psychologist: {
                        select: {
                            id: true,
                            displayName: true,
                            avatarUrl: true
                        }
                    },
                    messages: {
                        take: 1,
                        orderBy: {
                            createdAt: 'desc'
                        },
                        include: {
                            sender: {
                                select: {
                                    id: true,
                                    displayName: true
                                }
                            }
                        }
                    }
                },
                orderBy: {
                    updatedAt: 'desc'
                }
            });

            res.json(conversations);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to fetch conversations' });
        }
    }
);

module.exports = router;