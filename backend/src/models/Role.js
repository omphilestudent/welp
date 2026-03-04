const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Role = sequelize.define('Role', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    description: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    permissions: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {}
    },
    level: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    timestamps: true
});

module.exports = Role;
