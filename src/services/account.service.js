const bcrypt = require('bcryptjs');
const Account = require('../models/Account');
const PartnerInformation = require('../models/PartnerInformation');
const uploadToCloudinary = require('../utils/uploadToCloudinary');
const AppError = require('../utils/AppError');

const CUSTOMER_PROFILE_FOLDER = process.env.CLOUDINARY_PROFILE_FOLDER || 'busnet/customers/profiles';
const BCRYPT_SALT_ROUNDS = 10;

const profileSelect = [
    '_id',
    'username',
    'email',
    'phone',
    'fullName',
    'gender',
    'dob',
    'profilePicture',
    'role',
    'status',
    'isOAuthUser',
    'isEmailVerified',
    'isPhoneVerified',
    'banCounts',
    'isAutoPublishBlog',
    'createdAt',
    'updatedAt'
].join(' ');

const getMyProfile = async (accountId) => {
    if (!accountId) {
        throw new AppError('Account id is required', 400);
    }

    const account = await Account.findOne({
        _id: accountId,
        deletedAt: null
    }).select(profileSelect).lean();

    if (!account) {
        throw new AppError('Account not found', 404);
    }

    const response = {
        account
    };

    if (account.role === 'PARTNER') {
        const partnerInformation = await PartnerInformation.findOne({ accountId })
            .select(
                '_id accountId operatorName operatorPhone description amenities policies profilePicture coverImage ratingAvg totalReviews isVerified verifiedAt createdAt updatedAt'
            )
            .lean();

        response.partnerInformation = partnerInformation || null;
    }

    return response;
};

const changePassword = async (accountId, currentPassword, newPassword) => {
    if (!accountId || !currentPassword || !newPassword) {
        throw new AppError('Account id, current password, and new password are required', 400);
    }

    const account = await Account.findOne({
        _id: accountId,
        deletedAt: null
    }).select('+passwordHash');

    if (!account) {
        throw new AppError('Account not found', 404);
    }

    if (!account.passwordHash) {
        throw new AppError('This account does not have a password set', 400);
    }

    const isMatch = await bcrypt.compare(currentPassword, account.passwordHash);

    if (!isMatch) {
        throw new AppError('Current password is incorrect', 400);
    }

    const isSamePassword = await bcrypt.compare(newPassword, account.passwordHash);
    if (isSamePassword) {
        throw new AppError('New password must be different from the current password', 400);
    }

    account.passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
    await account.save();

    return {
        message: 'Password changed successfully'
    };
};

const updateMyProfile = async (accountId, data, file) => {
    if (!accountId) {
        throw new AppError('Account id is required', 400);
    }

    const account = await Account.findOne({
        _id: accountId,
        deletedAt: null
    });

    if (!account) {
        throw new AppError('Account not found', 404);
    }

    if (account.role !== 'CUSTOMER') {
        throw new AppError('This endpoint is only available for customer accounts', 403);
    }

    const hasBodyUpdates =
        data.fullName !== undefined ||
        data.gender !== undefined ||
        data.dob !== undefined;

    if (!hasBodyUpdates && !file) {
        throw new AppError('No profile data provided for update', 400);
    }

    if (data.fullName !== undefined) {
        account.fullName = data.fullName.trim();
    }

    if (data.gender !== undefined) {
        account.gender = data.gender;
    }

    if (data.dob !== undefined) {
        account.dob = data.dob ? new Date(data.dob) : null;
    }

    if (file) {
        const uploadedProfileImage = await uploadToCloudinary(file.buffer, CUSTOMER_PROFILE_FOLDER);
        account.profilePicture = uploadedProfileImage.url;
    }

    await account.save();

    return {
        account: await Account.findOne({
            _id: accountId,
            deletedAt: null
        }).select(profileSelect).lean()
    };
};

module.exports = {
    getMyProfile,
    changePassword,
    updateMyProfile
};
