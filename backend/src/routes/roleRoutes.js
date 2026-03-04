const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { authenticate, authorize } = require('../middleware/rbacAuth');

router.use(authenticate);

router.get('/', roleController.getAllRoles);
router.post('/', authorize('super_admin'), roleController.createRole);
router.put('/:id', authorize('super_admin'), roleController.updateRole);
router.delete('/:id', authorize('super_admin'), roleController.deleteRole);

module.exports = router;
