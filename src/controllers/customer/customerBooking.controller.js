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

const getBookingPayment = asyncHandler(async (req, res) => {
    const result = await bookingService.getBookingPayment(req.user.id, req.params.bookingCode);
    return successResponse(res, 200, 'Booking payment retrieved successfully', result);
});

const getBookingPaymentStatus = asyncHandler(async (req, res) => {
    const result = await bookingService.getBookingStatus(req.user.id, req.params.bookingCode);
    return successResponse(res, 200, 'Booking payment status retrieved successfully', result);
});

const getBookingDetail = asyncHandler(async (req, res) => {
    const result = await bookingService.getBookingDetail(req.user.id, req.params.bookingCode);
    return successResponse(res, 200, 'Booking detail retrieved successfully', result);
});

const getBookingTickets = asyncHandler(async (req, res) => {
    const result = await bookingService.getBookingTickets(req.user.id, req.params.bookingCode);
    return successResponse(res, 200, 'Booking tickets retrieved successfully', result);
});

module.exports = {
    createBooking,
    getBookingStatus,
    getBookingPayment,
    getBookingPaymentStatus,
    getBookingDetail,
    getBookingTickets
};
