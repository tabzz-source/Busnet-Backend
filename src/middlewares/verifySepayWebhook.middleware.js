const AppError = require('../utils/AppError');

const verifySepayWebhook = (req, res, next) => {
    const expectedSecret = process.env.SEPAY_WEBHOOK_SECRET;

    if (!expectedSecret) {
        return next(new AppError('SEPAY_WEBHOOK_SECRET is not configured', 500));
    }

    const receivedSecret =
        req.headers['x-sepay-secret'] ||
        req.headers['x-webhook-secret'] ||
        req.headers['authorization'];

    if (!receivedSecret) {
        return next(new AppError('Missing webhook secret', 401));
    }

    const normalizedSecret = String(receivedSecret).replace(/^Bearer\s+/i, '').trim();

    if (normalizedSecret !== expectedSecret) {
        return next(new AppError('Invalid webhook secret', 403));
    }

    next();
};

module.exports = verifySepayWebhook;