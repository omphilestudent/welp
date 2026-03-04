const { Role } = require('../models');

const getAllRoles = async (req, res) => {
    try {
        const roles = await Role.findAll({ where: { isActive: true }, order: [['level', 'DESC']] });
        res.json(roles);
    } catch (error) {
        console.error('Get all roles error:', error);
        res.status(500).json({ error: 'Failed to fetch roles' });
    }
};

const createRole = async (req, res) => {
    try {
        const { name, description, permissions, level } = req.body;

        const existingRole = await Role.findOne({ where: { name } });
        if (existingRole) {
            return res.status(400).json({ error: 'Role already exists' });
        }

        const role = await Role.create({ name, description, permissions, level, isActive: true });
        res.status(201).json(role);
    } catch (error) {
        console.error('Create role error:', error);
        res.status(500).json({ error: 'Failed to create role' });
    }
};

const updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, permissions, level, isActive } = req.body;

        const role = await Role.findByPk(id);
        if (!role) {
            return res.status(404).json({ error: 'Role not found' });
        }

        await role.update({
            name: name || role.name,
            description: description || role.description,
            permissions: permissions || role.permissions,
            level: level || role.level,
            isActive: isActive !== undefined ? isActive : role.isActive
        });

        res.json(role);
    } catch (error) {
        console.error('Update role error:', error);
        res.status(500).json({ error: 'Failed to update role' });
    }
};

const deleteRole = async (req, res) => {
    try {
        const { id } = req.params;

        const role = await Role.findByPk(id);
        if (!role) {
            return res.status(404).json({ error: 'Role not found' });
        }

        const userCount = await role.countUsers();
        if (userCount > 0) {
            return res.status(400).json({ error: 'Cannot delete role that has users assigned' });
        }

        await role.destroy();
        res.json({ message: 'Role deleted successfully' });
    } catch (error) {
        console.error('Delete role error:', error);
        res.status(500).json({ error: 'Failed to delete role' });
    }
};

module.exports = { getAllRoles, createRole, updateRole, deleteRole };
