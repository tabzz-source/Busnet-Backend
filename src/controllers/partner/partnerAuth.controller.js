const authService = require('../../services/auth.service');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');

/**
 * POST /api/partner/auth/register
 * Register a new partner (operator) account
 */
const register = asyncHandler(async (req, res) => {
    const result = await authService.registerOperator(req.body);

    return successResponse(res, 201,
        'Transit operator registration request created successfully. Please complete the subscription package payment to activate your account.',
        result
    );
});

/**
 * POST /api/partner/auth/send-verification-otp
 * Send OTP code for email verification
 */
const sendVerificationOTP = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const result = await authService.sendPartnerVerificationOTP(email);
    return successResponse(res, 200, 'Verification OTP sent successfully', result);
});

/**
 * POST /api/partner/auth/verify-otp
 * Verify registration OTP code
 */
const verifyOTP = asyncHandler(async (req, res) => {
    const { email, code } = req.body;
    const result = await authService.verifyPartnerOTP(email, code);
    return successResponse(res, 200, 'Email verified successfully', result);
});

/**
 * POST /api/partner/auth/login
 * Partner login controller
 */
const login = asyncHandler(async (req, res) => {
    const result = await authService.loginPartner(req.body);
    return successResponse(res, 200, 'Logged in successfully', result);
});

module.exports = {
    register,
    sendVerificationOTP,
    verifyOTP,
    login
};
