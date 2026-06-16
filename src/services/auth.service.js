const bcrypt = require('bcryptjs');
const Account = require('../models/Account');
const generateToken = require('../utils/generateToken');

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

    const token = generateToken({
        accountId: account._id,
        role: account.role
    });

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

const loginPartner = async ({ identifier, password }) => {
    if (!identifier || !password) {
        throw new Error('Please enter email/phone number and password');
    }

    const account = await Account.findOne({
        $or: [
            { email: identifier.toLowerCase() },
            { phone: identifier }
        ],
        role: 'PARTNER'
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

    if (account.status === 'PENDING_APPROVAL') {
        throw new Error('Your account is pending approval from admin');
    }

    if (account.status !== 'ACTIVE') {
        throw new Error('This account has not been activated');
    }

    const isMatch = await bcrypt.compare(password, account.passwordHash);

    if (!isMatch) {
        throw new Error('Incorrect account or password');
    }

    const token = generateToken({
        accountId: account._id,
        role: account.role
    });

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

module.exports = {
    loginCustomer,
    loginPartner
};