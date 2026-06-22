const express = require('express');
const adminAuthController = require('../../controllers/admin/adminAuth.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const { ADMIN } = require('../../constants/roles');
const {
    forgotPasswordValidation,
    resetPasswordValidation,
    verifyEmailValidation
} = require('../../validations/auth.validation');

const router = express.Router();

router.post('/login', adminAuthController.login);
router.post('/forgot-password', forgotPasswordValidation, validate, adminAuthController.forgotPassword);
router.post('/reset-password', resetPasswordValidation, validate, adminAuthController.resetPassword);

router.use(protect, restrictTo(ADMIN));

router.post('/logout', adminAuthController.logout);
router.post('/send-verify-email', adminAuthController.sendVerifyEmail);
router.post('/verify-email', verifyEmailValidation, validate, adminAuthController.verifyEmail);

module.exports = router;
