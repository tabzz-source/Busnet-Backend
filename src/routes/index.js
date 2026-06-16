const express = require('express');
const customerRoutes = require('./customer');
const router = express.Router();

router.use('/customer', customerRoutes);

module.exports = router;