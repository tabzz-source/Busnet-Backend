const express = require('express');

const authenticate = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const bookingService = require('../services/booking.service');

const router = express.Router();

router.post('/expire-stale-bookings', authenticate, asyncHandler(async (req, res) => {
    const data = await bookingService.expireStaleBookings();

    return successResponse(res, 200, 'Stale bookings expired successfully', data);
}));

module.exports = router;