const profileService = require('../../services/profile.service');

const getProfile = async (req, res) => {
    try {
        const result = await profileService.getAdminProfile(req.user._id);

        return res.status(200).json({
            success: true,
            message: 'Profile fetched successfully',
            data: result
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const updateProfile = async (req, res) => {
    try {
        const result = await profileService.updateAdminProfile(req.user._id, req.body, req.file);

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: result
        });
    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const changePassword = async (req, res) => {
    try {
        const result = await profileService.changeAdminPassword(req.user._id, req.body);

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
    getProfile,
    updateProfile,
    changePassword
};
