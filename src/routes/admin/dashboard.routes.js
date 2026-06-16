const express = require('express');
const adminDashboardController = require('../../controllers/admin/adminDashboard.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const { ADMIN } = require('../../constants/roles');

const router = express.Router();

router.use(protect, restrictTo(ADMIN));

router.get('/stats', adminDashboardController.getStats);

module.exports = router;
