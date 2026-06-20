const express = require('express');
const partnerProfileController = require('../../controllers/partner/partnerProfile.controller');
const authenticate = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const { PARTNER } = require('../../constants/roles');
const router = express.Router();

// Get current partner's profile (protected route)
router.get('/me', authenticate, restrictTo(PARTNER), partnerProfileController.getProfile);

module.exports = router;
