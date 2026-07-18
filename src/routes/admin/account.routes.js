const express = require('express');
const adminAccountController = require('../../controllers/admin/adminAccount.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const { ADMIN } = require('../../constants/roles');
const { param, body, query } = require('express-validator');

const router = express.Router();

router.use(protect, restrictTo(ADMIN));

const customerIdValidation = [
    param('id').isMongoId().withMessage('Invalid customer id')
];

const getCustomersValidation = [
    query('status')
        .optional()
        .isIn(['UNVERIFIED', 'ACTIVE', 'DELETED', 'BANNED', 'PENDING_APPROVAL', 'DISABLED'])
        .withMessage('Invalid status filter'),

    query('search').optional().trim().isLength({ max: 100 }).withMessage('Search must be at most 100 characters'),

    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),

    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
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

router.get('/', getCustomersValidation, validate, adminAccountController.getCustomers);
router.get('/:id', customerIdValidation, validate, adminAccountController.getCustomerDetail);
router.patch('/:id/status', updateCustomerStatusValidation, validate, adminAccountController.updateCustomerStatus);
router.delete('/:id', customerIdValidation, validate, adminAccountController.deleteCustomer);

module.exports = router;
