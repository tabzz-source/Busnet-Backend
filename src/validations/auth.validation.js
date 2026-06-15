const { body } = require('express-validator');

const forgotPasswordValidation = [
    body('email')
        .isEmail()
        .withMessage('Please enter a valid email')
];

const resetPasswordValidation = [
    body('email')
        .isEmail()
        .withMessage('Please enter a valid email'),

    body('code')
        .notEmpty()
        .withMessage('Code is required'),

    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters')
];

const verifyEmailValidation = [
    body('code')
        .notEmpty()
        .withMessage('Code is required')
];

module.exports = {
    forgotPasswordValidation,
    resetPasswordValidation,
    verifyEmailValidation
};
