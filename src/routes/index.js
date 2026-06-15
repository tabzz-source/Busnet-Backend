const express = require('express');
const customerRoutes = require('./customer');
const adminRoutes = require('./admin');

const router = express.Router();

router.use('/customer', customerRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
