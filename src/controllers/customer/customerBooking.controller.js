const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');
const bookingService = require('../../services/booking.service');

const createBooking = asyncHandler(async (req, res) => {
    const customerId = req.user.id;

    const data = await bookingService.createBooking(customerId, req.body);

    return successResponse(res, 201, 'Booking created successfully', data);
});

const getMyBookings = asyncHandler(async (req, res) => {
    const customerId = req.user.id;

    const data = await bookingService.getMyBookings(customerId, req.query);

    return successResponse(res, 200, 'Bookings retrieved successfully', data);
});

const getBookingDetail = asyncHandler(async (req, res) => {
    const customerId = req.user.id;
    const { bookingCode } = req.params;

    const data = await bookingService.getBookingDetail(customerId, bookingCode);

    return successResponse(res, 200, 'Booking detail retrieved successfully', data);
});

const getBookingStatus = asyncHandler(async (req, res) => {
    const customerId = req.user.id;
    const { bookingCode } = req.params;

    const data = await bookingService.getBookingStatus(customerId, bookingCode);

    return successResponse(res, 200, 'Booking status retrieved successfully', data);
});

const getBookingPayment = asyncHandler(async (req, res) => {
    const customerId = req.user.id;
    const { bookingCode } = req.params;

    const data = await bookingService.getBookingPayment(customerId, bookingCode);

    return successResponse(res, 200, 'Booking payment retrieved successfully', data);
});

const cancelBooking = asyncHandler(async (req, res) => {
    const customerId = req.user.id;
    const { bookingCode } = req.params;
    const { reason } = req.body;

    const data = await bookingService.cancelBooking(customerId, bookingCode, reason);

    return successResponse(res, 200, 'Booking cancelled successfully', data);
});

module.exports = {
    createBooking,
    getMyBookings,
    getBookingDetail,
    getBookingStatus,
    getBookingPayment,
    cancelBooking
};