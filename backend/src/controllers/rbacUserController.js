const { User, Role } = require('../models');
const { Op } = require('sequelize');

const getAllUsers = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            roleId,
            department,
            isActive,
            sortBy = 'createdAt',
            sortOrder = 'DESC'
        } = req.query;

        const offset = (page - 1) * limit;
        const where = {};

        if (search) {
            where[Op.or] = [
                { firstName: { [Op.iLike]: `%${search}%` } },
                { lastName: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } }
            ];
        }

        if (roleId) where.roleId = roleId;
        if (department) where.department = department;
        if (isActive !== undefined && isActive !== '') where.isActive = isActive === 'true';

        const users = await User.findAndCountAll({
            where,
            include: [
                {
                    model: Role,
                    attributes: ['id', 'name', 'description', 'level', 'permissions']
                },
                {
                    model: User,
                    as: 'Creator',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                }
            ],
            attributes: { exclude: ['password'] },
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10),
            order: [[sortBy, sortOrder]]
        });

        res.json({
            users: users.rows,
            total: users.count,
            currentPage: parseInt(page, 10),
            totalPages: Math.ceil(users.count / limit)
        });
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findByPk(id, {
            include: [
                { model: Role, attributes: ['id', 'name', 'description', 'level', 'permissions'] },
                { model: User, as: 'Creator', attributes: ['id', 'firstName', 'lastName', 'email'] },
                { model: User, as: 'Updater', attributes: ['id', 'firstName', 'lastName', 'email'] }
            ],
            attributes: { exclude: ['password'] }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json(user);
    } catch (error) {
        console.error('Get user by ID error:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
};

const createUser = async (req, res) => {
    try {
        const {
            email,
            password,
            firstName,
            lastName,
            roleId,
            department,
            phoneNumber,
            isActive = true
        } = req.body;

        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) return res.status(400).json({ error: 'Email already registered' });

        const role = await Role.findByPk(roleId);
        if (!role) return res.status(400).json({ error: 'Invalid role' });

        if (role.name === 'super_admin' && req.user.Role.name !== 'super_admin') {
            return res.status(403).json({ error: 'Only super admins can create super admin accounts' });
        }

        if (role.level >= req.user.Role.level && req.user.Role.name !== 'super_admin') {
            return res.status(403).json({ error: 'Insufficient privileges to create users with this role' });
        }

        const user = await User.create({
            email,
            password,
            firstName,
            lastName,
            roleId,
            department,
            phoneNumber,
            isActive,
            createdBy: req.user.id,
            emailVerified: true
        });

        const createdUser = await User.findByPk(user.id, {
            include: [{ model: Role, attributes: ['id', 'name', 'description'] }],
            attributes: { exclude: ['password'] }
        });

        res.status(201).json({ message: 'User created successfully', user: createdUser });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
};

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, roleId, department, phoneNumber, isActive, emailVerified } = req.body;

        const user = await User.findByPk(id, { include: [{ model: Role }] });
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (roleId && Number(roleId) !== Number(user.roleId)) {
            const newRole = await Role.findByPk(roleId);
            if (!newRole) return res.status(400).json({ error: 'Invalid role' });

            if (newRole.level >= req.user.Role.level && req.user.Role.name !== 'super_admin') {
                return res.status(403).json({ error: 'Cannot assign roles with higher privileges' });
            }

            if (user.Role.name === 'super_admin' && req.user.Role.name !== 'super_admin') {
                return res.status(403).json({ error: 'Cannot modify super admin accounts' });
            }
        }

        await user.update({
            firstName: firstName || user.firstName,
            lastName: lastName || user.lastName,
            roleId: roleId || user.roleId,
            department: department || user.department,
            phoneNumber: phoneNumber || user.phoneNumber,
            isActive: isActive !== undefined ? isActive : user.isActive,
            emailVerified: emailVerified !== undefined ? emailVerified : user.emailVerified,
            updatedBy: req.user.id
        });

        const updatedUser = await User.findByPk(id, {
            include: [{ model: Role, attributes: ['id', 'name', 'description', 'permissions'] }],
            attributes: { exclude: ['password'] }
        });

        res.json({ message: 'User updated successfully', user: updatedUser });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findByPk(id, { include: [{ model: Role }] });
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (Number(user.id) === Number(req.user.id)) return res.status(400).json({ error: 'Cannot delete your own account' });

        if (user.Role.name === 'super_admin' && req.user.Role.name !== 'super_admin') {
            return res.status(403).json({ error: 'Cannot delete super admin accounts' });
        }

        if (user.Role.level >= req.user.Role.level && req.user.Role.name !== 'super_admin') {
            return res.status(403).json({ error: 'Cannot delete users with equal or higher privileges' });
        }

        await user.destroy();

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};

const bulkDeleteUsers = async (req, res) => {
    try {
        const { userIds } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ error: 'Invalid user IDs' });
        }

        if (userIds.map(Number).includes(Number(req.user.id))) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        const users = await User.findAll({ where: { id: userIds }, include: [{ model: Role }] });

        for (const user of users) {
            if (user.Role.name === 'super_admin' && req.user.Role.name !== 'super_admin') {
                return res.status(403).json({ error: 'Cannot delete super admin accounts' });
            }
            if (user.Role.level >= req.user.Role.level && req.user.Role.name !== 'super_admin') {
                return res.status(403).json({ error: 'Cannot delete users with equal or higher privileges' });
            }
        }

        await User.destroy({ where: { id: userIds } });

        res.json({ message: `${userIds.length} users deleted successfully`, deletedCount: userIds.length });
    } catch (error) {
        console.error('Bulk delete users error:', error);
        res.status(500).json({ error: 'Failed to delete users' });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }

        const user = await User.findByPk(id, { include: [{ model: Role }] });
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.Role.level >= req.user.Role.level && req.user.Role.name !== 'super_admin') {
            return res.status(403).json({ error: 'Cannot reset password for users with equal or higher privileges' });
        }

        await user.update({ password: newPassword });

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
};

const getAvailableRoles = async (req, res) => {
    try {
        if (req.user.Role.name === 'super_admin') {
            const allRoles = await Role.findAll({ where: { isActive: true }, order: [['level', 'DESC']] });
            return res.json(allRoles);
        }

        const roles = await Role.findAll({
            where: {
                level: { [Op.lt]: req.user.Role.level },
                isActive: true
            },
            order: [['level', 'DESC']]
        });

        res.json(roles);
    } catch (error) {
        console.error('Get available roles error:', error);
        res.status(500).json({ error: 'Failed to fetch roles' });
    }
};

const getDepartments = async (req, res) => {
    try {
        const departments = await User.findAll({
            attributes: ['department'],
            where: { department: { [Op.ne]: null } },
            group: ['department']
        });

        res.json(departments.map((d) => d.department));
    } catch (error) {
        console.error('Get departments error:', error);
        res.status(500).json({ error: 'Failed to fetch departments' });
    }
};

module.exports = {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    bulkDeleteUsers,
    resetPassword,
    getAvailableRoles,
    getDepartments
};
