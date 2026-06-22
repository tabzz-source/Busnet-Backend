const express = require('express');
const authRoutes = require('./auth.routes');
const subscriptionRoutes = require('./subscription.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/subscription', subscriptionRoutes);

module.exports = router;
