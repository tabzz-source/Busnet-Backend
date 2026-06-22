const express = require('express');
const authRoutes = require('./auth.routes');
const blogRoutes = require('./blog.routes');
const subscriptionRoutes = require('./subscription.routes');
const operatorRoutes = require('./operator.routes');
const profileRoutes = require('./profile.routes');
const tripRoutes = require('./trip.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/blogs', blogRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/operators', operatorRoutes);
router.use('/profile', profileRoutes);
router.use('/trips', tripRoutes);

module.exports = router;
