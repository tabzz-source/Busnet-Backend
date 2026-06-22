const express = require('express');
const dashboardController = require('../../controllers/partner/partnerDashboard.controller');
const authenticate = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const { PARTNER } = require('../../constants/roles');

const router = express.Router();

router.get('/stats', authenticate, restrictTo(PARTNER), dashboardController.getStats);
router.get('/revenue-chart', authenticate, restrictTo(PARTNER), dashboardController.getRevenueChart);
router.get('/booking-status', authenticate, restrictTo(PARTNER), dashboardController.getBookingStatusBreakdown);
router.get('/recent-bookings', authenticate, restrictTo(PARTNER), dashboardController.getRecentBookings);
router.get('/upcoming-trips', authenticate, restrictTo(PARTNER), dashboardController.getUpcomingTrips);

module.exports = router;
