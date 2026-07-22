const { body, validationResult } = require('express-validator');

const createRules = [
    body('busName')
        .trim()
        .notEmpty()
        .withMessage('Bus name is required')
        .isLength({ max: 100 })
        .withMessage('Bus name cannot exceed 100 characters'),

    body('licensePlate')
        .trim()
        .notEmpty()
        .withMessage('License plate is required')
        .isLength({ max: 20 })
        .withMessage('License plate cannot exceed 20 characters'),

    body('busType')
        .trim()
        .notEmpty()
        .withMessage('Bus type is required'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Description cannot exceed 1000 characters'),

    body('images')
        .optional()
        .isArray()
        .withMessage('Images must be an array'),

    body('images.*')
        .optional()
        .isURL()
        .withMessage('Each image must be a valid URL'),

    body('amenities')
        .optional()
        .isArray()
        .withMessage('Amenities must be an array'),

    body('amenities.*')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Amenity cannot be empty'),

    body('status')
        .optional()
        .isIn(['ACTIVE', 'MAINTENANCE', 'INACTIVE'])
        .withMessage('Invalid bus status'),

    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be true or false'),


];

const updateRules = [
    body('busName')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Bus name cannot be empty')
        .isLength({ max: 100 })
        .withMessage('Bus name cannot exceed 100 characters'),

    body('licensePlate')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('License plate cannot be empty')
        .isLength({ max: 20 })
        .withMessage('License plate cannot exceed 20 characters'),

    body('busType')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Bus type cannot be empty'),

    body('description')
        .optional()
        .trim()
        .isLength({ max: 1000 })
        .withMessage('Description cannot exceed 1000 characters'),

    body('images')
        .optional()
        .isArray()
        .withMessage('Images must be an array'),

    body('images.*')
        .optional()
        .isURL()
        .withMessage('Each image must be a valid URL'),

    body('amenities')
        .optional()
        .isArray()
        .withMessage('Amenities must be an array'),

    body('amenities.*')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Amenity cannot be empty'),

    body('status')
        .optional()
        .isIn(['ACTIVE', 'MAINTENANCE', 'INACTIVE'])
        .withMessage('Invalid bus status'),

    body('isActive')
        .optional()
        .isBoolean()
        .withMessage('isActive must be true or false'),

];

const validateBus = async (req, res, next, rules) => {
    for (const rule of rules) {
        await rule.run(req);
    }

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(error => ({
                field: error.path,
                message: error.msg
            }))
        });
    }

    next();
};

exports.validateBusCreated = (req, res, next) =>
    validateBus(req, res, next, createRules);

exports.validateBusUpdated = (req, res, next) =>
    validateBus(req, res, next, updateRules);
