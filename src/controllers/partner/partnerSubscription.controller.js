// src/controllers/partner/partnerRoute.controller.js
const subscriptionService = require('../../services/partnerSubscription.service');

exports.getMySubscriptions = async (req, res) => {
    try {
        const result = await subscriptionService.getMySubscriptions(
            req.user?.id,
            req.query
        );


        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
