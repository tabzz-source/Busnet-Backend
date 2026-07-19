const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');
const { Readable } = require('stream');
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

const getBookingTickets = asyncHandler(async (req, res) => {
    const customerId = req.user.id;
    const { bookingCode } = req.params;

    const data = await bookingService.getBookingTickets(customerId, bookingCode);

    return successResponse(res, 200, 'Booking tickets retrieved successfully', data);
});

const getBookingTicketsPdf = asyncHandler(async (req, res) => {
    const customerId = req.user.id;
    const { bookingCode } = req.params;

    const { pdfBuffer, filename } = await bookingService.getBookingTicketsPdf(customerId, bookingCode);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    return Readable.from([pdfBuffer]).pipe(res);
});

const cancelBooking = asyncHandler(async (req, res) => {
    const customerId = req.user.id;
    const { bookingCode } = req.params;
    const { reason } = req.body;

    const data = await bookingService.cancelBooking(customerId, bookingCode, reason);

    return successResponse(res, 200, data.message || 'Booking cancelled successfully', data);
});

const requestCancelBooking = asyncHandler(async (req, res) => {
    const customerId = req.user.id;
    const { bookingCode } = req.params;
    const { reason } = req.body;

    const data = await bookingService.requestCancelBooking(customerId, bookingCode, reason);

    return successResponse(res, 200, data.message || 'Cancellation request submitted successfully', data);
});

const retrieveBookingPublic = asyncHandler(async (req, res) => {
    const { email, bookingCode } = req.body;

    const data = await bookingService.retrieveBookingPublic(email, bookingCode);

    return successResponse(res, 200, 'Booking retrieved successfully', data);
});

module.exports = {
    createBooking,
    getMyBookings,
    getBookingDetail,
    getBookingStatus,
    getBookingPayment,
    getBookingTicketsPdf,
    getBookingTickets,
    cancelBooking,
    requestCancelBooking,
    retrieveBookingPublic
};
