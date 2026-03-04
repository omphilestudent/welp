const express = require('express');
const router = express.Router();
const userController = require('../controllers/rbacUserController');
const { authenticate, authorize, checkPermission } = require('../middleware/rbacAuth');

router.use(authenticate);

router.get('/', authorize('super_admin', 'back_office', 'tech_team'), userController.getAllUsers);
router.get('/roles/available', userController.getAvailableRoles);
router.get('/departments', authorize('super_admin', 'recruiter'), userController.getDepartments);
router.get('/:id', authorize('super_admin', 'back_office'), userController.getUserById);

router.post('/', authorize('super_admin', 'recruiter'), checkPermission('users', 'create'), userController.createUser);
router.put('/:id', authorize('super_admin', 'recruiter'), checkPermission('users', 'update'), userController.updateUser);
router.delete('/:id', authorize('super_admin'), checkPermission('users', 'delete'), userController.deleteUser);
router.post('/bulk-delete', authorize('super_admin'), checkPermission('users', 'delete'), userController.bulkDeleteUsers);
router.post('/:id/reset-password', authorize('super_admin', 'recruiter'), userController.resetPassword);

module.exports = router;
