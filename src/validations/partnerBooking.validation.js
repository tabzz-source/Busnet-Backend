const { body } = require('express-validator');

const respondCancellationValidation = [
    body('decision')
        .trim()
        .notEmpty().withMessage('Decision is required')
        .customSanitizer((value) => String(value).toUpperCase())
        .isIn(['APPROVE', 'REJECT']).withMessage('Decision must be APPROVE or REJECT'),

    body('response')
        .optional()
        .trim()
        .isLength({ max: 1000 }).withMessage('Response must not exceed 1000 characters'),

    body('refundReference')
        .optional()
        .trim()
        .isLength({ max: 200 }).withMessage('Refund reference must not exceed 200 characters')
];

module.exports = { respondCancellationValidation };
