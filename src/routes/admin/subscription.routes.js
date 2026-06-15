const express = require('express');
const adminSubscriptionController = require('../../controllers/admin/adminSubscription.controller');
const { protect } = require('../../middlewares/auth.middleware');
const { restrictTo } = require('../../middlewares/role.middleware');
const validate = require('../../middlewares/validate.middleware');
const { ADMIN } = require('../../constants/roles');
const {
    subscriptionIdValidation,
    createSubscriptionValidation,
    updateSubscriptionValidation,
    updateSubscriptionStatusValidation
} = require('../../validations/subscription.validation');

const router = express.Router();

router.use(protect, restrictTo(ADMIN));

router.get('/', adminSubscriptionController.getPlans);
router.get('/:id', subscriptionIdValidation, validate, adminSubscriptionController.getPlanDetail);
router.post('/', createSubscriptionValidation, validate, adminSubscriptionController.createPlan);
router.patch('/:id', updateSubscriptionValidation, validate, adminSubscriptionController.updatePlan);
router.patch('/:id/status', updateSubscriptionStatusValidation, validate, adminSubscriptionController.updatePlanStatus);
router.delete('/:id', subscriptionIdValidation, validate, adminSubscriptionController.deletePlan);

module.exports = router;
