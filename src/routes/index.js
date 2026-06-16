const express = require('express');
const customerRoutes = require('./customer');
const partnerRoutes = require('./partner');

const router = express.Router();

router.use('/customer', customerRoutes);
router.use('/partner', partnerRoutes);

module.exports = router;