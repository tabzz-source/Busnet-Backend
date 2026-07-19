const express = require('express');

const authenticate = require('../../middlewares/auth.middleware');
const customerBookingController = require('../../controllers/customer/customerBooking.controller');

const router = express.Router();

const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authenticate(req, res, next);
    }
    next();
};

// Public ticket retrieval endpoint (Lookup page)
router.post('/retrieve', customerBookingController.retrieveBookingPublic);

// Download PDF ticket (authenticated or public via bookingCode)
router.get('/:bookingCode/tickets/pdf', optionalAuth, customerBookingController.getBookingTicketsPdf);

router.post('/', authenticate, customerBookingController.createBooking);

router.get('/', authenticate, customerBookingController.getMyBookings);

router.get('/:bookingCode/status', authenticate, customerBookingController.getBookingStatus);

router.get('/:bookingCode/payment', authenticate, customerBookingController.getBookingPayment);

router.post('/:bookingCode/cancel-request', authenticate, customerBookingController.requestCancelBooking);

router.post('/:bookingCode/cancel', authenticate, customerBookingController.cancelBooking);

router.get('/:bookingCode/tickets', authenticate, customerBookingController.getBookingTickets);

router.get('/:bookingCode', authenticate, customerBookingController.getBookingDetail);

module.exports = router;
