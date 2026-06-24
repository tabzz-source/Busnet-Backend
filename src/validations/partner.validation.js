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

const updatePartnerProfileValidation = [
    body('fullName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Full name must be between 2 and 100 characters'),

    body('phone')
        .optional()
        .trim()
        .isMobilePhone('vi-VN').withMessage('Phone number is invalid'),

    body('gender')
        .optional()
        .isIn(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']).withMessage('Gender must be one of: MALE, FEMALE, OTHER, UNKNOWN'),

    body('dob')
        .optional({ checkFalsy: true })
        .isISO8601().withMessage('Date of birth must be a valid date'),

    body('operatorName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 150 }).withMessage('Operator name must be between 2 and 150 characters'),

    body('operatorPhone')
        .optional()
        .trim()
        .isMobilePhone('vi-VN').withMessage('Operator phone number is invalid'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 2000 }).withMessage('Description must be at most 2000 characters'),

    body('bankName')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Bank name must be at most 100 characters'),

    body('bankAccountName')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Bank account name must be at most 100 characters'),

    body('bankNumber')
        .optional()
        .trim()
        .isLength({ max: 50 }).withMessage('Bank number must be at most 50 characters'),

    body('bankBranch')
        .optional()
        .trim()
        .isLength({ max: 100 }).withMessage('Bank branch must be at most 100 characters'),

    body('sepayVa')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 100 }).withMessage('Sepay VA must be at most 100 characters'),

    body('taxCode')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 50 }).withMessage('Tax code must be at most 50 characters')
];

module.exports = {
    partnerIdValidation,
    updatePartnerStatusValidation,
    updatePartnerProfileValidation
};
