const tripService = require('../../services/trip.service');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');

/**
 * GET /api/customer/trips
 * Search for available trips matching criteria
 */
const searchTrips = asyncHandler(async (req, res) => {
    const {
        from,
        to,
        date,
        departureTimes,
        operators,
        busTypes,
        minPrice,
        maxPrice,
        sortBy,
        page,
        limit
    } = req.query;

    // Helper to format arrays from query parameters
    const parseArrayParam = (val) => {
        if (!val) return undefined;
        return Array.isArray(val) ? val : val.split(',');
    };

    const queryParams = {
        from,
        to,
        date,
        departureTimes: parseArrayParam(departureTimes),
        operators: parseArrayParam(operators),
        busTypes: parseArrayParam(busTypes),
        minPrice,
        maxPrice,
        sortBy,
        page,
        limit
    };

    const result = await tripService.searchTrips(queryParams);

    return successResponse(res, 200, 'Trips retrieved successfully', result);
});

const getLocations = asyncHandler(async (req, res) => {
    const result = await tripService.getLocations();
    return successResponse(res, 200, 'Locations retrieved successfully', result);
});

const getTripDetail = asyncHandler(async (req, res) => {
    const { tripId } = req.params;
    const result = await tripService.getTripDetail(tripId);
    return successResponse(res, 200, 'Trip detail retrieved successfully', result);
});

const getTripBookingOptions = asyncHandler(async (req, res) => {
    const { tripId } = req.params;
    const result = await tripService.getTripBookingOptions(tripId);
    return successResponse(res, 200, 'Trip booking options retrieved successfully', result);
});

const getPopularRoutes = asyncHandler(async (req, res) => {
    const result = await tripService.getPopularRoutes();
    return successResponse(res, 200, 'Popular routes retrieved successfully', result);
});

module.exports = {
    searchTrips,
    getLocations,
    getTripDetail,
    getTripBookingOptions,
    getPopularRoutes
};
