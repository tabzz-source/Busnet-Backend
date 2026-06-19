const express = require('express');
const tripController = require('../../controllers/customer/customerTrip.controller');

const router = express.Router();

router.get('/search', tripController.searchTrips);
router.get('/:id/seats', tripController.getTripSeats);
router.get('/:id', tripController.getTripDetail);

module.exports = router;
