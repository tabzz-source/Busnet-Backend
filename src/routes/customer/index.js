const express = require('express');
const authRoutes = require('./auth.routes');
const blogRoutes = require('./blog.routes');
const bookingRoutes = require('./booking.routes');
const subscriptionRoutes = require('./subscription.routes');
const operatorRoutes = require('./operator.routes');
const profileRoutes = require('./profile.routes');
const tripRoutes = require('./trip.routes');
const favouriteRoutes = require('./favourite.routes');
const feedbackRoutes = require('./feedback.routes');
const reportRoutes = require('./report.routes');
const searchHistoryRoutes = require('./searchHistory.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/blogs', blogRoutes);
router.use('/bookings', bookingRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/operators', operatorRoutes);
router.use('/profile', profileRoutes);
router.use('/trips', tripRoutes);
router.use('/favourites', favouriteRoutes);
router.use('/reports', reportRoutes);
router.use('/feedbacks', feedbackRoutes);
router.use('/search-history', searchHistoryRoutes);

module.exports = router;
