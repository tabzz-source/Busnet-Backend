const express = require('express');
const partnerForgotPasswordController = require('../../controllers/partner/partnerForgotPassword.controller');

const router = express.Router();

// Send password reset code
router.post('/send-code', partnerForgotPasswordController.sendResetCode);

// Reset password with code
router.post('/reset', partnerForgotPasswordController.resetPassword);

// Resend password reset code
router.post('/resend-code', partnerForgotPasswordController.resendResetCode);

module.exports = router;
