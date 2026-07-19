const { body, param } = require('express-validator');

const validateSaveSearchHistory = [
    body('departureLocation')
        .notEmpty()
        .withMessage('Departure location is required')
        .isString()
        .withMessage('Departure location must be a string')
        .trim(),

    body('arrivalLocation')
        .notEmpty()
        .withMessage('Arrival location is required')
        .isString()
        .withMessage('Arrival location must be a string')
        .trim(),

    body('departureDate')
        .notEmpty()
        .withMessage('Departure date is required')
        .isISO8601()
        .withMessage('Invalid departure date format')
];

const validateSearchHistoryId = [
    param('id')
        .notEmpty()
        .withMessage('Search history ID is required')
        .isMongoId()
        .withMessage('Invalid search history ID')
];

module.exports = {
    validateSaveSearchHistory,
    validateSearchHistoryId
};
