const express = require('express');
const authRoutes = require('./auth.routes');
const subscriptionRoutes = require('./subscription.routes');
const profileRoutes = require('./profile.routes');
const forgotPasswordRoutes = require('./forgotPassword.routes');
const scheduleRoutes = require('./schedule.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/subscription', subscriptionRoutes);
router.use('/profile', profileRoutes);
router.use('/forgot-password', forgotPasswordRoutes);
router.use('/schedules', scheduleRoutes);

module.exports = router;
