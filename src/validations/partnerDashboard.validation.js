const { query } = require('express-validator');

const revenueChartValidation = [
    query('months')
        .optional()
        .isInt({ min: 1, max: 24 })
        .withMessage('months must be an integer between 1 and 24')
        .toInt()
];

const listLimitValidation = [
    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('limit must be an integer between 1 and 50')
        .toInt()
];

module.exports = { revenueChartValidation, listLimitValidation };
