const bcrypt = require('bcryptjs');
const Account = require('../models/Account');
const uploadToCloudinary = require('../utils/uploadToCloudinary');
const uploadLocal = require('../utils/uploadLocal');

const formatAdminProfile = (admin) => ({
    _id: admin._id,
    username: admin.username,
    email: admin.email,
    fullName: admin.fullName,
    role: admin.role,
    status: admin.status,
    avatar: admin.profilePicture,
    isEmailVerified: admin.isEmailVerified,
    lastLoginAt: admin.lastLoginAt
});

const getAdminProfile = async (adminId) => {
    const admin = await Account.findOne({ _id: adminId, role: 'ADMIN' });

    if (!admin) {
        throw new Error('Admin not found');
    }

    return formatAdminProfile(admin);
};

const updateAdminProfile = async (adminId, { fullName, username }, avatarFile) => {
    const admin = await Account.findOne({ _id: adminId, role: 'ADMIN' });

    if (!admin) {
        throw new Error('Admin not found');
    }

    if (username && username !== admin.username) {
        const existing = await Account.findOne({ username });

        if (existing) {
            throw new Error('Username already in use');
        }

        admin.username = username;
    }

    if (fullName !== undefined) {
        admin.fullName = fullName;
    }

    if (avatarFile) {
        try {
            const { url } = await uploadToCloudinary(avatarFile.buffer, 'busnet/admins');
            admin.profilePicture = url;
        } catch (err) {
            console.error('[updateAdminProfile] Cloudinary failed, using local storage:', err.message);
            const { url } = uploadLocal(avatarFile.buffer, avatarFile.originalname);
            admin.profilePicture = url;
        }
    }

    await admin.save();

    return formatAdminProfile(admin);
};

const changeAdminPassword = async (adminId, { currentPassword, newPassword }) => {
    const admin = await Account.findOne({ _id: adminId, role: 'ADMIN' }).select('+passwordHash');

    if (!admin) {
        throw new Error('Admin not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.passwordHash);

    if (!isMatch) {
        throw new Error('Current password is incorrect');
    }

    admin.passwordHash = await bcrypt.hash(newPassword, 10);
    await admin.save();

    return { message: 'Password changed successfully' };
};

module.exports = {
    getAdminProfile,
    updateAdminProfile,
    changeAdminPassword
};
