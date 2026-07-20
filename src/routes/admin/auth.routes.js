const express = require('express');
const adminAuthController = require('../../controllers/admin/adminAuth.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const { createLoginLimiter, createOtpLimiter } = require('../../middlewares/rateLimiter.middleware');
const loginLimiter = createLoginLimiter();
const otpLimiter = createOtpLimiter();
const { ADMIN } = require('../../constants/roles');
const {
    forgotPasswordValidation,
    resetPasswordValidation,
    verifyEmailValidation,
    verifyLoginCodeValidation
} = require('../../validations/auth.validation');

const router = express.Router();

router.post('/login', loginLimiter, adminAuthController.login);
router.post('/verify-login', otpLimiter, verifyLoginCodeValidation, validate, adminAuthController.verifyLoginCode);
router.post('/forgot-password', otpLimiter, forgotPasswordValidation, validate, adminAuthController.forgotPassword);
router.post('/reset-password', otpLimiter, resetPasswordValidation, validate, adminAuthController.resetPassword);

router.use(protect, restrictTo(ADMIN));

router.post('/logout', adminAuthController.logout);
router.post('/send-verify-email', otpLimiter, adminAuthController.sendVerifyEmail);
router.post('/verify-email', otpLimiter, verifyEmailValidation, validate, adminAuthController.verifyEmail);

module.exports = router;
