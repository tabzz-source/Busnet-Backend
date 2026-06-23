const express = require('express');
const partnerAuthController = require('../../controllers/partner/partnerAuth.controller');
const authenticate = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const { PARTNER } = require('../../constants/roles');
const { validateRegisterOperator } = require('../../validations/auth.validation');

const router = express.Router();

// POST /api/partner/auth/register
router.post('/register', validateRegisterOperator, partnerAuthController.register);

// POST /api/partner/auth/send-verification-otp
router.post('/send-verification-otp', partnerAuthController.sendVerificationOTP);

// POST /api/partner/auth/verify-otp
router.post('/verify-otp', partnerAuthController.verifyOTP);

// POST /api/partner/auth/login
router.post('/login', partnerAuthController.login);

// POST /api/partner/auth/logout
router.post('/logout', authenticate, restrictTo(PARTNER), partnerAuthController.logout);

module.exports = router;
