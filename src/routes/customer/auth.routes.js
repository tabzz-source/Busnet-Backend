const express = require('express');
const customerAuthController = require('../../controllers/customer/customerAuth.controller');
const { 
    validateRegister, 
    validateVerifyEmail, 
    validateForgotPassword, 
    validateVerifyResetCode, 
    validateResetPassword,
    validateLogin
} = require('../../validations/auth.validation');

const router = express.Router();

// POST /api/customer/auth/register
router.post('/register', validateRegister, customerAuthController.register);

// POST /api/customer/auth/login
router.post('/login', validateLogin, customerAuthController.login);

// POST /api/customer/auth/google
router.post('/google', customerAuthController.loginWithGoogle);

// POST /api/customer/auth/verify-email
router.post('/verify-email', validateVerifyEmail, customerAuthController.verifyEmail);

// POST /api/customer/auth/forgot-password
router.post('/forgot-password', validateForgotPassword, customerAuthController.forgotPassword);

// POST /api/customer/auth/verify-reset-code
router.post('/verify-reset-code', validateVerifyResetCode, customerAuthController.verifyResetCode);

// POST /api/customer/auth/reset-password
router.post('/reset-password', validateResetPassword, customerAuthController.resetPassword);

module.exports = router;