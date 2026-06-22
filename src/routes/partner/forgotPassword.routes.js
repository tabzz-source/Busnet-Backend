const express = require('express');
const partnerForgotPasswordController = require('../../controllers/partner/partnerForgotPassword.controller');
const {
    validateForgotPassword,
    validateVerifyResetCode,
    validateResetPassword
} = require('../../validations/auth.validation');

const router = express.Router();

// Send password reset code
router.post('/send-code', validateForgotPassword, partnerForgotPasswordController.sendResetCode);

// Verify password reset code
router.post('/verify-code', validateVerifyResetCode, partnerForgotPasswordController.verifyResetCode);

// Reset password with code
router.post('/reset', validateResetPassword, partnerForgotPasswordController.resetPassword);

// Resend password reset code
router.post('/resend-code', validateForgotPassword, partnerForgotPasswordController.resendResetCode);

module.exports = router;
