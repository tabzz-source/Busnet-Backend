const authService = require('../../services/auth.service');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');

/**
 * POST /api/customer/auth/register
 * Register a new customer account
 */
const register = asyncHandler(async (req, res) => {
    const result = await authService.registerCustomer(req.body);

    return successResponse(res, 201,
        'Account created successfully. Please verify your email to activate your account.',
        result
    );
});

/**
 * POST /api/customer/auth/login
 * Login customer with email/phone + password
 */
const login = asyncHandler(async (req, res) => {
    const result = await authService.loginCustomer(req.body);

    return successResponse(res, 200, 'Logged in successfully', result);
});

/**
 * POST /api/customer/auth/google
 * Login or register customer via Google OAuth ID Token
 */
const loginWithGoogle = asyncHandler(async (req, res) => {
    const { idToken } = req.body;
    const result = await authService.loginGoogleCustomer(idToken);

    return successResponse(res, 200, 'Authenticated with Google successfully', result);
});

/**
 * POST /api/customer/auth/verify-email
 * Verify email address with 6-digit code
 */
const verifyEmail = asyncHandler(async (req, res) => {
    const { email, code } = req.body;
    const result = await authService.verifyEmail(email, code);

    return successResponse(res, 200, 'Email verified and account activated successfully', {
        account: {
            _id: result._id,
            username: result.username,
            email: result.email,
            status: result.status,
            isEmailVerified: result.isEmailVerified
        }
    });
});

/**
 * POST /api/customer/auth/forgot-password
 * Request a password reset code
 */
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);

    return successResponse(res, 200, 'Password reset code has been sent to your email', result);
});

/**
 * POST /api/customer/auth/verify-reset-code
 * Verify reset code is valid
 */
const verifyResetCode = asyncHandler(async (req, res) => {
    const { email, code } = req.body;
    await authService.verifyResetCode(email, code);

    return successResponse(res, 200, 'Verification code is valid', { valid: true });
});

/**
 * POST /api/customer/auth/reset-password
 * Reset password using the code
 */
const resetPassword = asyncHandler(async (req, res) => {
    const { email, code, newPassword } = req.body;
    const result = await authService.resetPassword(email, code, newPassword);

    return successResponse(res, 200, 'Password has been reset successfully', result);
});

module.exports = {
    register,
    login,
    loginWithGoogle,
    verifyEmail,
    forgotPassword,
    verifyResetCode,
    resetPassword
};