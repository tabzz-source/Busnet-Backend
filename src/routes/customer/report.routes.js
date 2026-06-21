const express = require('express');
const reportController = require('../../controllers/customer/customerReport.controller');
const authenticate = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const {
    validateCreateReport,
    validateReportId
} = require('../../validations/report.validation');

const router = express.Router();

router.use(authenticate);

router.use((req, res, next) => {
    if (req.user.role !== 'CUSTOMER') {
        return res.status(403).json({
            success: false,
            message: 'Customer access only'
        });
    }

    next();
});

router.post(
    '/',
    validateCreateReport,
    validate,
    reportController.createReport
);

router.get(
    '/',
    reportController.getMyReports
);

router.get(
    '/:id',
    validateReportId,
    validate,
    reportController.getMyReportDetail
);

module.exports = router;