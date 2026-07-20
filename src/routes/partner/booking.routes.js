const express = require('express');
const partnerBookingController = require('../../controllers/partner/partnerBooking.controller');
const authenticate = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const { PARTNER } = require('../../constants/roles');
const validate = require('../../middlewares/validate.middleware');
const { respondCancellationValidation } = require('../../validations/partnerBooking.validation');

const router = express.Router();

router.get('/', authenticate, restrictTo(PARTNER), partnerBookingController.getBookings);
router.get('/:bookingId', authenticate, restrictTo(PARTNER), partnerBookingController.getBookingDetail);
router.patch(
    '/:bookingId/cancellation-response',
    authenticate,
    restrictTo(PARTNER),
    respondCancellationValidation,
    validate,
    partnerBookingController.respondCancellation
);

module.exports = router;
