// src/reviews/routes.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../auth/middleware');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const prisma = new PrismaClient();

// Create review
router.post('/',
    authenticate,
    authorize('EMPLOYEE'),
    [
        body('companyId').isString().notEmpty(),
        body('rating').isInt({ min: 1, max: 5 }),
        body('content').isString().trim().isLength({ min: 10, max: 2000 }),
        body('isPublic').isBoolean().optional()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { companyId, rating, content, isPublic = true } = req.body;

            // Check if company exists
            const company = await prisma.company.findUnique({
                where: { id: companyId }
            });

            if (!company) {
                return res.status(404).json({ error: 'Company not found' });
            }

            // Check if user already reviewed this company
            const existingReview = await prisma.review.findFirst({
                where: {
                    companyId,
                    authorId: req.user.id
                }
            });

            if (existingReview) {
                return res.status(400).json({ error: 'You have already reviewed this company' });
            }

            const review = await prisma.review.create({
                data: {
                    rating,
                    content,
                    isPublic,
                    companyId,
                    authorId: req.user.id
                },
                include: {
                    author: {
                        select: {
                            id: true,
                            displayName: true,
                            isAnonymous: true
                        }
                    },
                    company: {
                        select: {
                            id: true,
                            name: true,
                            logoUrl: true
                        }
                    }
                }
            });

            res.status(201).json(review);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to create review' });
        }
    }
);

// Get reviews for a company
router.get('/company/:companyId', async (req, res) => {
    try {
        const { companyId } = req.params;
        const { page = 1, limit = 20, sort = 'newest' } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        let orderBy = {};
        switch (sort) {
            case 'newest':
                orderBy = { createdAt: 'desc' };
                break;
            case 'oldest':
                orderBy = { createdAt: 'asc' };
                break;
            case 'highest':
                orderBy = { rating: 'desc' };
                break;
            case 'lowest':
                orderBy = { rating: 'asc' };
                break;
        }

        const reviews = await prisma.review.findMany({
            where: {
                companyId,
                isPublic: true
            },
            include: {
                author: {
                    select: {
                        id: true,
                        displayName: true,
                        isAnonymous: true
                    }
                },
                replies: {
                    include: {
                        author: {
                            select: {
                                id: true,
                                displayName: true,
                                role: true
                            }
                        }
                    }
                }
            },
            orderBy,
            skip,
            take: parseInt(limit)
        });

        const total = await prisma.review.count({
            where: {
                companyId,
                isPublic: true
            }
        });

        res.json({
            reviews,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

// Update review (within 24 hours)
router.patch('/:reviewId',
    authenticate,
    [
        body('content').isString().trim().isLength({ min: 10, max: 2000 }).optional(),
        body('rating').isInt({ min: 1, max: 5 }).optional(),
        body('isPublic').isBoolean().optional()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { reviewId } = req.params;
            const updateData = req.body;

            const review = await prisma.review.findUnique({
                where: { id: reviewId }
            });

            if (!review) {
                return res.status(404).json({ error: 'Review not found' });
            }

            // Check ownership
            if (review.authorId !== req.user.id) {
                return res.status(403).json({ error: 'Not authorized to update this review' });
            }

            // Check 24-hour window
            const now = new Date();
            const reviewAge = now - review.createdAt;
            const twentyFourHours = 24 * 60 * 60 * 1000;

            if (reviewAge > twentyFourHours) {
                return res.status(400).json({ error: 'Review can only be edited within 24 hours' });
            }

            const updatedReview = await prisma.review.update({
                where: { id: reviewId },
                data: {
                    ...updateData,
                    updatedAt: now
                },
                include: {
                    author: {
                        select: {
                            id: true,
                            displayName: true,
                            isAnonymous: true
                        }
                    }
                }
            });

            res.json(updatedReview);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to update review' });
        }
    }
);

// Delete review (within 24 hours)
router.delete('/:reviewId', authenticate, async (req, res) => {
    try {
        const { reviewId } = req.params;

        const review = await prisma.review.findUnique({
            where: { id: reviewId }
        });

        if (!review) {
            return res.status(404).json({ error: 'Review not found' });
        }

        // Check ownership
        if (review.authorId !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to delete this review' });
        }

        // Check 24-hour window
        const now = new Date();
        const reviewAge = now - review.createdAt;
        const twentyFourHours = 24 * 60 * 60 * 1000;

        if (reviewAge > twentyFourHours) {
            return res.status(400).json({ error: 'Review can only be deleted within 24 hours' });
        }

        await prisma.review.delete({
            where: { id: reviewId }
        });

        res.json({ message: 'Review deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete review' });
    }
});

// Add reply to review
router.post('/:reviewId/replies',
    authenticate,
    [
        body('content').isString().trim().isLength({ min: 1, max: 1000 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const { reviewId } = req.params;
            const { content } = req.body;

            const review = await prisma.review.findUnique({
                where: { id: reviewId }
            });

            if (!review) {
                return res.status(404).json({ error: 'Review not found' });
            }

            // Check if user can reply
            // Business can only reply to their own company's reviews
            if (req.user.role === 'BUSINESS') {
                const company = await prisma.company.findFirst({
                    where: {
                        id: review.companyId,
                        owners: {
                            some: {
                                id: req.user.id
                            }
                        }
                    }
                });

                if (!company) {
                    return res.status(403).json({ error: 'Not authorized to reply to this review' });
                }
            }

            const reply = await prisma.reply.create({
                data: {
                    content,
                    reviewId,
                    authorId: req.user.id,
                    authorRole: req.user.role
                },
                include: {
                    author: {
                        select: {
                            id: true,
                            displayName: true,
                            role: true
                        }
                    }
                }
            });

            res.status(201).json(reply);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to add reply' });
        }
    }
);

module.exports = router;