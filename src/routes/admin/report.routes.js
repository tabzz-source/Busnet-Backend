const express = require('express');
const adminReportController = require('../../controllers/admin/adminReport.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const { ADMIN } = require('../../constants/roles');
const { param, body } = require('express-validator');

const router = express.Router();

router.use(protect, restrictTo(ADMIN));

const reportIdValidation = [
    param('id').isMongoId().withMessage('Invalid report id')
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

router.get('/', adminReportController.getReports);
router.get('/:id', reportIdValidation, validate, adminReportController.getReportDetail);
router.patch('/:id/resolve', resolveReportValidation, validate, adminReportController.resolveReport);

module.exports = router;
