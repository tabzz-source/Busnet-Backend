const express = require('express');
const router = express.Router();
const tripController = require('../../controllers/customer/customerTrip.controller');

// GET /api/customer/trips — Search and retrieve available trips
router.get('/', tripController.searchTrips);
router.get('/locations', tripController.getLocations);
router.get('/:tripId/booking-options', tripController.getTripBookingOptions);
router.get('/:tripId', tripController.getTripDetail);

module.exports = router;
