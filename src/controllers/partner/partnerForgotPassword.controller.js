const forgotPasswordService = require('../../services/forgotPassword.service');

const sendResetCode = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await forgotPasswordService.sendResetCode(email);

        return res.status(200).json({
            success: true,
            message: result.message,
            data: result
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            success: false,
            message: error.message
        });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        const result = await forgotPasswordService.resetPassword(email, code, newPassword);

        return res.status(200).json({
            success: true,
            message: result.message,
            data: result
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            success: false,
            message: error.message
        });
    }
};

const resendResetCode = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await forgotPasswordService.resendResetCode(email);

        return res.status(200).json({
            success: true,
            message: result.message,
            data: result
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
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
