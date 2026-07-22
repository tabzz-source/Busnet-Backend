// src/validations/route.validation.js
const { body, validationResult } = require('express-validator');

const createRules = [
    body('routeName')
        .trim()
        .notEmpty().withMessage('Route name is required')
        .isLength({ min: 3, max: 100 })
        .withMessage('Route name must be between 3 and 100 characters'),

    body('origin_province')
        .trim()
        .notEmpty().withMessage('Origin province is required'),

    body('origin_provinceName')
        .trim()
        .notEmpty().withMessage('Origin province name is required'),

    body('destination_province')
        .trim()
        .notEmpty().withMessage('Destination province is required')
        .custom((value, { req }) => {
            if (value === req.body.origin_province) {
                throw new Error(
                    'Origin and destination provinces cannot be the same'
                );
            }

            return true;
        }),

    body('destination_provinceName')
        .trim()
        .notEmpty().withMessage('Destination province name is required'),

];

const updateRules = [
    body('routeName')
        .optional()
        .trim()
        .isLength({ min: 3, max: 100 })
        .withMessage('Route name must be between 3 and 100 characters'),

    body('origin_province')
        .optional()
        .trim(),

    body('destination_province')
        .optional()
        .trim(),

    body().custom((value, { req }) => {
        const origin = req.body.origin_province;
        const destination = req.body.destination_province;

        if (
            origin &&
            destination &&
            origin === destination
        ) {
            throw new Error(
                'Origin and destination provinces cannot be the same'
            );
        }

        return true;
    })
];

const validateRoute = async (req, res, next, rules) => {
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

exports.validateRouteUpdated = (req, res, next) => validateRoute(req, res, next, updateRules);
exports.validateRouteCreated = (req, res, next) => validateRoute(req, res, next, createRules);