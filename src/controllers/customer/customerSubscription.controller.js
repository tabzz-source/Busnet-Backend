const subscriptionService = require('../../services/subscription.service');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');

/**
 * GET /api/customer/subscriptions/plans
 * View subscription plans for guests & customers
 */
const getSubscriptionPlans = asyncHandler(async (req, res) => {
    const plans = await subscriptionService.getActivePlans();
    return successResponse(res, 200, 'View subscription plans successfully', plans);
});

module.exports = {
    getSubscriptionPlans
};
