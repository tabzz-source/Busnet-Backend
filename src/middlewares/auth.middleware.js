const jwt = require('jsonwebtoken');
const Account = require('../models/Account');
const AppError = require('../utils/AppError');
const { ACCOUNT_STATUS } = require('../constants/statuses');

const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized, no token provided'
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await Account.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized, user not found'
            });
        }

        if (user.role === 'ADMIN' && user.status === ACCOUNT_STATUS.DISABLED) {
            return res.status(403).json({
                success: false,
                message: 'This account has been disabled'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized, invalid or expired token'
        });
    }
};

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
module.exports.protect = protect;
module.exports.authenticate = authenticate;
