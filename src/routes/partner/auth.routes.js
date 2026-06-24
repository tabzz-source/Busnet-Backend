const express = require('express');
const partnerAuthController = require('../../controllers/partner/partnerAuth.controller');
const { validateRegisterOperator, validateContinueRegistration, validateCompletePayment, validateResubmitLicense } = require('../../validations/auth.validation');
const authenticate = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const { PARTNER } = require('../../constants/roles');

const router = express.Router();

// POST /api/partner/auth/register (Phase 1: Plan + Profile + License)
router.post('/register', validateRegisterOperator, partnerAuthController.register);

// POST /api/partner/auth/continue-registration (Check status by email + password)
router.post('/continue-registration', validateContinueRegistration, partnerAuthController.continueRegistration);

// POST /api/partner/auth/complete-payment (Phase 2: SePay + create Transaction)
router.post('/complete-payment', validateCompletePayment, partnerAuthController.completePayment);

// POST /api/partner/auth/resubmit-license (Re-upload license after rejection)
router.post('/resubmit-license', validateResubmitLicense, partnerAuthController.resubmitLicense);

// POST /api/partner/auth/send-verification-otp
router.post('/send-verification-otp', partnerAuthController.sendVerificationOTP);

// POST /api/partner/auth/verify-otp
router.post('/verify-otp', partnerAuthController.verifyOTP);

// POST /api/partner/auth/login
router.post('/login', partnerAuthController.login);

// POST /api/partner/auth/logout
router.post('/logout', authenticate, restrictTo(PARTNER), partnerAuthController.logout);

module.exports = router;
