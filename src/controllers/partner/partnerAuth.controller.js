// src/controllers/partner/partnerAuth.controller.js

const authService = require('../../services/auth.service');

const login = async (req, res) => {
    try {
        const result = await authService.loginPartner(req.body);

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

module.exports = {
    login
};
