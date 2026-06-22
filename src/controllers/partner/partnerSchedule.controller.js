const scheduleService = require('../../services/schedule.service');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');

const createSchedule = asyncHandler(async (req, res) => {
    const partnerId = req.user.id;
    const result = await scheduleService.createSchedule(partnerId, req.body);
    return successResponse(res, 201, 'Schedule created successfully', result);
});

const getSchedules = asyncHandler(async (req, res) => {
    const partnerId = req.user.id;
    const { page, limit } = req.query;
    const result = await scheduleService.getSchedulesByPartner(partnerId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20
    });
    return successResponse(res, 200, 'Schedules fetched successfully', result);
});

const getRoutes = asyncHandler(async (req, res) => {
    const partnerId = req.user.id;
    const routes = await scheduleService.getPartnerRoutes(partnerId);
    return successResponse(res, 200, 'Routes fetched successfully', routes);
});

const getBuses = asyncHandler(async (req, res) => {
    const partnerId = req.user.id;
    const buses = await scheduleService.getPartnerBuses(partnerId);
    return successResponse(res, 200, 'Buses fetched successfully', buses);
});

module.exports = { createSchedule, getSchedules, getRoutes, getBuses };
