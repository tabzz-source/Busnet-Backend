const { body, validationResult } = require('express-validator');

/**
 * Validation rules for customer registration
 */
const registerRules = [
    body('username')
        .trim()
        .notEmpty().withMessage('Username is required')
        .isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters')
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers and underscores'),

    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),

    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 7, max: 50 }).withMessage('Password must be over 6 characters')
        .matches(/^[A-Z]/).withMessage('First letter must be capitalized')
        .matches(/\d/).withMessage('Password must contain at least one number')
        .matches(/[!@#$%^&*(),.?":{}|<>_+\-=\[\]\\';]/).withMessage('Password must contain at least one special character'),

    body('fullName')
        .trim()
        .notEmpty().withMessage('Full name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Full name must be between 2 and 100 characters'),

    body('phone')
        .trim()
        .notEmpty().withMessage('Phone number is required')
        .matches(/^0\d{9}$/).withMessage('Phone must be exactly 10 digits and start with 0'),

    body('gender')
        .optional()
        .isIn(['MALE', 'FEMALE', 'OTHER']).withMessage('Gender must be one of: MALE, FEMALE, OTHER'),

    body('dob')
        .optional()
        .isISO8601().withMessage('Date of birth must be a valid date (YYYY-MM-DD)')
];

/**
 * Single middleware function that runs all register validations
 * and returns 400 if any fail. Compatible with Express 5.
 */
const validateRegister = async (req, res, next) => {
    // Run all validation rules
    for (const rule of registerRules) {
        await rule.run(req);
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map(err => ({
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


/**
 * Validation rules for email verification
 */
const verifyEmailRules = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    body('code')
        .trim()
        .notEmpty().withMessage('Verification code is required')
        .isLength({ min: 6, max: 6 }).withMessage('Code must be exactly 6 characters')
        .matches(/^\d{6}$/).withMessage('Code must contain only digits')
];

/**
 * Validation rules for forgot password
 */
const forgotPasswordRules = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail()
];

/**
 * Validation rules for checking reset code
 */
const verifyResetCodeRules = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    body('code')
        .trim()
        .notEmpty().withMessage('Verification code is required')
        .isLength({ min: 6, max: 6 }).withMessage('Code must be exactly 6 characters')
        .matches(/^\d{6}$/).withMessage('Code must contain only digits')
];

/**
 * Validation rules for resetting password
 */
const resetPasswordRules = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail(),
    body('code')
        .trim()
        .notEmpty().withMessage('Verification code is required')
        .isLength({ min: 6, max: 6 }).withMessage('Code must be exactly 6 characters')
        .matches(/^\d{6}$/).withMessage('Code must contain only digits'),
    body('newPassword')
        .notEmpty().withMessage('New password is required')
        .isLength({ min: 7, max: 50 }).withMessage('New password must be over 6 characters')
        .matches(/^[A-Z]/).withMessage('First letter of new password must be capitalized')
        .matches(/\d/).withMessage('New password must contain at least one number')
        .matches(/[!@#$%^&*(),.?":{}|<>_+\-=\[\]\\';]/).withMessage('New password must contain at least one special character')
];

/**
 * Validation rules for changing password
 */
const changePasswordRules = [
    body('currentPassword')
        .notEmpty().withMessage('Current password is required'),
    body('newPassword')
        .notEmpty().withMessage('New password is required')
        .isLength({ min: 7, max: 50 }).withMessage('New password must be over 6 characters')
        .matches(/^[A-Z]/).withMessage('First letter of new password must be capitalized')
        .matches(/\d/).withMessage('New password must contain at least one number')
        .matches(/[!@#$%^&*(),.?":{}|<>_+\-=\[\]\\';]/).withMessage('New password must contain at least one special character')
];

/**
 * Validation rules for customer login
 */
const loginRules = [
    body('identifier')
        .trim()
        .notEmpty().withMessage('Email or username is required')
        .custom((value) => {
            const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            const isUsername = /^[a-zA-Z0-9_]{3,50}$/.test(value);
            if (!isEmail && !isUsername) {
                throw new Error('Identifier must be a valid email or username');
            }
            return true;
        }),
    body('password')
        .notEmpty().withMessage('Password is required')
];

// Helper to run validations and return response
const runValidation = async (req, res, next, rules) => {
    for (const rule of rules) {
        await rule.run(req);
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map(err => ({
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

const validateVerifyEmail = (req, res, next) => runValidation(req, res, next, verifyEmailRules);
const validateForgotPassword = (req, res, next) => runValidation(req, res, next, forgotPasswordRules);
const validateVerifyResetCode = (req, res, next) => runValidation(req, res, next, verifyResetCodeRules);
const validateResetPassword = (req, res, next) => runValidation(req, res, next, resetPasswordRules);
const validateChangePassword = (req, res, next) => runValidation(req, res, next, changePasswordRules);
const validateLogin = (req, res, next) => runValidation(req, res, next, loginRules);

module.exports = {
    validateRegister,
    validateVerifyEmail,
    validateForgotPassword,
    validateVerifyResetCode,
    validateResetPassword,
    validateChangePassword,
    validateLogin
};


