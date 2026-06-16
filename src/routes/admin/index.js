const express = require('express');
const authRoutes = require('./auth.routes');
const profileRoutes = require('./profile.routes');
const dashboardRoutes = require('./dashboard.routes');
const partnerRoutes = require('./partner.routes');
const subscriptionRoutes = require('./subscription.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/partners', partnerRoutes);
router.use('/subscriptions', subscriptionRoutes);

module.exports = router;
