const { body, validationResult } = require('express-validator');

const updateProfileRules = [
    body('fullName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Full name must be between 2 and 100 characters'),
    body('gender')
        .optional()
        .isIn(['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']).withMessage('Gender must be one of: MALE, FEMALE, OTHER, UNKNOWN'),
    body('dob')
        .optional({ checkFalsy: true })
        .isISO8601().withMessage('Date of birth must be a valid date (YYYY-MM-DD)')
];

const validateUpdateProfile = async (req, res, next) => {
    for (const rule of updateProfileRules) {
        await rule.run(req);
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map((err) => ({
            field: err.path,
            message: err.msg
        }));

        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: formattedErrors
        });
    }

    next();
};

module.exports = {
    validateUpdateProfile
};
