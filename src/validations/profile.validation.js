const { body } = require('express-validator');

const updateProfileValidation = [
    body('fullName')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Full name cannot be empty'),

    body('username')
        .optional()
        .trim()
        .notEmpty()
        .withMessage('Username cannot be empty')
];

const changePasswordValidation = [
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),

    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters')
];

module.exports = {
    updateProfileValidation,
    changePasswordValidation
};
