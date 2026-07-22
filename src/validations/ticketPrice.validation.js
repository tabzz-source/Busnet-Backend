const { body } = require('express-validator');

const setTicketPriceValidation = [
    body('seatType')
        .trim()
        .notEmpty().withMessage('Seat type is required'),

    body('price')
        .notEmpty().withMessage('Base price is required')
        .isFloat({ min: 0 }).withMessage('Base price must be a non-negative number')
        .toFloat(),

    body('discount')
        .optional()
        .isFloat({ min: 0 }).withMessage('Discount must be a non-negative number')
        .toFloat(),

    body('effectiveFrom')
        .notEmpty().withMessage('Effective from is required')
        .isISO8601().withMessage('Effective from must be a valid ISO date')
        .toDate(),

    body('effectiveTo')
        .optional({ nullable: true })
        .isISO8601().withMessage('Effective to must be a valid ISO date')
        .toDate(),

    body('isActive')
        .optional()
        .isBoolean().withMessage('isActive must be a boolean')
        .toBoolean()
];

module.exports = { setTicketPriceValidation };
