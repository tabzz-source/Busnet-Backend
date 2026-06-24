const bookingService = require('../services/booking.service');

const expireBookingsJob = async () => bookingService.expireStaleBookings();

module.exports = expireBookingsJob;
