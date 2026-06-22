const { body, param } = require('express-validator');

const validateCreateReport = [
    body('reportType')
        .notEmpty()
        .withMessage('Report type is required')
        .isIn(['TRIP', 'BOOKING', 'OPERATOR', 'PAYMENT', 'SYSTEM', 'OTHER'])
        .withMessage('Invalid report type'),

    body('description')
        .notEmpty()
        .withMessage('Description is required')
        .isLength({ min: 10, max: 2000 })
        .withMessage('Description must be between 10 and 2000 characters')
        .trim(),

    body('reportImages')
        .optional()
        .isArray()
        .withMessage('Report images must be an array'),

    body('reportImages.*')
        .optional()
        .isString()
        .withMessage('Each report image must be a string')
        .trim()
];

const validateReportId = [
    param('id')
        .notEmpty()
        .withMessage('Report ID is required')
        .isMongoId()
        .withMessage('Invalid report ID')
];

module.exports = {
    validateCreateReport,
    validateReportId
};