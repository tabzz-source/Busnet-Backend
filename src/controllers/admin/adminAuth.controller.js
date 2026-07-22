const authService = require('../../services/auth.service');

const login = async (req, res) => {
    try {
        const result = await authService.loginAdmin(req.body);

        return res.status(200).json({
            success: true,
            message: result.requiresVerification ? result.message : 'Logged in successfully',
            data: result
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const verifyLoginCode = async (req, res) => {
    try {
        const result = await authService.verifyLoginCodeAdmin(req.body.email, req.body.code);

        return res.status(200).json({
            success: true,
            message: 'Logged in successfully',
            data: result
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const logout = (req, res) => {
    return res.status(200).json({
        success: true,
        message: 'Logged out successfully'
    });
};

const sendVerifyEmail = async (req, res) => {
    try {
        const result = await authService.sendVerifyEmailAdmin(req.user._id);

        return res.status(200).json({
            success: true,
            message: result.message,
            data: {
                expiresInSeconds: result.expiresInSeconds,
                resendCooldownSeconds: result.resendCooldownSeconds
            }
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const verifyEmail = async (req, res) => {
    try {
        const result = await authService.verifyEmailAdmin(req.user._id, req.body.code);

        return res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const result = await authService.forgotPasswordAdmin(req.body.email);

        return res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const resetPassword = async (req, res) => {
    try {
        const result = await authService.resetPasswordAdmin(req.body);

        return res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    login,
    verifyLoginCode,
    logout,
    sendVerifyEmail,
    verifyEmail,
    forgotPassword,
    resetPassword
};
