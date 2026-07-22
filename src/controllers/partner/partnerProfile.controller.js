const partnerService = require('../../services/partner.service');
const accountService = require('../../services/account.service');

const getProfile = async (req, res) => {
    try {
        const accountId = req.user?.id || req.user?._id;
        
        if (!accountId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

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

const updateProfile = async (req, res) => {
    try {
        const accountId = req.user?.id || req.user?._id;

        if (!accountId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const profile = await partnerService.updatePartnerProfileByAccountId(accountId, req.body, req.files);

        return res.status(200).json({
            success: true,
            message: 'Partner profile updated successfully',
            data: profile
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            success: false,
            message: error.message
        });
    }
};

const changePassword = async (req, res) => {
    try {
        const accountId = req.user?.id || req.user?._id;

        if (!accountId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        const { currentPassword, newPassword } = req.body;
        const result = await accountService.changePassword(accountId, currentPassword, newPassword);

        return res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getProfile,
    updateProfile,
    changePassword
};
