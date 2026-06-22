const { body } = require('express-validator');

const createScheduleValidation = [
    body('routeId')
        .notEmpty().withMessage('Route is required')
        .isMongoId().withMessage('Invalid route ID'),

    body('busId')
        .notEmpty().withMessage('Bus is required')
        .isMongoId().withMessage('Invalid bus ID'),

    body('departureTime')
        .notEmpty().withMessage('Departure time is required')
        .matches(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Departure time must be in HH:mm format'),

    body('arrivalTime')
        .notEmpty().withMessage('Arrival time is required')
        .matches(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Arrival time must be in HH:mm format'),

    body('basePrice')
        .notEmpty().withMessage('Base price is required')
        .isFloat({ min: 0 }).withMessage('Base price must be a positive number'),

    body('recurrenceType')
        .notEmpty().withMessage('Recurrence type is required')
        .isIn(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']).withMessage('Invalid recurrence type'),

    body('recurrenceRule.startDate')
        .notEmpty().withMessage('Start date is required')
        .isISO8601().withMessage('Start date must be a valid date'),

    body('recurrenceRule.endDate')
        .optional({ nullable: true })
        .isISO8601().withMessage('End date must be a valid date'),

    body('recurrenceRule.daysOfWeek')
        .optional()
        .isArray().withMessage('Days of week must be an array'),

    body('recurrenceRule.daysOfMonth')
        .optional()
        .isArray().withMessage('Days of month must be an array'),

    body('pickupPoints')
        .isArray({ min: 1 }).withMessage('At least one pickup point is required'),

    body('pickupPoints.*.name')
        .notEmpty().withMessage('Pickup point name is required'),

    body('pickupPoints.*.address')
        .notEmpty().withMessage('Pickup point address is required'),

    body('pickupPoints.*.time')
        .notEmpty().withMessage('Pickup point time is required')
        .matches(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Pickup time must be in HH:mm format'),

    body('dropoffPoints')
        .isArray({ min: 1 }).withMessage('At least one dropoff point is required'),

    body('dropoffPoints.*.name')
        .notEmpty().withMessage('Dropoff point name is required'),

    body('dropoffPoints.*.address')
        .notEmpty().withMessage('Dropoff point address is required'),

    body('dropoffPoints.*.time')
        .notEmpty().withMessage('Dropoff point time is required')
        .matches(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Dropoff time must be in HH:mm format'),

    body('operationNotes')
        .optional()
        .isString().withMessage('Operation notes must be a string')
];

module.exports = { createScheduleValidation };
