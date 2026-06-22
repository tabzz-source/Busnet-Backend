const express = require('express');
const customerRoutes = require('./customer');
const partnerRoutes = require('./partner');
const sepayRoutes = require('./common/sepay.routes');
const uploadRoutes = require('./common/upload.routes');
const router = express.Router();

router.use('/customer', customerRoutes);
router.use('/partner', partnerRoutes);
router.use('/sepay', sepayRoutes);
router.use('/upload', uploadRoutes);

module.exports = router;