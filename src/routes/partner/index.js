const express = require('express');
const authRoutes = require('./auth.routes');
const subscriptionRoutes = require('./subscription.routes');
const profileRoutes = require('./profile.routes');
const forgotPasswordRoutes = require('./forgotPassword.routes');
const scheduleRoutes = require('./schedule.routes');
const dashboardRoutes = require('./dashboard.routes');
const routeRoutes = require('./route.routes');
const blogRoutes = require('./blog.routes');
const ticketRoutes = require('./ticket.routes');
const bookingRoutes = require('./booking.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/subscription', subscriptionRoutes);
router.use('/profile', profileRoutes);
router.use('/forgot-password', forgotPasswordRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/routes', routeRoutes);
router.use('/blogs', blogRoutes);
router.use('/tickets', ticketRoutes);
router.use('/bookings', bookingRoutes);

module.exports = router;
