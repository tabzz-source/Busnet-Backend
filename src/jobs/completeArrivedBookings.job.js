const bookingService = require('../services/booking.service');

const completeArrivedBookingsJob = async () => bookingService.completeArrivedBookings();

module.exports = completeArrivedBookingsJob;
