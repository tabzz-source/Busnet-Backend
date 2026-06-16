const jwt = require('jsonwebtoken');
const Account = require('../models/Account');
const AppError = require('../utils/AppError');

const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError('Not authorized, token missing', 401);
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const accountId = decoded.id;

        if (!accountId) {
            throw new AppError('Invalid token payload', 401);
        }

        const account = await Account.findById(accountId).lean();

        if (!account || account.deletedAt) {
            throw new AppError('Account not found', 404);
        }

        req.user = {
            id: account._id.toString(),
            role: account.role
        };

        req.account = account;

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return next(new AppError('Token has expired', 401));
        }

        if (error instanceof AppError) {
            return next(error);
        }

        return next(new AppError('Not authorized, token invalid', 401));
    }
};

module.exports = authenticate;
