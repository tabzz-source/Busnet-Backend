const tripService = require('../../services/trip.service');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');

const searchTrips = asyncHandler(async (req, res) => {
    const result = await tripService.searchTrips(req.query);
    return successResponse(res, 200, 'Trips retrieved successfully', result);
});

const getTripDetail = asyncHandler(async (req, res) => {
    const result = await tripService.getTripDetail(req.params.id);
    return successResponse(res, 200, 'Trip detail retrieved successfully', result);
});

const getTripSeats = asyncHandler(async (req, res) => {
    const result = await tripService.getTripSeats(req.params.id);
    return successResponse(res, 200, 'Trip seats retrieved successfully', result);
});

module.exports = {
    searchTrips,
    getTripDetail,
    getTripSeats
};
