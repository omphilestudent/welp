// src/companies/routes.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../auth/middleware');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');

const router = express.Router();
const prisma = new PrismaClient();

// Search companies
router.get('/search', async (req, res) => {
    try {
        const { query, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {};
        if (query) {
            where.OR = [
                { name: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
                { industry: { contains: query, mode: 'insensitive' } }
            ];
        }

        const companies = await prisma.company.findMany({
            where,
            include: {
                _count: {
                    select: {
                        reviews: true
                    }
                },
                reviews: {
                    take: 5,
                    orderBy: {
                        createdAt: 'desc'
                    },
                    select: {
                        rating: true
                    }
                }
            },
            skip,
            take: parseInt(limit),
            orderBy: {
                name: 'asc'
            }
        });

        // Calculate average ratings
        const companiesWithStats = companies.map(company => {
            const ratings = company.reviews.map(r => r.rating);
            const avgRating = ratings.length > 0
                ? ratings.reduce((a, b) => a + b, 0) / ratings.length
                : 0;

            return {
                ...company,
                avgRating: Math.round(avgRating * 10) / 10,
                reviewCount: company._count.reviews,
                reviews: undefined,
                _count: undefined
            };
        });

        const total = await prisma.company.count({ where });

        res.json({
            companies: companiesWithStats,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to search companies' });
    }
});

// Get company details
router.get('/:companyId', async (req, res) => {
    try {
        const { companyId } = req.params;

        const company = await prisma.company.findUnique({
            where: { id: companyId },
            include: {
                _count: {
                    select: {
                        reviews: true
                    }
                },
                reviews: {
                    take: 10,
                    orderBy: {
                        createdAt: 'desc'
                    },
                    select: {
                        rating: true
                    }
                },
                owners: {
                    select: {
                        id: true,
                        displayName: true
                    }
                }
            }
        });

        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }

        // Calculate average rating
        const ratings = company.reviews.map(r => r.rating);
        const avgRating = ratings.length > 0
            ? ratings.reduce((a, b) => a + b, 0) / ratings.length
            : 0;

        res.json({
            ...company,
            avgRating: Math.round(avgRating * 10) / 10,
            reviews: undefined
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch company' });
    }
});

// Create company (by employee)
router.post('/',
    authenticate,
    authorize('EMPLOYEE'),
    [
        body('name').isString().trim().isLength({ min: 2, max: 100 }),
        body('description').isString().trim().optional(),
        body('industry').isString().trim().optional(),
        body('website').isURL().optional(),
        body('email').isEmail().optional(),
        body('phone').isString().trim().optional(),
        body('address').isString().trim().optional()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        try {
            const companyData = req.body;

            // Check if company already exists
            const existingCompany = await prisma.company.findUnique({
                where: { name: companyData.name }
            });

            if (existingCompany) {
                return res.status(400).json({ error: 'Company already exists' });
            }

            const company = await prisma.company.create({
                data: {
                    ...companyData,
                    createdById: req.user.id,
                    isClaimed: false
                }
            });

            // Send email invitation to company email if provided
            if (companyData.email) {
                await sendClaimInvitation(companyData.email, company.name, company.id);
            }

            res.status(201).json(company);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to create company' });
        }
    }
);

// Claim company (by business)
router.post('/:companyId/claim',
    authenticate,
    authorize('BUSINESS'),
    async (req, res) => {
        try {
            const { companyId } = req.params;

            const company = await prisma.company.findUnique({
                where: { id: companyId }
            });

            if (!company) {
                return res.status(404).json({ error: 'Company not found' });
            }

            if (company.isClaimed) {
                return res.status(400).json({ error: 'Company already claimed' });
            }

            // Update company
            const updatedCompany = await prisma.company.update({
                where: { id: companyId },
                data: {
                    isClaimed: true,
                    owners: {
                        connect: { id: req.user.id }
                    }
                }
            });

            res.json(updatedCompany);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Failed to claim company' });
        }
    }
);

// Helper function to send claim invitation
async function sendClaimInvitation(email, companyName, companyId) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    const claimLink = `${process.env.FRONTEND_URL}/claim/${companyId}`;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Claim ${companyName} on Welp`,
        html: `
      <h1>Your Company Has Been Listed on Welp</h1>
      <p>Hello,</p>
      <p>Your company <strong>${companyName}</strong> has been listed on Welp - the employee wellbeing review platform.</p>
      <p>To claim your company profile and start managing reviews, click the link below:</p>
      <p><a href="${claimLink}">Claim ${companyName}</a></p>
      <p>If you didn't expect this email, please ignore it.</p>
      <p>Best regards,<br>The Welp Team</p>
    `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Failed to send email:', error);
    }
}

module.exports = router;