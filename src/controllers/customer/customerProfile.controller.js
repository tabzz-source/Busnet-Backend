const accountService = require('../../services/account.service');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');

const getMyProfile = asyncHandler(async (req, res) => {
    const result = await accountService.getMyProfile(req.user.id);

    return successResponse(res, 200, 'Profile retrieved successfully', result);
});

const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const result = await accountService.changePassword(req.user.id, currentPassword, newPassword);

    return successResponse(res, 200, result.message, null);
});

const updateMyProfile = asyncHandler(async (req, res) => {
    const result = await accountService.updateMyProfile(req.user.id, req.body, req.file);

    return successResponse(res, 200, 'Profile updated successfully', result);
});

module.exports = {
    getMyProfile,
    changePassword,
    updateMyProfile
};
