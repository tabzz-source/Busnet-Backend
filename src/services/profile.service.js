const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const uploadToCloudinary = require('../utils/uploadToCloudinary');

const formatAdminProfile = (admin) => ({
    _id: admin._id,
    username: admin.username,
    email: admin.email,
    fullName: admin.fullName,
    role: admin.role,
    status: admin.status,
    avatar: admin.avatar,
    isEmailVerified: admin.isEmailVerified,
    lastLoginAt: admin.lastLoginAt
});

const getAdminProfile = async (adminId) => {
    const admin = await Admin.findById(adminId);

    if (!admin) {
        throw new Error('Admin not found');
    }

    return formatAdminProfile(admin);
};

const updateAdminProfile = async (adminId, { fullName, username }, avatarFile) => {
    const admin = await Admin.findById(adminId);

    if (!admin) {
        throw new Error('Admin not found');
    }

    if (username && username !== admin.username) {
        const existing = await Admin.findOne({ username });

        if (existing) {
            throw new Error('Username already in use');
        }

        admin.username = username;
    }

    if (fullName !== undefined) {
        admin.fullName = fullName;
    }

    if (avatarFile) {
        const { url } = await uploadToCloudinary(avatarFile.buffer, 'busnet/admins');
        admin.avatar = url;
    }

    await admin.save();

    return formatAdminProfile(admin);
};

const changeAdminPassword = async (adminId, { currentPassword, newPassword }) => {
    const admin = await Admin.findById(adminId).select('+passwordHash');

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
