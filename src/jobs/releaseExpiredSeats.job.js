const bookingService = require('../services/booking.service');

const releaseExpiredSeatsJob = async () => bookingService.expireStaleBookings();

module.exports = releaseExpiredSeatsJob;
