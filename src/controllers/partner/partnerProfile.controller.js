const partnerService = require('../../services/partner.service');

const getProfile = async (req, res) => {
    try {
        const accountId = req.user.id;
        const profile = await partnerService.getPartnerProfileByAccountId(accountId);

        return res.status(200).json({
            success: true,
            message: 'Partner profile retrieved successfully',
            data: profile
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getProfile
};
