const express = require('express');
const partnerProfileController = require('../../controllers/partner/partnerProfile.controller');
const authenticate = require('../../middlewares/auth.middleware');

const router = express.Router();

// Get current partner's profile (protected route)
router.get('/me', authenticate, partnerProfileController.getProfile);

module.exports = router;
