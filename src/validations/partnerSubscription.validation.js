const { param } = require('express-validator');

const transactionIdValidation = [
    param('transactionId')
        .isMongoId()
        .withMessage('Invalid transaction ID')
];

module.exports = { transactionIdValidation };
