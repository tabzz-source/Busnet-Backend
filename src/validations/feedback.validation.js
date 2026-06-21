const { body, param } = require('express-validator');

const validateCreateFeedback = [
    body('bookingId')
        .notEmpty()
        .withMessage('Booking ID is required')
        .isMongoId()
        .withMessage('Invalid booking ID'),

    body('rating')
        .notEmpty()
        .withMessage('Rating is required')
        .isInt({ min: 1, max: 5 })
        .withMessage('Rating must be an integer between 1 and 5'),

    body('review')
        .optional()
        .isLength({ max: 2000 })
        .withMessage('Review must not exceed 2000 characters')
        .trim(),

    body('reviewImages')
        .optional()
        .isArray()
        .withMessage('Review images must be an array'),

    body('reviewImages.*')
        .optional()
        .isString()
        .withMessage('Each review image must be a string')
        .trim(),

    body('type')
        .optional()
        .isIn(['TRIP', 'OPERATOR'])
        .withMessage('Invalid feedback type')
];

const validateTripId = [
    param('tripId')
        .notEmpty()
        .withMessage('Trip ID is required')
        .isMongoId()
        .withMessage('Invalid trip ID')
];

const validatePartnerId = [
    param('partnerId')
        .notEmpty()
        .withMessage('Partner ID is required')
        .isMongoId()
        .withMessage('Invalid partner ID')
];

module.exports = {
    validateCreateFeedback,
    validateTripId,
    validatePartnerId
};