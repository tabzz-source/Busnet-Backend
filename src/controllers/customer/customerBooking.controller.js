const bookingService = require('../../services/booking.service');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');

const createBooking = asyncHandler(async (req, res) => {
    const result = await bookingService.createBookingWithPayment(req.user.id, req.body);
    return successResponse(res, 201, 'Booking created successfully', result);
});

const getBookingStatus = asyncHandler(async (req, res) => {
    const result = await bookingService.getBookingStatus(req.user.id, req.params.bookingCode);
    return successResponse(res, 200, 'Booking status retrieved successfully', result);
});

const getBookingDetail = asyncHandler(async (req, res) => {
    const result = await bookingService.getBookingDetail(req.user.id, req.params.bookingCode);
    return successResponse(res, 200, 'Booking detail retrieved successfully', result);
});

module.exports = {
    createBooking,
    getBookingStatus,
    getBookingDetail
};
