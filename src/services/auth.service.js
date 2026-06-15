const bcrypt = require('bcryptjs');
const Account = require('../models/Account');
const Admin = require('../models/Admin');
const CodeVerification = require('../models/CodeVerification');
const generateToken = require('../utils/generateToken');
const generateCode = require('../utils/generateCode');
const { addMinutes } = require('../utils/time');
const { CODE_VERIFICATION_TYPE } = require('../constants/statuses');
const emailService = require('./email.service');

const loginCustomer = async ({ identifier, password }) => {
    if (!identifier || !password) {
        throw new Error('Please enter email/phone number and password');
    }

    const account = await Account.findOne({
        $or: [
            { email: identifier.toLowerCase() },
            { phone: identifier }
        ],
        role: 'CUSTOMER'
    }).select('+passwordHash');

    if (!account) {
        throw new Error('Incorrect account or password');
    }

    if (account.status === 'DELETED') {
        throw new Error('This account has been deleted');
    }

    if (account.status === 'BANNED') {
        throw new Error('This account has been banned');
    }

    if (account.status !== 'ACTIVE') {
        throw new Error('This account has not been activated');
    }

    const isMatch = await bcrypt.compare(password, account.passwordHash);

    if (!isMatch) {
        throw new Error('Incorrect account or password');
    }

    const token = generateToken(account._id, account.role);

    return {
        token,
        account: {
            _id: account._id,
            username: account.username,
            email: account.email,
            phone: account.phone,
            fullName: account.fullName,
            role: account.role,
            status: account.status,
            profilePicture: account.profilePicture
        }
    };
};

const loginAdmin = async ({ email, password }) => {
    if (!email || !password) {
        throw new Error('Please enter email and password');
    }

    const admin = await Admin.findOne({
        email: email.toLowerCase()
    }).select('+passwordHash');

    if (!admin) {
        throw new Error('Incorrect account or password');
    }

    if (admin.status !== 'ACTIVE') {
        throw new Error('This account has been disabled');
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);

    if (!isMatch) {
        throw new Error('Incorrect account or password');
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    const token = generateToken(admin._id, admin.role);

    return {
        token,
        admin: {
            _id: admin._id,
            username: admin.username,
            email: admin.email,
            fullName: admin.fullName,
            role: admin.role,
            status: admin.status,
            avatar: admin.avatar,
            lastLoginAt: admin.lastLoginAt
        }
    };
};

const sendVerifyEmailAdmin = async (adminId) => {
    const admin = await Admin.findById(adminId);

    if (!admin) {
        throw new Error('Admin not found');
    }

    if (admin.isEmailVerified) {
        throw new Error('Email has already been verified');
    }

    const code = generateCode(6);
    const codeHash = await bcrypt.hash(code, 10);

    await CodeVerification.create({
        target: admin.email,
        targetType: 'EMAIL',
        type: CODE_VERIFICATION_TYPE.VERIFY_EMAIL,
        codeHash,
        expiredAt: addMinutes(new Date(), 10)
    });

    await emailService.sendVerificationEmail(admin.email, code);

    return { message: 'Verification code has been sent to your email' };
};

const verifyEmailAdmin = async (adminId, code) => {
    const admin = await Admin.findById(adminId);

    if (!admin) {
        throw new Error('Admin not found');
    }

    if (admin.isEmailVerified) {
        throw new Error('Email has already been verified');
    }

    const record = await CodeVerification.findOne({
        target: admin.email,
        type: CODE_VERIFICATION_TYPE.VERIFY_EMAIL,
        used: false,
        expiredAt: { $gt: new Date() }
    }).sort({ createdAt: -1 }).select('+codeHash');

    if (!record) {
        throw new Error('Verification code is invalid or has expired');
    }

    if (record.attemptCount >= record.maxAttempts) {
        throw new Error('Too many attempts, please request a new code');
    }

    const isMatch = await bcrypt.compare(code, record.codeHash);

    if (!isMatch) {
        record.attemptCount += 1;
        await record.save();
        throw new Error('Invalid verification code');
    }

    record.used = true;
    record.usedAt = new Date();
    await record.save();

    admin.isEmailVerified = true;
    await admin.save();

    return { message: 'Email verified successfully' };
};

const forgotPasswordAdmin = async (email) => {
    if (!email) {
        throw new Error('Please enter your email');
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });

    if (!admin) {
        throw new Error('No admin account found with this email');
    }

    const code = generateCode(6);
    const codeHash = await bcrypt.hash(code, 10);

    await CodeVerification.create({
        target: admin.email,
        targetType: 'EMAIL',
        type: CODE_VERIFICATION_TYPE.RESET_PASSWORD,
        codeHash,
        expiredAt: addMinutes(new Date(), 15)
    });

    await emailService.sendResetPasswordEmail(admin.email, code);

    return { message: 'Password reset code has been sent to your email' };
};

const resetPasswordAdmin = async ({ email, code, newPassword }) => {
    if (!email || !code || !newPassword) {
        throw new Error('Please provide email, code and new password');
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });

    if (!admin) {
        throw new Error('No admin account found with this email');
    }

    const record = await CodeVerification.findOne({
        target: admin.email,
        type: CODE_VERIFICATION_TYPE.RESET_PASSWORD,
        used: false,
        expiredAt: { $gt: new Date() }
    }).sort({ createdAt: -1 }).select('+codeHash');

    if (!record) {
        throw new Error('Reset code is invalid or has expired');
    }

    if (record.attemptCount >= record.maxAttempts) {
        throw new Error('Too many attempts, please request a new code');
    }

    const isMatch = await bcrypt.compare(code, record.codeHash);

    if (!isMatch) {
        record.attemptCount += 1;
        await record.save();
        throw new Error('Invalid reset code');
    }

    record.used = true;
    record.usedAt = new Date();
    await record.save();

    admin.passwordHash = await bcrypt.hash(newPassword, 10);
    await admin.save();

    return { message: 'Password has been reset successfully' };
};

module.exports = {
    loginCustomer,
    loginAdmin,
    sendVerifyEmailAdmin,
    verifyEmailAdmin,
    forgotPasswordAdmin,
    resetPasswordAdmin
};