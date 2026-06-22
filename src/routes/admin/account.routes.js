const express = require('express');
const adminAccountController = require('../../controllers/admin/adminAccount.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const { ADMIN } = require('../../constants/roles');
const { param, body } = require('express-validator');

const router = express.Router();

router.use(protect, restrictTo(ADMIN));

const customerIdValidation = [
    param('id').isMongoId().withMessage('Invalid customer id')
];

const updateCustomerStatusValidation = [
    param('id').isMongoId().withMessage('Invalid customer id'),

    body('status')
        .notEmpty().withMessage('Status is required')
        .isIn(['ACTIVE', 'BANNED']).withMessage('Status must be either ACTIVE or BANNED'),

    body('type')
        .optional()
        .isIn(['TEMPORARY', 'PERMANENT']).withMessage('Type must be either TEMPORARY or PERMANENT'),

    body('reason')
        .optional()
        .trim()
        .isLength({ max: 500 }).withMessage('Reason must be at most 500 characters'),

    body('expiredAt')
        .optional({ checkFalsy: true })
        .isISO8601().withMessage('expiredAt must be a valid date')
];

router.get('/', adminAccountController.getCustomers);
router.get('/:id', customerIdValidation, validate, adminAccountController.getCustomerDetail);
router.patch('/:id/status', updateCustomerStatusValidation, validate, adminAccountController.updateCustomerStatus);
router.delete('/:id', customerIdValidation, validate, adminAccountController.deleteCustomer);

module.exports = router;
