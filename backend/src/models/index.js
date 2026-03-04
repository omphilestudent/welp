const sequelize = require('../config/database');
const User = require('./User');
const Role = require('./Role');

User.belongsTo(Role, { foreignKey: 'roleId' });
Role.hasMany(User, { foreignKey: 'roleId' });

User.belongsTo(User, { as: 'Creator', foreignKey: 'createdBy' });
User.belongsTo(User, { as: 'Updater', foreignKey: 'updatedBy' });

module.exports = {
    sequelize,
    User,
    Role
};
