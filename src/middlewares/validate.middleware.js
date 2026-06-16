const { validationResult } = require('express-validator');
const { errorResponse } = require('../utils/response');

/**
 * Middleware to check express-validator validation results.
 * If validation fails, returns 400 with detailed error messages.
 * Use after validation rules in route definition.
 *
 * Usage: router.post('/register', registerValidation, validate, controller.register)
 */
const validate = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map(err => ({
            field: err.path,
            message: err.msg
        }));

        return errorResponse(res, 400, 'Validation failed', formattedErrors);
    }

    next();
};

module.exports = validate;
