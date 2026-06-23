const express = require('express');
const customerRoutes = require('./customer');
const adminRoutes = require('./admin');
const partnerRoutes = require('./partner');
const sepayRoutes = require('./common/sepay.routes');
const uploadRoutes = require('./common/upload.routes');
const sepayBookingWebhookRoutes = require("./sepayBookingWebhook.routes");

const router = express.Router();

router.use('/customer', customerRoutes);
router.use('/admin', adminRoutes);
router.use('/partner', partnerRoutes);
router.use('/sepay', sepayRoutes);
router.use('/upload', uploadRoutes);
router.use("/sepay/booking", sepayBookingWebhookRoutes);
module.exports = router;
