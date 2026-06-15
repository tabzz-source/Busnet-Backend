const { body, param } = require('express-validator');

const partnerIdValidation = [
    param('id').isMongoId().withMessage('Invalid partner id')
];

const updatePartnerStatusValidation = [
    param('id').isMongoId().withMessage('Invalid partner id'),

    body('status')
        .notEmpty().withMessage('Status is required')
        .isIn(['ACTIVE', 'BANNED']).withMessage('Status must be either ACTIVE or BANNED'),

    body('type')
        .optional()
        .isIn(['TEMPORARY', 'PERMANENT']).withMessage('Type must be either TEMPORARY or PERMANENT'),

    body('reason')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Reason must be at most 500 characters'),

    body('expiredAt')
        .optional({ checkFalsy: true })
        .isISO8601().withMessage('expiredAt must be a valid date')
];

module.exports = {
    partnerIdValidation,
    updatePartnerStatusValidation
};
