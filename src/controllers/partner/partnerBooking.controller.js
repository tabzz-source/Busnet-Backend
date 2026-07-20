const partnerBookingService = require('../../services/partnerBooking.service');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');

const getBookings = asyncHandler(async (req, res) => {
    const result = await partnerBookingService.getPartnerBookings(req.user.id, req.query);
    return successResponse(res, 200, 'Customer bookings fetched successfully', result);
});

const getBookingDetail = asyncHandler(async (req, res) => {
    const result = await partnerBookingService.getPartnerBookingDetail(
        req.user.id,
        req.params.bookingId
    );
    return successResponse(res, 200, 'Customer booking detail fetched successfully', result);
});

const respondCancellation = asyncHandler(async (req, res) => {
    const result = await partnerBookingService.respondCancellationRequest(
        req.user.id,
        req.params.bookingId,
        req.body
    );
    return successResponse(res, 200, 'Cancellation request processed successfully', result);
});

module.exports = { getBookings, getBookingDetail, respondCancellation };
