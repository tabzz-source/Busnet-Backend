const authService = require('../../services/auth.service');

const sendResetCode = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await authService.forgotPasswordPartner(email);

        return res.status(200).json({
            success: true,
            message: result.message,
            data: { email }
        });
    } catch (error) {
        const statusCode = error.statusCode || 400;
        return res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        const result = await authService.resetPasswordPartner(email, code, newPassword);

        return res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        const statusCode = error.statusCode || 400;
        return res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};

const resendResetCode = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await authService.resendResetCodePartner(email);

        return res.status(200).json({
            success: true,
            message: result.message,
            data: { email }
        });
    } catch (error) {
        const statusCode = error.statusCode || 400;
        return res.status(statusCode).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    sendResetCode,
    resetPassword,
    resendResetCode
};
