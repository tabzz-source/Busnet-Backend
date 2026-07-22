const { body, param } = require('express-validator');

const transactionIdValidation = [
    param('transactionId')
        .isMongoId()
        .withMessage('Invalid transaction ID')
];

const renewSubscriptionValidation = [
    body('planId')
        .notEmpty()
        .withMessage('Plan ID is required')
        .isMongoId()
        .withMessage('Invalid plan ID')
];

module.exports = { transactionIdValidation, renewSubscriptionValidation };
