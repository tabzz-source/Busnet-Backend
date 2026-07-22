const { body } = require('express-validator');

const validateCreateBlog = [
    body('title')
        .notEmpty().withMessage('Blog title is required')
        .isLength({ min: 5, max: 150 }).withMessage('Title must be between 5 and 150 characters')
        .trim(),

    body('content')
        .notEmpty().withMessage('Content is required'),

    body('summary')
        .optional()
        .isLength({ max: 300 }).withMessage('Summary must be at most 300 characters')
        .trim(),

    body('coverImage')
        .notEmpty().withMessage('Cover image is required')
        .isString().withMessage('Cover image path must be a valid string'),

    body('tag')
        .optional()
        .isString().withMessage('Tag is invalid')
        .trim(),

    body('status')
        .optional()
        .isIn(['DRAFT', 'PENDING_APPROVAL']).withMessage('Status is invalid'),

    body('metaTitle')
        .optional()
        .isString().withMessage('Meta Title must be a string')
        .trim(),

    body('metaDescription')
        .optional()
        .isString().withMessage('Meta Description must be a string')
        .trim()
];

module.exports = {
    validateCreateBlog
};
