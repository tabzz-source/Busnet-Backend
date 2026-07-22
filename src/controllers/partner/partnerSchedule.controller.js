const scheduleService = require('../../services/schedule.service');
const ticketPriceService = require('../../services/ticketPrice.service');
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

const getScheduleDetail = asyncHandler(async (req, res) => {
    const partnerId = req.user.id;
    const { id } = req.params;
    const result = await scheduleService.getScheduleById(partnerId, id);
    return successResponse(res, 200, 'Schedule fetched successfully', result);
});

const getScheduleTicketPrices = asyncHandler(async (req, res) => {
    const partnerId = req.user.id;
    const { id } = req.params;
    const result = await ticketPriceService.getTicketPricesBySchedule(partnerId, id, req.query);
    return successResponse(res, 200, 'Schedule ticket prices fetched successfully', result);
});

const getScheduleTicketPriceDetail = asyncHandler(async (req, res) => {
    const partnerId = req.user.id;
    const { id: scheduleId, ticketPriceId } = req.params;
    const result = await ticketPriceService.getTicketPriceDetail(partnerId, scheduleId, ticketPriceId);
    return successResponse(res, 200, 'Ticket price detail fetched successfully', result);
});

const setScheduleTicketPrice = asyncHandler(async (req, res) => {
    const partnerId = req.user.id;
    const { id: scheduleId, ticketPriceId = null } = req.params;
    const result = await ticketPriceService.setTicketPrice(
        partnerId,
        scheduleId,
        ticketPriceId,
        req.body
    );

    const statusCode = result.created ? 201 : 200;
    const message = result.created
        ? 'Ticket price created successfully'
        : 'Ticket price updated successfully';
    return successResponse(res, statusCode, message, result);
});

const updateSchedule = asyncHandler(async (req, res) => {
    const partnerId = req.user.id;
    const { id } = req.params;
    const result = await scheduleService.updateSchedule(partnerId, id, req.body);
    return successResponse(res, 200, 'Schedule updated successfully', result);
});

const deleteSchedule = asyncHandler(async (req, res) => {
    const partnerId = req.user.id;
    const { id } = req.params;
    const result = await scheduleService.deleteSchedule(partnerId, id);
    return successResponse(res, 200, 'Schedule deleted successfully', result);
});

module.exports = {
    createSchedule,
    getSchedules,
    getScheduleDetail,
    getScheduleTicketPrices,
    getScheduleTicketPriceDetail,
    setScheduleTicketPrice,
    updateSchedule,
    deleteSchedule,
    getRoutes,
    getBuses
};
