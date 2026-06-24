const express = require('express');
const routeRoutes = require('./route.routes');
const authRoutes = require('./auth.routes');
const router = express.Router();

router.use('/routes', routeRoutes);
router.use('/auth', authRoutes);
module.exports = router;