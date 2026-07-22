const express = require('express');
const adminDashboardController = require('../../controllers/admin/adminDashboard.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const { ADMIN } = require('../../constants/roles');

const router = express.Router();

router.use(protect, restrictTo(ADMIN));

router.get('/stats', adminDashboardController.getStats);
router.get('/revenue-chart', adminDashboardController.getRevenueChart);
router.get('/revenue-breakdown', adminDashboardController.getRevenueBreakdown);
router.get('/export', adminDashboardController.exportStatistics);

module.exports = router;
