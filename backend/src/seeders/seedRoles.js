'use strict';

module.exports = {
    up: async (queryInterface) => {
        const roles = [
            {
                name: 'super_admin',
                description: 'Super Administrator with full system access',
                level: 100,
                permissions: {
                    users: ['create', 'read', 'update', 'delete', 'manage_roles'],
                    companies: ['create', 'read', 'update', 'delete', 'verify'],
                    reviews: ['create', 'read', 'update', 'delete', 'moderate'],
                    pricing: ['create', 'read', 'update', 'delete'],
                    settings: ['read', 'update'],
                    reports: ['create', 'read', 'export'],
                    hr: ['create', 'read', 'update', 'delete']
                },
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'recruiter',
                description: 'HR Recruiter - manages job postings and candidates',
                level: 50,
                permissions: {
                    jobs: ['create', 'read', 'update', 'delete'],
                    applications: ['create', 'read', 'update'],
                    candidates: ['create', 'read', 'update'],
                    interviews: ['create', 'read', 'update'],
                    reports: ['read', 'export']
                },
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'customer_service',
                description: 'Customer Service Representative',
                level: 30,
                permissions: {
                    users: ['read', 'update_basic'],
                    companies: ['read', 'update_basic'],
                    reviews: ['read', 'flag'],
                    tickets: ['create', 'read', 'update']
                },
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'standard_user',
                description: 'Regular platform user',
                level: 10,
                permissions: {
                    profile: ['read', 'update'],
                    reviews: ['create', 'read', 'update', 'delete'],
                    companies: ['read'],
                    bookmarks: ['create', 'read', 'delete']
                },
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'back_office',
                description: 'Back Office Operations',
                level: 40,
                permissions: {
                    users: ['read'],
                    companies: ['read', 'verify'],
                    payments: ['read', 'process'],
                    subscriptions: ['read', 'update'],
                    reports: ['read', 'export']
                },
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'tech_team',
                description: 'Development Team',
                level: 80,
                permissions: {
                    system: ['read', 'update'],
                    logs: ['read'],
                    users: ['read'],
                    settings: ['read', 'update']
                },
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                name: 'data_analyst',
                description: 'Data Analysis Team',
                level: 60,
                permissions: {
                    reports: ['create', 'read', 'export'],
                    analytics: ['read', 'export'],
                    data: ['read', 'export']
                },
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];

        await queryInterface.bulkInsert('Roles', roles, {});
    },

    down: async (queryInterface) => {
        await queryInterface.bulkDelete('Roles', null, {});
    }
};
