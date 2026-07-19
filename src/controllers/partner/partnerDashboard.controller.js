const partnerDashboardService = require('../../services/partnerDashboard.service');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');

const getStats = asyncHandler(async (req, res) => {
    const partnerId = req.user.id;
    const result = await partnerDashboardService.getPartnerStats(partnerId);
    return successResponse(res, 200, 'Partner dashboard stats fetched successfully', result);
});

const getRevenueChart = asyncHandler(async (req, res) => {
    const partnerId = req.user.id;
    const months = Number(req.query.months ?? 6);
    const result = await partnerDashboardService.getRevenueChart(partnerId, months);
    return successResponse(res, 200, 'Revenue chart data fetched successfully', result);
});

const getBookingStatusBreakdown = asyncHandler(async (req, res) => {
    const partnerId = req.user.id;
    const result = await partnerDashboardService.getBookingStatusBreakdown(partnerId);
    return successResponse(res, 200, 'Booking status breakdown fetched successfully', result);
});

const getRecentBookings = asyncHandler(async (req, res) => {
    const partnerId = req.user.id;
    const limit = Number(req.query.limit ?? 5);
    const result = await partnerDashboardService.getRecentBookings(partnerId, limit);
    return successResponse(res, 200, 'Recent bookings fetched successfully', result);
});

const getUpcomingTrips = asyncHandler(async (req, res) => {
    const partnerId = req.user.id;
    const limit = Number(req.query.limit ?? 5);
    const result = await partnerDashboardService.getUpcomingTrips(partnerId, limit);
    return successResponse(res, 200, 'Upcoming trips fetched successfully', result);
});

module.exports = { getStats, getRevenueChart, getBookingStatusBreakdown, getRecentBookings, getUpcomingTrips };
