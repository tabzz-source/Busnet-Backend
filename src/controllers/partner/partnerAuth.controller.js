const authService = require('../../services/auth.service');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');

/**
 * POST /api/partner/auth/register
 * Submit operator registration (Phase 1: Plan + Profile + License)
 */
const register = asyncHandler(async (req, res) => {
    const result = await authService.submitOperatorRegistration(req.body);

    return successResponse(res, 201,
        'Registration submitted successfully. Your business license is under review by our admin team.',
        result
    );
});

/**
 * POST /api/partner/auth/continue-registration
 * Continue registration - verify identity and check status
 */
const continueRegistration = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await authService.continueOperatorRegistration(email, password);

    return successResponse(res, 200, 'Registration status retrieved successfully', result);
});

/**
 * POST /api/partner/auth/complete-payment
 * Complete payment (Phase 2: SePay config + create Transaction)
 */
const completePayment = asyncHandler(async (req, res) => {
    const result = await authService.completeOperatorPayment(req.body);

    return successResponse(res, 201,
        'Payment transaction created successfully. Please complete the subscription payment.',
        result
    );
});

/**
 * POST /api/partner/auth/resubmit-license
 * Resubmit business license after rejection
 */
const resubmitLicense = asyncHandler(async (req, res) => {
    const result = await authService.resubmitLicense(req.body);

    return successResponse(res, 200,
        'Business license resubmitted successfully. Your license is under review again.',
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

/**
 * POST /api/partner/auth/logout
 * Partner logout controller
 */
const logout = asyncHandler(async (req, res) => {
    return successResponse(res, 200, 'Logged out successfully', null);
});

module.exports = {
    register,
    continueRegistration,
    completePayment,
    resubmitLicense,
    sendVerificationOTP,
    verifyOTP,
    login,
    logout
};
