const { body, param } = require('express-validator');

const createBookingValidation = [
    body('tripId').isMongoId().withMessage('tripId is required and must be a valid MongoId'),
    body('seatCodes')
        .isArray({ min: 1 })
        .withMessage('seatCodes must be a non-empty array'),
    body('seatCodes.*')
        .isString()
        .trim()
        .notEmpty()
        .withMessage('Each seat code must be a non-empty string'),
    body('pickupPoint_name').isString().trim().notEmpty().withMessage('pickupPoint_name is required'),
    body('pickupPoint_address').isString().trim().notEmpty().withMessage('pickupPoint_address is required'),
    body('pickupPoint_time')
        .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
        .withMessage('pickupPoint_time must be in HH:mm format'),
    body('dropoffPoint_name').isString().trim().notEmpty().withMessage('dropoffPoint_name is required'),
    body('dropoffPoint_address').isString().trim().notEmpty().withMessage('dropoffPoint_address is required'),
    body('dropoffPoint_time')
        .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
        .withMessage('dropoffPoint_time must be in HH:mm format'),
    body('passengerName').isString().trim().notEmpty().withMessage('passengerName is required'),
    body('passengerPhone').isString().trim().notEmpty().withMessage('passengerPhone is required'),
    body('passengerEmail').optional({ nullable: true }).isEmail().withMessage('passengerEmail must be a valid email'),
    body('customerNote').optional().isString(),
];

const bookingCodeParamValidation = [
    param('bookingCode').isString().trim().notEmpty().withMessage('bookingCode is required')
];

module.exports = {
    createBookingValidation,
    bookingCodeParamValidation
};
