const { body, param } = require('express-validator');

const subscriptionIdValidation = [
    param('id').isMongoId().withMessage('Invalid subscription plan id')
];

const createSubscriptionValidation = [
    body('planName')
        .trim()
        .notEmpty().withMessage('Plan name is required'),

    body('code')
        .trim()
        .notEmpty().withMessage('Code is required'),

    body('price')
        .notEmpty().withMessage('Price is required')
        .isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),

    body('durationDays')
        .notEmpty().withMessage('Duration days is required')
        .isInt({ min: 1 }).withMessage('Duration days must be at least 1'),

    body('discount')
        .optional()
        .isFloat({ min: 0 }).withMessage('Discount must be a non-negative number'),

    body('planFeatures')
        .optional()
        .isArray().withMessage('Plan features must be an array of strings'),

    body('maxBuses')
        .optional()
        .isInt({ min: 0 }).withMessage('Max buses must be a non-negative integer'),

    body('maxRoutes')
        .optional()
        .isInt({ min: 0 }).withMessage('Max routes must be a non-negative integer'),

    body('isPopular')
        .optional()
        .isBoolean().withMessage('isPopular must be a boolean'),

    body('description')
        .optional()
        .trim(),

    body('chartColor')
        .optional()
        .trim()
];

const updateSubscriptionValidation = [
    param('id').isMongoId().withMessage('Invalid subscription plan id'),

    body('planName')
        .optional()
        .trim()
        .notEmpty().withMessage('Plan name cannot be empty'),

    body('code')
        .optional()
        .trim()
        .notEmpty().withMessage('Code cannot be empty'),

    body('price')
        .optional()
        .isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),

    body('durationDays')
        .optional()
        .isInt({ min: 1 }).withMessage('Duration days must be at least 1'),

    body('discount')
        .optional()
        .isFloat({ min: 0 }).withMessage('Discount must be a non-negative number'),

    body('planFeatures')
        .optional()
        .isArray().withMessage('Plan features must be an array of strings'),

    body('maxBuses')
        .optional()
        .isInt({ min: 0 }).withMessage('Max buses must be a non-negative integer'),

    body('maxRoutes')
        .optional()
        .isInt({ min: 0 }).withMessage('Max routes must be a non-negative integer'),

    body('isPopular')
        .optional()
        .isBoolean().withMessage('isPopular must be a boolean'),

    body('description')
        .optional()
        .trim(),

    body('chartColor')
        .optional()
        .trim()
];

const updateSubscriptionStatusValidation = [
    param('id').isMongoId().withMessage('Invalid subscription plan id'),

    body('status')
        .notEmpty().withMessage('Status is required')
        .isIn(['ACTIVE', 'INACTIVE']).withMessage('Status must be either ACTIVE or INACTIVE')
];

module.exports = {
    subscriptionIdValidation,
    createSubscriptionValidation,
    updateSubscriptionValidation,
    updateSubscriptionStatusValidation
};
