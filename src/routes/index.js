const express = require('express');
const customerRoutes = require('./customer');
const adminRoutes = require('./admin');
const partnerRoutes = require('./partner');

const router = express.Router();

router.use('/customer', customerRoutes);
router.use('/admin', adminRoutes);
router.use('/partner', partnerRoutes);

module.exports = router;
