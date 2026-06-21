const express = require('express');
const customerRoutes = require('./customer');
const adminRoutes = require('./admin');
const partnerRoutes = require('./partner');
const webhookRoutes = require('./webhook.routes');

const router = express.Router();

router.use('/customer', customerRoutes);
router.use('/admin', adminRoutes);
router.use('/partner', partnerRoutes);
router.use('/webhooks', webhookRoutes);

module.exports = router;
