const express = require('express');
const bookingController = require('../../controllers/customer/customerBooking.controller');
const authenticate = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const {
    createBookingValidation,
    bookingCodeParamValidation
} = require('../../validations/booking.validation');

const router = express.Router();

router.post(
    '/',
    authenticate,
    restrictTo('CUSTOMER'),
    createBookingValidation,
    validate,
    bookingController.createBooking
);

router.get(
    '/:bookingCode/payment',
    authenticate,
    restrictTo('CUSTOMER'),
    bookingCodeParamValidation,
    validate,
    bookingController.getBookingPayment
);

router.get(
    '/:bookingCode/payment-status',
    authenticate,
    restrictTo('CUSTOMER'),
    bookingCodeParamValidation,
    validate,
    bookingController.getBookingPaymentStatus
);

router.get(
    '/:bookingCode/status',
    authenticate,
    restrictTo('CUSTOMER'),
    bookingCodeParamValidation,
    validate,
    bookingController.getBookingStatus
);

router.get(
    '/:bookingCode/tickets',
    authenticate,
    restrictTo('CUSTOMER'),
    bookingCodeParamValidation,
    validate,
    bookingController.getBookingTickets
);

router.get(
    '/:bookingCode',
    authenticate,
    restrictTo('CUSTOMER'),
    bookingCodeParamValidation,
    validate,
    bookingController.getBookingDetail
);

module.exports = router;
