const express = require('express');
const adminReportController = require('../../controllers/admin/adminReport.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const { ADMIN } = require('../../constants/roles');
const { param, body, query } = require('express-validator');

const router = express.Router();

router.use(protect, restrictTo(ADMIN));

const reportIdValidation = [
    param('id').isMongoId().withMessage('Invalid report id')
];

const getReportsValidation = [
    query('status')
        .optional()
        .isIn(['PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED', 'DISMISSED'])
        .withMessage('Invalid status filter'),

    query('targetType')
        .optional()
        .isIn(['TRIP', 'BOOKING', 'OPERATOR', 'PAYMENT', 'SYSTEM', 'OTHER'])
        .withMessage('Invalid targetType filter'),

    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),

    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
];

const resolveReportValidation = [
    param('id').isMongoId().withMessage('Invalid report id'),

    body('status')
        .notEmpty().withMessage('Status is required')
        .isIn(['RESOLVED', 'DISMISSED']).withMessage('Status must be either RESOLVED or DISMISSED'),

    body('adminNote')
        .optional()
        .trim()
        .isLength({ max: 1000 }).withMessage('Admin note must be at most 1000 characters')
];

router.get('/', getReportsValidation, validate, adminReportController.getReports);
router.get('/:id', reportIdValidation, validate, adminReportController.getReportDetail);
router.patch('/:id/resolve', resolveReportValidation, validate, adminReportController.resolveReport);

module.exports = router;
