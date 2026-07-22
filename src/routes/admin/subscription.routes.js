const express = require('express');
const adminSubscriptionController = require('../../controllers/admin/adminSubscription.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const { ADMIN } = require('../../constants/roles');
const { query } = require('express-validator');
const {
    subscriptionIdValidation,
    createSubscriptionValidation,
    updateSubscriptionValidation,
    updateSubscriptionStatusValidation
} = require('../../validations/subscription.validation');

const router = express.Router();

router.use(protect, restrictTo(ADMIN));

const getPlansValidation = [
    query('status').optional().isIn(['ACTIVE', 'INACTIVE', 'DELETED']).withMessage('Invalid status filter'),
    query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be between 1 and 500')
];

router.get('/', getPlansValidation, validate, adminSubscriptionController.getPlans);
router.get('/:id', subscriptionIdValidation, validate, adminSubscriptionController.getPlanDetail);
router.post('/', createSubscriptionValidation, validate, adminSubscriptionController.createPlan);
router.patch('/:id', updateSubscriptionValidation, validate, adminSubscriptionController.updatePlan);
router.patch('/:id/status', updateSubscriptionStatusValidation, validate, adminSubscriptionController.updatePlanStatus);
router.delete('/:id', subscriptionIdValidation, validate, adminSubscriptionController.deletePlan);

module.exports = router;
