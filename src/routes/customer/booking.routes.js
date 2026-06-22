const express = require('express');

const authenticate = require('../../middlewares/auth.middleware');
const customerBookingController = require('../../controllers/customer/customerBooking.controller');

const router = express.Router();

router.post('/', authenticate, customerBookingController.createBooking);

router.get('/', authenticate, customerBookingController.getMyBookings);

router.get('/:bookingCode/status', authenticate, customerBookingController.getBookingStatus);

router.get('/:bookingCode/payment', authenticate, customerBookingController.getBookingPayment);

router.post('/:bookingCode/cancel', authenticate, customerBookingController.cancelBooking);

router.get('/:bookingCode', authenticate, customerBookingController.getBookingDetail);

module.exports = router;