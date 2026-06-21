const express = require('express');
const authRoutes = require('./auth.routes');
const blogRoutes = require('./blog.routes');
const subscriptionRoutes = require('./subscription.routes');
const operatorRoutes = require('./operator.routes');
const profileRoutes = require('./profile.routes');
const favouriteRoutes = require('./favourite.routes');
const feedbackRoutes = require('./feedback.routes');
const reportRoutes = require('./report.routes')

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/blogs', blogRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/operators', operatorRoutes);
router.use('/profile', profileRoutes);
router.use('./favourite',favouriteRoutes);
router.use('./report',reportRoutes);


module.exports = router;
