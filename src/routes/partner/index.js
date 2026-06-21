const express = require('express');
const authRoutes = require('./auth.routes');
const profileRoutes = require('./profile.routes');
const forgotPasswordRoutes = require('./forgotPassword.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/forgot-password', forgotPasswordRoutes);

module.exports = router;
